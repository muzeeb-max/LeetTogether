import express from 'express';
import { getLoginUrl, handleCallback, getSpotifyToken, disconnectSpotify } from '../controllers/spotifyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/login', protect, getLoginUrl);
router.post('/callback', protect, handleCallback);
router.get('/token', protect, getSpotifyToken);
router.post('/disconnect', protect, disconnectSpotify);

export default router;
