const Account = require('../models/Account');

async function auth(req, res, next) {
  try {
    const { accountNumber, pin } = req.body;

    if (!accountNumber || !pin) {
      return res.status(400).send('Account number and PIN are required');
    }

    const account = await Account.findOne({ accountNumber, pin });
    if (!account) {
      return res.status(401).send('Invalid account number or PIN');
    }

    req.account = account; // attach account to request
    next();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error in authentication');
  }
}

module.exports = auth;
