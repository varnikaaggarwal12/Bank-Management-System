// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../config/db');
const auth = require('../middleware/authMiddleware');

// Get transactions for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const accountNumber = req.user.accountNumber;
    const tx = await prisma.transaction.findMany({ where: { accountNumber }, orderBy: { date: 'desc' } });
    res.json(tx);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: get by accountNumber param
router.get('/:accountNumber', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const tx = await prisma.transaction.findMany({ where: { accountNumber }, orderBy: { date: 'desc' } });
    res.json(tx);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
