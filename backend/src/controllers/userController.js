import { Op } from 'sequelize';
import { User, Session, Problem, FriendRequest } from '../models/index.js';

// @desc    Get user profile by username
// @route   GET /api/users/profile/:username
// @access  Private
export const getUserProfile = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({
      where: { username },
      attributes: { exclude: ['password'] },
      include: [
        {
          model: User,
          as: 'Friends',
          attributes: ['id', 'username', 'avatar', 'status'],
          through: { attributes: [] }
        }
      ]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const sessions = await Session.findAll({
      where: { userId: user.id },
      include: [
        {
          model: Problem,
          as: 'ProblemSolved',
          attributes: ['title', 'difficulty'],
          required: false
        }
      ],
      order: [['completedAt', 'DESC']],
      limit: 10
    });

    return res.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      status: user.status,
      stats: {
        problemsSolved: user.problemsSolved,
        easySolved: user.easySolved,
        mediumSolved: user.mediumSolved,
        hardSolved: user.hardSolved,
        sessionsCreated: user.sessionsCreated,
        timeSpentCoding: user.timeSpentCoding
      },
      friends: user.Friends,
      recentSessions: sessions,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('getUserProfile error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Search users by partial username
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
  const query = req.query.username;

  try {
    if (!query) return res.status(400).json({ message: 'Query parameter "username" is required' });

    const users = await User.findAll({
      where: {
        username: { [Op.like]: `%${query}%` },
        id: { [Op.ne]: req.user.id }
      },
      attributes: ['id', 'username', 'avatar', 'status'],
      limit: 10
    });

    return res.json(users);
  } catch (error) {
    console.error('searchUsers error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
