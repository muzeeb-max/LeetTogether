import express from 'express';
import { getUserProfile, searchUsers } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile/:username', protect, getUserProfile);
router.get('/search', protect, searchUsers);

export default router;
