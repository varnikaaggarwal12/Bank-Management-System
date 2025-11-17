const { prisma } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  publishToChannel, 
  enqueueJob, 
  CHANNELS, 
  QUEUES 
} = require('../services/pubsub');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

/* ----------------------------------------------------------
   CREATE ACCOUNT
-----------------------------------------------------------*/
exports.openAccount = async (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ message: 'Name and PIN required' });

    const accountNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(pin, 10);

    const acc = await prisma.account.create({
      data: { name: name.trim(), pin: hashed, accountNumber, balance: 0 }
    });

    // Publish account created event
    await publishToChannel(CHANNELS.ACCOUNT_EVENTS, {
      type: 'account_created',
      accountNumber: acc.accountNumber,
      name: acc.name,
      timestamp: new Date().toISOString()
    });

    // SMS queue
    await enqueueJob(QUEUES.SMS_QUEUE, {
      type: 'welcome_sms',
      accountNumber: acc.accountNumber,
      name: acc.name
    });

    res.status(201).json({ message: 'Account created', accountNumber: acc.accountNumber });
  } catch (err) {
    console.error('openAccount error', err.message);
    res.status(500).json({ message: 'Server error creating account' });
  }
};

/* ----------------------------------------------------------
   LOGIN
-----------------------------------------------------------*/
exports.login = async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;

    const acc = await prisma.account.findUnique({ where: { accountNumber: String(accountNumber).trim() } });
    if (!acc) return res.status(401).json({ message: 'Account not found' });

    const match = await bcrypt.compare(String(pin), acc.pin);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: acc.id, accountNumber: acc.accountNumber },
      JWT_SECRET,
      { expiresIn: '3h' }
    );

    // Publish login audit
    await publishToChannel(CHANNELS.AUDIT_EVENTS, {
      type: 'login',
      accountNumber: acc.accountNumber,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('login error', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/* ----------------------------------------------------------
   DEPOSIT
-----------------------------------------------------------*/
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

    await prisma.transaction.create({
      data: { accountNumber, type: 'deposit', amount: amt }
    });

    // PubSub event
    await publishToChannel(CHANNELS.TRANSACTION_EVENTS, {
      accountNumber,
      type: 'deposit',
      amount: amt,
      balance: updated.balance,
      timestamp: new Date().toISOString()
    });

    // Large deposit SMS
    if (amt > 5000) {
      await enqueueJob(QUEUES.SMS_QUEUE, {
        type: 'large_deposit_notification',
        accountNumber,
        amount: amt
      });
    }

    res.json({ message: `Deposited ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('deposit error', err.message);
    res.status(500).json({ message: 'Server error during deposit' });
  }
};

/* ----------------------------------------------------------
   WITHDRAW
-----------------------------------------------------------*/
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

    // PubSub event
    await publishToChannel(CHANNELS.TRANSACTION_EVENTS, {
      accountNumber,
      type: 'withdraw',
      amount: amt,
      balance: updated.balance,
      timestamp: new Date().toISOString()
    });

    // Low balance warning SMS
    if (updated.balance < 1000) {
      await enqueueJob(QUEUES.SMS_QUEUE, {
        type: 'low_balance_warning',
        accountNumber,
        balance: updated.balance
      });
    }

    res.json({ message: `Withdrawn ₹${amt}`, balance: updated.balance });
  } catch (err) {
    console.error('withdraw error', err.message);
    res.status(500).json({ message: 'Server error during withdrawal' });
  }
};

/* ----------------------------------------------------------
   TRANSFER (UPDATED FULLY)
-----------------------------------------------------------*/
exports.transfer = async (req, res) => {
  try {
    const from = req.user.accountNumber;
    const { toAccountNumber, amount } = req.body;
    const amt = Number(amount);

    if (!toAccountNumber || !amt || amt <= 0)
      return res.status(400).json({ message: 'Invalid toAccount or amount' });

    if (from === toAccountNumber)
      return res.status(400).json({ message: 'Cannot transfer to same account' });

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
        data: {
          accountNumber: from,
          type: 'transfer',
          amount: amt,
          toAccount: toAccountNumber
        }
      });

      return {
        updatedSender,
        updatedRecipient,
        txRecord,
        recipientName: recipient.name
      };
    });

    /* ---------------------------------------------------
       PUBSUB — Real-time notifications for both parties
    ----------------------------------------------------*/

    // Notify RECEIVER (real-time)
    await publishToChannel(CHANNELS.NOTIFICATION_EVENTS, {
      type: 'money_received',
      accountNumber: toAccountNumber,
      amount: amt,
      senderAccount: from,
      timestamp: new Date().toISOString()
    });

    // Notify SENDER (real-time)
    await publishToChannel(CHANNELS.NOTIFICATION_EVENTS, {
      type: 'money_sent',
      accountNumber: from,
      amount: amt,
      receiverAccount: toAccountNumber,
      timestamp: new Date().toISOString()
    });

    /* ---------------------------------------------------
       QUEUE — SMS notifications
    ----------------------------------------------------*/

    // Notify sender (SMS)
    await enqueueJob(QUEUES.SMS_QUEUE, {
      type: 'transfer_sent_notification',
      accountNumber: from,
      amount: amt,
      recipientName: result.recipientName
    });

    // Notify receiver (SMS)
    await enqueueJob(QUEUES.SMS_QUEUE, {
      type: 'transfer_received_notification',
      accountNumber: toAccountNumber,
      amount: amt,
      senderAccount: from
    });

    res.json({ message: `Transferred ₹${amt} to ${result.recipientName}` });

  } catch (err) {
    console.error('transfer error', err.message);

    if (err.message === 'Insufficient balance' || err.message === 'Recipient not found') {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Server error during transfer' });
  }
};

/* ----------------------------------------------------------
   UPDATE PIN
-----------------------------------------------------------*/
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

    // Audit event
    await publishToChannel(CHANNELS.AUDIT_EVENTS, {
      type: 'pin_updated',
      accountNumber,
      timestamp: new Date().toISOString()
    });

    // SMS queue
    await enqueueJob(QUEUES.SMS_QUEUE, {
      type: 'pin_updated_notification',
      accountNumber
    });

    res.json({ message: 'PIN updated' });
  } catch (err) {
    console.error('updatePin error', err.message);
    res.status(500).json({ message: 'Server error updating PIN' });
  }
};

/* ----------------------------------------------------------
   DELETE ACCOUNT
-----------------------------------------------------------*/
exports.deleteAccount = async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;

    await prisma.transaction.deleteMany({ where: { accountNumber } });
    await prisma.account.delete({ where: { accountNumber } });

    await publishToChannel(CHANNELS.ACCOUNT_EVENTS, {
      type: 'account_deleted',
      accountNumber,
      timestamp: new Date().toISOString()
    });

    await enqueueJob(QUEUES.EMAIL_QUEUE, {
      type: 'account_deletion_confirmation',
      accountNumber
    });

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('deleteAccount error', err.message);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};

/* ----------------------------------------------------------
   TRANSACTION HISTORY
-----------------------------------------------------------*/
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
