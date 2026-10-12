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
  programmingLanguage: {
    type: DataTypes.ENUM('javascript', 'python', 'cpp', 'java'),
    defaultValue: 'javascript'
  }
});

export default Room;
