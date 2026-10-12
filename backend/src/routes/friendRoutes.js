import express from 'express';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend
} from '../controllers/friendController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All friend endpoints are protected

router.get('/', getFriends);
router.get('/requests', getFriendRequests);
router.post('/request', sendFriendRequest);
router.put('/request/:requestId', respondFriendRequest);
router.delete('/:friendId', removeFriend);

export default router;
