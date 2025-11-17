const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.get('/:accountNumber', transactionController.getTransactions);

module.exports = router;
