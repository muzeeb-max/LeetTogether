import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  languageUsed: {
    type: DataTypes.ENUM('javascript', 'python', 'cpp', 'java'),
    allowNull: false
  },
  timeSpentSeconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  completedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

export default Session;
