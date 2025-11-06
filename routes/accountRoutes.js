const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const auth = require('../middleware/authJWT');

router.post('/open', accountController.openAccount); // no auth
router.post('/deposit', auth, accountController.deposit);
router.post('/withdraw', auth, accountController.withdraw);
router.post('/transfer', auth, accountController.transfer);
router.post('/update-pin', auth, accountController.updatePin);
router.post('/delete', auth, accountController.deleteAccount);

module.exports = router;
