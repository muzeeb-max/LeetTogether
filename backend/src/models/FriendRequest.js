import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const FriendRequest = sequelize.define('FriendRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['senderId', 'receiverId']
    }
  ]
});

export default FriendRequest;
