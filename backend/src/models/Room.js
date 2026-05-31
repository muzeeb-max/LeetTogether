import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomName: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  hostId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  currentProblemId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  programmingLanguage: {
    type: DataTypes.ENUM('javascript', 'python', 'cpp', 'java'),
    defaultValue: 'javascript'
  }
}, {
  indexes: []  // Disable all auto-generated indexes
});

export default Room;