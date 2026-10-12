import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token is missing' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_secure_key_for_leettogether_jwt_auth_12345'
    );

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ message: 'No user found with these credentials' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Auth Middleware error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token is invalid' });
  }
};
