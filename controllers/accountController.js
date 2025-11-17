// controllers/accountController.js
const { prisma } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pub } = require('../services/pubsub');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

exports.openAccount = async (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ message: 'Name and PIN required' });

    const accountNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(pin, 10);

    const acc = await prisma.account.create({
      data: { name: name.trim(), pin: hashed, accountNumber, balance: 0 }
    });

    res.status(201).json({ message: 'Account created', accountNumber: acc.accountNumber });
  } catch (err) {
    console.error('openAccount error', err.message);
    res.status(500).json({ message: 'Server error creating account' });
  }
};

exports.login = async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;
    const acc = await prisma.account.findUnique({ where: { accountNumber: String(accountNumber).trim() } });
    if (!acc) return res.status(401).json({ message: 'Account not found' });

    const match = await bcrypt.compare(String(pin), acc.pin);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: acc.id, accountNumber: acc.accountNumber }, JWT_SECRET, { expiresIn: '3h' });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('login error', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};

exports.deposit = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const updated = await prisma.account.update({
      where: { accountNumber },
      data: { balance: { increment: amt } }
    });

    await prisma.transaction.create({ data: { accountNumber, type: 'deposit', amount: amt } });

    pub.publish('transactionEvents', JSON.stringify({ accountNumber, type: 'deposit', amount: amt, balance: updated.balance }));

    res.json({ message: `Deposited ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('deposit error', err.message);
    res.status(500).json({ message: 'Server error during deposit' });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const acc = await prisma.account.findUnique({ where: { accountNumber } });
    if (!acc || acc.balance < amt) return res.status(400).json({ message: 'Insufficient balance' });

    const updated = await prisma.account.update({ where: { accountNumber }, data: { balance: { decrement: amt } } });

    await prisma.transaction.create({ data: { accountNumber, type: 'withdraw', amount: amt } });

    pub.publish('transactionEvents', JSON.stringify({ accountNumber, type: 'withdraw', amount: amt, balance: updated.balance }));

    res.json({ message: `Withdrawn ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('withdraw error', err.message);
    res.status(500).json({ message: 'Server error during withdrawal' });
  }
};

exports.transfer = async (req, res) => {
  try {
    const from = req.user.accountNumber;
    const { toAccountNumber, amount } = req.body;
    const amt = Number(amount);
    if (!toAccountNumber || !amt || amt <= 0) return res.status(400).json({ message: 'Invalid toAccount or amount' });
    if (from === toAccountNumber) return res.status(400).json({ message: 'Cannot transfer to same account' });

    // atomically check sender balance, decrement sender, increment recipient, and create transaction
    const result = await prisma.$transaction(async (prismaTx) => {
      const sender = await prismaTx.account.findUnique({ where: { accountNumber: from } });
      if (!sender || sender.balance < amt) throw new Error('Insufficient balance');

      const recipient = await prismaTx.account.findUnique({ where: { accountNumber: toAccountNumber } });
      if (!recipient) throw new Error('Recipient not found');

      const updatedSender = await prismaTx.account.update({
        where: { accountNumber: from },
        data: { balance: { decrement: amt } }
      });

      const updatedRecipient = await prismaTx.account.update({
        where: { accountNumber: toAccountNumber },
        data: { balance: { increment: amt } }
      });

      const txRecord = await prismaTx.transaction.create({
        data: { accountNumber: from, type: 'transfer', amount: amt, toAccount: toAccountNumber }
      });

      return { updatedSender, updatedRecipient, txRecord, recipientName: recipient.name };
    });

    // publish once transaction succeeded
    pub.publish('transactionEvents', JSON.stringify({
      from,
      toAccountNumber,
      type: 'transfer',
      amount: amt,
      balanceTo: result.updatedRecipient.balance
    }));

    res.json({ message: `Transferred ₹${amt} to ${result.recipientName}` });
  } catch (err) {
    console.error('transfer error', err.message);
    // surface friendly errors
    if (err.message === 'Insufficient balance' || err.message === 'Recipient not found') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error during transfer' });
  }
};

exports.updatePin = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const { newPin } = req.body;
    if (!newPin) return res.status(400).json({ message: 'New PIN required' });

    const hashed = await bcrypt.hash(String(newPin), 10);
    await prisma.account.update({ where: { accountNumber }, data: { pin: hashed } });

    res.json({ message: 'PIN updated' });
  } catch (err) {
    console.error('updatePin error', err.message);
    res.status(500).json({ message: 'Server error updating PIN' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;

    await prisma.transaction.deleteMany({ where: { accountNumber } });
    await prisma.account.delete({ where: { accountNumber } });

    pub.publish('transactionEvents', JSON.stringify({ accountNumber, type: 'accountDeleted' }));

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('deleteAccount error', err.message);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const history = await prisma.transaction.findMany({ where: { accountNumber }, orderBy: { date: 'desc' } });
    res.json(history);
  } catch (err) {
    console.error('history error', err.message);
    res.status(500).json({ message: 'Server error fetching history' });
  }
};
