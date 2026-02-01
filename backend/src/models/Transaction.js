const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['topup', 'payment'],
    required: true,
  },
  method: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('transaction', TransactionSchema);
