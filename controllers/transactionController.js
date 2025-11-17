const { prisma } = require('../config/db');

// Get all transactions for an account
exports.getTransactions = async (req, res) => {
  try {
    // If accountNumber is in params (public route), use that
    // Otherwise use the authenticated user's accountNumber
    const accountNumber = req.params.accountNumber || req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(400).json({ message: "Account number is required" });
    }

    const transactions = await prisma.transaction.findMany({
      where: { accountNumber },
      orderBy: { date: 'desc' },
    });

    res.json(transactions);
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).send(err.message);
  }
};
