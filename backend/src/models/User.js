const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  walletBalance: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('user', UserSchema);
