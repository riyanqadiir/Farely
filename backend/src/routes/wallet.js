const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @route   GET api/wallet/balance
// @desc    Get current wallet balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ balance: user.walletBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/wallet/topup
// @desc    Add funds to wallet
router.post('/topup', auth, async (req, res) => {
  const { amount, method } = req.body;

  try {
    const user = await User.findById(req.user.id);
    user.walletBalance += amount;
    await user.save();

    const transaction = new Transaction({
      user: req.user.id,
      amount,
      type: 'topup',
      method,
    });

    await transaction.save();

    res.json({ balance: user.walletBalance, transaction });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/wallet/history
// @desc    Get transaction history
router.get('/history', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
