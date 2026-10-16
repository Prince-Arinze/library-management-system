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

  const adminExists = await User.findOne({ email });
  if (adminExists) {
    console.log('Admin already exists');
    process.exit();
  }

  const admin = await User.create({
    name,
    email,
    password,
    role: 'admin'
  });

  console.log('ADMIN CREATED:', admin.email);
  process.exit();
} catch (err) {
  console.error(err);
  process.exit(1);
}