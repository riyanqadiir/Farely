require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedAdmin = async () => {
  console.log('Seeding process started...');
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not defined in environment');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    const adminPhone = '03001234567';
    const adminPassword = 'adminpassword123';

    let user = await User.findOne({ phone: adminPhone });
    if (user) {
      console.log('Admin already exists');
      process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    user = new User({
      name: 'Farely Admin',
      phone: adminPhone,
      password: hashedPassword,
      role: 'admin',
      walletBalance: 1000,
    });

    await user.save();
    console.log('Admin user created successfully!');
    console.log(`Phone: ${adminPhone}`);
    console.log(`Password: ${adminPassword}`);
    process.exit();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

seedAdmin();
