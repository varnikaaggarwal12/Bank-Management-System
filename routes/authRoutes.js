const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Account = require('../models/Account');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

// Login: returns JWT token
router.post('/login', async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;
    if (!accountNumber || !pin) return res.status(400).send('Account number and PIN required');

    const account = await Account.findOne({ accountNumber });
    if (!account) return res.status(404).send('Account not found');

    if (account.pin !== pin) return res.status(401).send('Invalid PIN');

    const token = jwt.sign({ accountNumber: account.accountNumber }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
