import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me',protect, getMe);
router.post('/register', protect, authorize('admin'), register);

export default router;