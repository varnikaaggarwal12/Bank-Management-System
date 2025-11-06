const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authJWT');

router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ accountNumber: req.account.accountNumber }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
