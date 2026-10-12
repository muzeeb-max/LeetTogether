import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'super_secret_secure_key_for_leettogether_jwt_auth_12345',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please fill in all fields' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailExists = await User.findOne({ where: { email } });
    if (emailExists) return res.status(400).json({ message: 'Email already registered' });

    const usernameExists = await User.findOne({ where: { username } });
    if (usernameExists) return res.status(400).json({ message: 'Username is already taken' });

    const user = await User.create({ username, email, password });

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json({ message: 'Server error, please try again' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // Update status to online
    await user.update({ status: 'online' });

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      stats: {
        problemsSolved: user.problemsSolved,
        easySolved: user.easySolved,
        mediumSolved: user.mediumSolved,
        hardSolved: user.hardSolved,
        sessionsCreated: user.sessionsCreated,
        timeSpentCoding: user.timeSpentCoding
      },
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json({ message: 'Server error, please try again' });
  }
};

// @desc    Get current user profile from token
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('getMe error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
