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
