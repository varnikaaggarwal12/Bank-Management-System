const Transaction = require('../models/Transaction');

exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ accountNumber: req.account.accountNumber }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).send(err.message);
  }
};
