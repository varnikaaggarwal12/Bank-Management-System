const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, transactionController.getTransactions);
router.get('/:accountNumber', transactionController.getTransactions);

module.exports = router;
