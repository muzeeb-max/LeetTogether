import { Op } from 'sequelize';
import { sequelize, User, FriendRequest, Notification } from '../models/index.js';
import { getIoInstance } from '../sockets/socketHandler.js';

// @desc    Get friends list of current user
// @route   GET /api/friends
// @access  Private
export const getFriends = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: User,
        as: 'Friends',
        attributes: ['id', 'username', 'avatar', 'status'],
        through: { attributes: [] }
      }]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user.Friends);
  } catch (error) {
    console.error('getFriends error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get incoming and outgoing friend requests
// @route   GET /api/friends/requests
// @access  Private
export const getFriendRequests = async (req, res) => {
  try {
    const incoming = await FriendRequest.findAll({
      where: { receiverId: req.user.id, status: 'pending' },
      include: [{ model: User, as: 'Sender', attributes: ['id', 'username', 'avatar', 'status'] }]
    });

    const outgoing = await FriendRequest.findAll({
      where: { senderId: req.user.id, status: 'pending' },
      include: [{ model: User, as: 'Receiver', attributes: ['id', 'username', 'avatar', 'status'] }]
    });

    return res.json({ incoming, outgoing });
  } catch (error) {
    console.error('getFriendRequests error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send a friend request by username
// @route   POST /api/friends/request
// @access  Private
export const sendFriendRequest = async (req, res) => {
  const { username } = req.body;

  try {
    if (!username) return res.status(400).json({ message: 'Username is required' });

    const receiver = await User.findOne({ where: { username } });
    if (!receiver) return res.status(404).json({ message: 'User not found' });

    if (receiver.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }

    // Check if already friends via join table
    const sender = await User.findByPk(req.user.id, {
      include: [{ model: User, as: 'Friends', attributes: ['id'], through: { attributes: [] } }]
    });
    const alreadyFriends = sender.Friends.some(f => f.id === receiver.id);
    if (alreadyFriends) {
      return res.status(400).json({ message: 'You are already friends with this user' });
    }

    // Check for existing request in either direction
    const existingRequest = await FriendRequest.findOne({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: req.user.id }
        ]
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'A pending friend request already exists' });
      }
      // Re-send if previously rejected
      await existingRequest.update({ senderId: req.user.id, receiverId: receiver.id, status: 'pending' });
    } else {
      await FriendRequest.create({ senderId: req.user.id, receiverId: receiver.id });
    }

    await Notification.create({
      recipientId: receiver.id,
      type: 'friend_request',
      senderId: req.user.id,
      senderUsername: req.user.username,
      message: `${req.user.username} sent you a friend request.`
    });

    // Emit socket event to recipient for real-time notification
    const io = getIoInstance();
    if (io) {
      const recipientSocketId = Array.from(io.sockets.sockets.values())
        .find(s => s.user && s.user.id === receiver.id)?.id;
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('friend:request-received', {
          notification: {
            id: Date.now().toString(),
            type: 'friend_request',
            senderId: req.user.id,
            senderUsername: req.user.username,
            message: `${req.user.username} sent you a friend request.`
          }
        });
      }
    }

    return res.status(201).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('sendFriendRequest error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Accept or reject a friend request
// @route   PUT /api/friends/request/:requestId
// @access  Private
export const respondFriendRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body;

  try {
    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "accept" or "reject"' });
    }

    const request = await FriendRequest.findByPk(requestId);
    if (!request) return res.status(404).json({ message: 'Friend request not found' });

    if (request.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'You can only respond to requests sent to you' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    if (action === 'reject') {
      await request.update({ status: 'rejected' });
      return res.json({ message: 'Friend request rejected' });
    }

    // Accept: update status and add bidirectional friendship in join table
    await request.update({ status: 'accepted' });

    const t = await sequelize.transaction();
    try {
      // Insert into Friendships join table both directions
      await sequelize.query(
        'INSERT IGNORE INTO Friendships (userId, friendId, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW()), (?, ?, NOW(), NOW())',
        { replacements: [request.senderId, request.receiverId, request.receiverId, request.senderId], transaction: t }
      );
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Clean up notification and send acceptance alert
    await Notification.destroy({ where: { recipientId: req.user.id, senderId: request.senderId, type: 'friend_request' } });
    await Notification.create({
      recipientId: request.senderId,
      type: 'system',
      senderId: req.user.id,
      senderUsername: req.user.username,
      message: `${req.user.username} accepted your friend request!`
    });

    return res.json({ message: 'Friend request accepted! You are now friends.' });
  } catch (error) {
    console.error('respondFriendRequest error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a friend
// @route   DELETE /api/friends/:friendId
// @access  Private
export const removeFriend = async (req, res) => {
  const { friendId } = req.params;

  try {
    // Remove both directions from join table
    await sequelize.query(
      'DELETE FROM Friendships WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)',
      { replacements: [req.user.id, friendId, friendId, req.user.id] }
    );

    // Clean up any pending requests
    await FriendRequest.destroy({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: friendId },
          { senderId: friendId, receiverId: req.user.id }
        ]
      }
    });

    return res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('removeFriend error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
