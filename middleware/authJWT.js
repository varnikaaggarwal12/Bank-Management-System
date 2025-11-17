const jwt = require('jsonwebtoken');
const Account = require('../models/Account');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

async function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).send('No token provided');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const account = await Account.findOne({ accountNumber: decoded.accountNumber });
    if (!account) return res.status(401).send('Invalid token');

    req.account = account; // attach account to request
    next();
  } catch (err) {
    res.status(401).send('Invalid or expired token');
  }
}

module.exports = auth;
