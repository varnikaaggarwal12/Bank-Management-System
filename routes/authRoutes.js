const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ✅ Register a new account
router.post("/register", async (req, res) => {
  const { name, accountNumber, pin } = req.body;

  try {
    const hashedPin = await bcrypt.hash(pin, 10);
    const account = await prisma.account.create({
      data: { name, accountNumber, pin: hashedPin },
    });

    res.status(201).json({ message: "Account created successfully", account });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating account" });
  }
});

// ✅ Login route
router.post("/login", async (req, res) => {
  const { accountNumber, pin } = req.body;

  try {
    const account = await prisma.account.findUnique({ where: { accountNumber } });
    if (!account) return res.status(404).json({ message: "Account not found" });

    const isMatch = await bcrypt.compare(pin, account.pin);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: account.id, name: account.name },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
});

module.exports = router;
