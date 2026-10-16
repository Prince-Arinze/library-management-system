import dotenv from 'dotenv';
import { connectDB } from './src/config/dbConnection.js';
import User from './src/models/userModel.js';

dotenv.config();

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || !email || !password) {
  console.error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before creating the admin account.');
  process.exit(1);
}

try {
  await connectDB();

  const superAdminExists = await User.findOne({ role: 'superAdmin' });
  if (superAdminExists) {
    console.log('superAdmin already exists');
    process.exit();
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.role !== 'admin') {
      console.error('The configured email belongs to a non-admin account.');
      process.exit(1);
    }

    existingUser.role = 'superAdmin';
    await existingUser.save();
    console.log('superAdmin promoted:', existingUser.email);
    process.exit();
  }

  const superAdmin = await User.create({
    name,
    email,
    password,
    role: 'superAdmin'
  });

  console.log('superAdmin created:', superAdmin.email);
  process.exit();
} catch (err) {
  console.error(err);
  process.exit(1);
}