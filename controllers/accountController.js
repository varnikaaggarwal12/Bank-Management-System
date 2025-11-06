const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// Open Account
exports.openAccount = async (req, res) => {
  try {
    const { name, pin } = req.body;
    const account = new Account({ name, pin });
    await account.save();
    res.send(`Account created. Your Account Number: ${account.accountNumber}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Deposit
exports.deposit = async (req, res) => {
  try {
    const { amount } = req.body;
    req.account.balance += Number(amount);
    await req.account.save();

    await Transaction.create({
      accountNumber: req.account.accountNumber,
      type: 'deposit',
      amount
    });

    res.send(`Deposited ${amount}. New Balance: ${req.account.balance}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Withdraw
exports.withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    if (req.account.balance < amount) return res.status(400).send('Insufficient balance');

    req.account.balance -= Number(amount);
    await req.account.save();

    await Transaction.create({
      accountNumber: req.account.accountNumber,
      type: 'withdraw',
      amount
    });

    res.send(`Withdrew ${amount}. New Balance: ${req.account.balance}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Transfer
exports.transfer = async (req, res) => {
  try {
    const { toAccountNumber, amount } = req.body;
    const receiver = await Account.findOne({ accountNumber: toAccountNumber });
    if (!receiver) return res.status(404).send('Receiver account not found');

    if (req.account.balance < amount) return res.status(400).send('Insufficient balance');

    req.account.balance -= Number(amount);
    receiver.balance += Number(amount);

    await req.account.save();
    await receiver.save();

    await Transaction.create({
      accountNumber: req.account.accountNumber,
      type: 'transfer',
      amount,
      toAccount: toAccountNumber
    });

    res.send(`Transferred ${amount} to ${toAccountNumber}. Your Balance: ${req.account.balance}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Update PIN
exports.updatePin = async (req, res) => {
  try {
    const { newPin } = req.body;
    req.account.pin = newPin;
    await req.account.save();
    res.send('PIN updated successfully');
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Delete Account
exports.deleteAccount = async (req, res) => {
  try {
    await Account.findOneAndDelete({ accountNumber: req.account.accountNumber });
    res.send('Account deleted successfully');
  } catch (err) {
    res.status(500).send(err.message);
  }
};
