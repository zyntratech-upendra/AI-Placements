const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminExists = await User.findOne({ email: 'pranav2005@gmail.com' });

    if (adminExists) {
      console.log('Admin user already exists!');
      process.exit();
    }

    const admin = await User.create({
      name: 'Pranav Admin',
      email: 'pranav2005@gmail.com',
      password: 'VP@2309',
      role: 'admin',
      department: 'Administration'
    });

    console.log('Admin user created successfully!');
    console.log('Email: pranav2005@gmail.com');
    console.log('Password: VP@2309');
    process.exit();
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
