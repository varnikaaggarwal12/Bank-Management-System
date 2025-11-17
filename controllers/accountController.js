const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey"; // fallback if .env missing

// ✅ OPEN ACCOUNT
exports.openAccount = async (req, res) => {
  try {
    const { name, pin } = req.body;

    if (!name || !pin) {
      return res.status(400).json({ message: "Name and PIN are required" });
    }

    const accountNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPin = await bcrypt.hash(pin, 10);

    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        accountNumber,
        pin: hashedPin,
        balance: 0,
      },
    });

    res.status(201).json({
      message: "Account created successfully",
      accountNumber: account.accountNumber,
    });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ message: "Server error creating account" });
  }
};

// ✅ LOGIN
exports.login = async (req, res) => {
  try {
    const { accountNumber, pin } = req.body;

    const account = await prisma.account.findUnique({
      where: { accountNumber: String(accountNumber).trim() },
    });

    if (!account) return res.status(401).json({ message: "Account not found" });

    const isMatch = await bcrypt.compare(String(pin).trim(), account.pin);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: account.id, accountNumber: account.accountNumber },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// ✅ DEPOSIT
exports.deposit = async (req, res) => {
  try {
    const { amount } = req.body;
    const accountNumber = req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    // ✅ verify account exists
    const existing = await prisma.account.findUnique({
      where: { accountNumber },
    });

    if (!existing) {
      return res.status(404).send("Account not found");
    }

    const updated = await prisma.account.update({
      where: { accountNumber },
      data: { balance: { increment: parseFloat(amount) } },
    });

    await prisma.transaction.create({
      data: {
        accountNumber,
        type: "deposit",
        amount: parseFloat(amount),
      },
    });

    res.json({
      message: `Deposited ₹${amount}`,
      newBalance: updated.balance,
    });
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).send("Server error during deposit");
  }
};

// ✅ WITHDRAW
exports.withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    const accountNumber = req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    const account = await prisma.account.findUnique({
      where: { accountNumber },
    });

    if (!account || account.balance < parseFloat(amount)) {
      return res.status(400).send("Insufficient balance");
    }

    const updated = await prisma.account.update({
      where: { accountNumber },
      data: { balance: { decrement: parseFloat(amount) } },
    });

    await prisma.transaction.create({
      data: {
        accountNumber,
        type: "withdraw",
        amount: parseFloat(amount),
      },
    });

    res.json({
      message: `Withdrawn ₹${amount}`,
      remainingBalance: updated.balance,
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    res.status(500).send("Server error during withdrawal");
  }
};

// ✅ TRANSFER
exports.transfer = async (req, res) => {
  try {
    const { toAccountNumber, amount } = req.body;
    const fromAccountNumber = req.user?.accountNumber;

    if (!fromAccountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    if (!toAccountNumber || !amount || amount <= 0) {
      return res.status(400).send("Invalid recipient account or amount");
    }

    if (fromAccountNumber === toAccountNumber) {
      return res.status(400).send("Cannot transfer to same account");
    }

    const fromAccount = await prisma.account.findUnique({
      where: { accountNumber: fromAccountNumber },
    });

    if (!fromAccount || fromAccount.balance < parseFloat(amount)) {
      return res.status(400).send("Insufficient balance");
    }

    const toAccount = await prisma.account.findUnique({
      where: { accountNumber: toAccountNumber },
    });

    if (!toAccount) {
      return res.status(404).send("Recipient account not found");
    }

    await prisma.account.update({
      where: { accountNumber: fromAccountNumber },
      data: { balance: { decrement: parseFloat(amount) } },
    });

    const updatedToAccount = await prisma.account.update({
      where: { accountNumber: toAccountNumber },
      data: { balance: { increment: parseFloat(amount) } },
    });

    await prisma.transaction.create({
      data: {
        accountNumber: fromAccountNumber,
        type: "transfer",
        amount: parseFloat(amount),
        toAccount: toAccountNumber,
      },
    });

    res.json({
      message: `Transferred ₹${amount} to ${toAccount.name}`,
      remainingBalance: fromAccount.balance - parseFloat(amount),
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).send("Server error during transfer");
  }
};

// ✅ UPDATE PIN
exports.updatePin = async (req, res) => {
  try {
    const { newPin } = req.body;
    const accountNumber = req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    if (!newPin) {
      return res.status(400).send("New PIN is required");
    }

    const hashedNewPin = await bcrypt.hash(newPin, 10);

    await prisma.account.update({
      where: { accountNumber },
      data: { pin: hashedNewPin },
    });

    res.json({ message: "PIN updated successfully" });
  } catch (error) {
    console.error("Update PIN error:", error);
    res.status(500).send("Server error updating PIN");
  }
};

// ✅ GET TRANSACTION HISTORY
exports.getTransactionHistory = async (req, res) => {
  try {
    const accountNumber = req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    const transactions = await prisma.transaction.findMany({
      where: { accountNumber },
      orderBy: { date: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).send("Server error fetching transaction history");
  }
};

// ✅ DELETE ACCOUNT
exports.deleteAccount = async (req, res) => {
  try {
    const accountNumber = req.user?.accountNumber;

    if (!accountNumber) {
      return res.status(401).json({ message: "Unauthorized: Account number not found in token" });
    }

    const account = await prisma.account.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).send("Account not found");
    }

    await prisma.transaction.deleteMany({
      where: { accountNumber },
    });

    await prisma.account.delete({
      where: { accountNumber },
    });

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).send("Server error deleting account");
  }
};
