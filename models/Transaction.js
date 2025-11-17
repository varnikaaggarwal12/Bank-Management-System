const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  accountNumber: String,
  type: String,
  amount: Number,
  toAccount: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
