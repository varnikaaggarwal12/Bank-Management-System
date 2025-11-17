const { prisma } = require('../config/db');

// Get all transactions for an account
exports.getTransactions = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const transactions = await prisma.transaction.findMany({
      where: { accountNumber },
      orderBy: { date: 'desc' },
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).send(err.message);
  }
};
