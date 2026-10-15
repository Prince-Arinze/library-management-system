import dotenv from 'dotenv';
import connectDB from './src/Config/db.js'
import User from './Models/userModel.js';

dotenv.config();
await connectDB();

try {
  const adminExists = await User.findOne({ email: 'admin@mealmate.com' });
  if (adminExists) {
    console.log('Admin already exists');
    process.exit();
  }

  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@mealmate.com',
    password: 'Admin123!',
    role: 'admin' // This works here because we are bypassing the controller check
  });

  console.log('ADMIN CREATED:', admin.email);
  process.exit();
} catch (err) {
  console.error(err);
  process.exit(1);
}