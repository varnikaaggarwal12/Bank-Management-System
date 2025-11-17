const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");

const JWT_SECRET = "mysecretkey";

// ✅ OPEN ACCOUNT
exports.openAccount = async (req, res) => {
  try {
    const { name, pin } = req.body;

    if (!name || !pin) {
      return res.status(400).json({ message: "Name and PIN are required" });
    }

    // ✅ Generate a unique 6-digit account number
    const accountNumber = Math.floor(100000 + Math.random() * 900000).toString();

    const account = await prisma.account.create({
      data: {
        name,
        accountNumber,
        pin: String(pin),
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

    if (!accountNumber || !pin) {
      return res.status(400).json({ message: "Both fields required" });
    }

    console.log("🟡 Login attempt with:", { accountNumber, pin });

    const account = await prisma.account.findUnique({
      where: { accountNumber: String(accountNumber) },
    });

    if (!account) {
      console.log("❌ Account not found in DB");
      return res.status(401).json({ message: "Account not found" });
    }

    console.log("✅ Found account in DB:", account);

    if (account.pin !== String(pin)) {
      console.log("❌ PIN mismatch. DB PIN:", account.pin, "Entered PIN:", pin);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: account.id, accountNumber: account.accountNumber },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    console.log("✅ Login successful");

    res.status(200).json({
      message: "Login successful",
      token,
      accountNumber: account.accountNumber,
      name: account.name,
      balance: account.balance,
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
    const accountNumber = req.user.accountNumber;

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    const account = await prisma.account.update({
      where: { accountNumber: String(accountNumber) },
      data: { balance: { increment: parseFloat(amount) } },
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: "deposit",
        amount: parseFloat(amount),
      },
    });

    res.json({
      message: `Deposited ₹${amount}`,
      newBalance: account.balance,
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
    const accountNumber = req.user.accountNumber;

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    const account = await prisma.account.findUnique({
      where: { accountNumber: String(accountNumber) },
    });

    if (!account || account.balance < parseFloat(amount)) {
      return res.status(400).send("Insufficient balance");
    }

    const updated = await prisma.account.update({
      where: { accountNumber: String(accountNumber) },
      data: { balance: { decrement: parseFloat(amount) } },
    });

    await prisma.transaction.create({
      data: {
        accountId: updated.id,
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
