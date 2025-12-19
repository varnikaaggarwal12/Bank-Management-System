
// routes/accountRoutes.js
const express = require('express');
const router = express.Router();
const account = require('../controllers/accountController');
const auth = require('../middleware/authMiddleware');

router.post('/open', account.openAccount);
router.post('/login', account.login);

router.post('/deposit', auth, account.deposit);
router.post('/withdraw', auth, account.withdraw);
router.post('/transfer', auth, account.transfer);
router.post('/update-pin', auth, account.updatePin);
router.post('/delete', auth, account.deleteAccount);
router.get('/transaction-history', auth, account.getTransactionHistory);

module.exports = router;
