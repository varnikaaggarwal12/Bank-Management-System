const { enqueueTransaction } = require("../services/messageQueue");
const { prisma } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;


// 🔹 Create account
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


// 🔹 Login
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


// 🔹 Deposit
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

    // Save transaction
    await prisma.transaction.create({
      data: { accountNumber, type: 'deposit', amount: amt }
    });

    // Push to queue
    await enqueueTransaction({
      event: "DEPOSIT",
      accountNumber,
      amount: amt,
      time: new Date(),
    });

    res.json({ message: `Deposited ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('deposit error', err.message);
    res.status(500).json({ message: 'Server error during deposit' });
  }
};


// 🔹 Withdraw
exports.withdraw = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const { amount } = req.body;

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const acc = await prisma.account.findUnique({ where: { accountNumber } });
    if (!acc || acc.balance < amt) return res.status(400).json({ message: 'Insufficient balance' });

    const updated = await prisma.account.update({
      where: { accountNumber },
      data: { balance: { decrement: amt } }
    });

    await prisma.transaction.create({
      data: { accountNumber, type: 'withdraw', amount: amt }
    });

    await enqueueTransaction({
      event: "WITHDRAW",
      accountNumber,
      amount: amt,
      time: new Date(),
    });

    res.json({ message: `Withdrawn ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('withdraw error', err.message);
    res.status(500).json({ message: 'Server error during withdrawal' });
  }
};


// 🔹 Transfer
exports.transfer = async (req, res) => {
  try {
    const from = req.user.accountNumber;
    const { toAccountNumber, amount } = req.body;

    const amt = Number(amount);
    if (!toAccountNumber || !amt || amt <= 0)
      return res.status(400).json({ message: 'Invalid toAccount or amount' });

    if (from === toAccountNumber)
      return res.status(400).json({ message: 'Cannot transfer to same account' });

    const result = await prisma.$transaction(async (tx) => {
      const sender = await tx.account.findUnique({ where: { accountNumber: from } });
      if (!sender || sender.balance < amt) throw new Error('Insufficient balance');

      const recipient = await tx.account.findUnique({ where: { accountNumber: toAccountNumber } });
      if (!recipient) throw new Error('Recipient not found');

      const updatedSender = await tx.account.update({
        where: { accountNumber: from },
        data: { balance: { decrement: amt } }
      });

      const updatedRecipient = await tx.account.update({
        where: { accountNumber: toAccountNumber },
        data: { balance: { increment: amt } }
      });

      await tx.transaction.create({
        data: {
          accountNumber: from,
          type: 'transfer',
          amount: amt,
          toAccount: toAccountNumber
        }
      });

      return { sender, recipient, amount: amt };
    });

    // queue event
    await enqueueTransaction({
      type: "TRANSFER",
      from,
      to: toAccountNumber,
      amount: amt,
      time: new Date(),
    });

    res.json({ message: `Transferred ₹${amt} to ${result.recipient.name}` });

  } catch (err) {
    console.error('transfer error', err.message);

    if (['Insufficient balance', 'Recipient not found'].includes(err.message)) {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Server error during transfer' });
  }
};


// 🔹 Update PIN
exports.updatePin = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const { newPin } = req.body;

    if (!newPin) return res.status(400).json({ message: 'New PIN required' });

    const hashed = await bcrypt.hash(String(newPin), 10);

    await prisma.account.update({
      where: { accountNumber },
      data: { pin: hashed }
    });

    res.json({ message: 'PIN updated' });
  } catch (err) {
    console.error('updatePin error', err.message);
    res.status(500).json({ message: 'Server error updating PIN' });
  }
};


// 🔹 Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;

    await prisma.transaction.deleteMany({ where: { accountNumber } });
    await prisma.account.delete({ where: { accountNumber } });

    await enqueueTransaction({
      event: "ACCOUNT_DELETED",
      accountNumber,
      time: new Date(),
    });

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('deleteAccount error', err.message);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};


// 🔹 Get history
exports.getTransactionHistory = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;

    const history = await prisma.transaction.findMany({
      where: { accountNumber },
      orderBy: { date: 'desc' }
    });

    res.json(history);
  } catch (err) {
    console.error('history error', err.message);
    res.status(500).json({ message: 'Server error fetching history' });
  }
};