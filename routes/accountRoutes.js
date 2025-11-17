const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes
router.post("/open", accountController.openAccount);
router.post("/login", accountController.login);

// Protected routes
router.post("/deposit", authMiddleware, accountController.deposit);
router.post("/withdraw", authMiddleware, accountController.withdraw);
router.post("/transfer", authMiddleware, accountController.transfer);
router.post("/update-pin", authMiddleware, accountController.updatePin);
router.get("/transaction-history", authMiddleware, accountController.getTransactionHistory);
router.post("/delete", authMiddleware, accountController.deleteAccount);

module.exports = router;
