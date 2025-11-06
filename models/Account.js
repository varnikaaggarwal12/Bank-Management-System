const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    default: () =>
      Math.floor(1000000000 + Math.random() * 9000000000).toString() // 10-digit
  },
  pin: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Account', accountSchema);
