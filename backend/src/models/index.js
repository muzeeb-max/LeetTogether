import sequelize from '../config/db.js';
import User from './User.js';
import FriendRequest from './FriendRequest.js';
import Problem from './Problem.js';
import Room from './Room.js';
import Message from './Message.js';
import Notification from './Notification.js';
import Session from './Session.js';

// ============================================
// DATABASE RELATIONSHIPS & SQL JOIN ASSOCIATIONS
// ============================================

// 1. Friendship (Self-Referential Many-To-Many Join Table)
User.belongsToMany(User, { 
  as: 'Friends', 
  through: 'Friendships', 
  foreignKey: 'userId', 
  otherKey: 'friendId',
  indexes: false
});

// 2. FriendRequest
FriendRequest.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'CASCADE', constraints: false });
FriendRequest.belongsTo(User, { as: 'Receiver', foreignKey: 'receiverId', onDelete: 'CASCADE', constraints: false });
User.hasMany(FriendRequest, { as: 'SentRequests', foreignKey: 'senderId', constraints: false });
User.hasMany(FriendRequest, { as: 'ReceivedRequests', foreignKey: 'receiverId', constraints: false });

// 3. Problem Associations
Session.belongsTo(Problem, { as: 'ProblemSolved', foreignKey: 'problemSolvedId', onDelete: 'SET NULL', constraints: false });
Problem.hasMany(Session, { foreignKey: 'problemSolvedId', constraints: false });

// 4. Room Associations
Room.belongsTo(User, { as: 'Host', foreignKey: 'hostId', onDelete: 'CASCADE', constraints: false });
Room.belongsTo(Problem, { as: 'CurrentProblem', foreignKey: 'currentProblemId', onDelete: 'CASCADE', constraints: false });

// Room Participants (Many-To-Many)
Room.belongsToMany(User, { 
  as: 'Participants', 
  through: 'RoomParticipants', 
  foreignKey: 'roomId', 
  otherKey: 'userId',
  indexes: false
});
User.belongsToMany(Room, { 
  through: 'RoomParticipants', 
  foreignKey: 'userId', 
  otherKey: 'roomId',
  indexes: false
});

// 5. Message Associations
Message.belongsTo(Room, { foreignKey: 'roomId', onDelete: 'CASCADE', constraints: false });
Room.hasMany(Message, { foreignKey: 'roomId', onDelete: 'CASCADE', constraints: false });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'SET NULL', constraints: false });

// 6. Notification Associations
Notification.belongsTo(User, { as: 'Recipient', foreignKey: 'recipientId', onDelete: 'CASCADE', constraints: false });
Notification.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'CASCADE', constraints: false });
User.hasMany(Notification, { foreignKey: 'recipientId', constraints: false });

// 7. Session Associations
Session.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE', constraints: false });
User.hasMany(Session, { foreignKey: 'userId', constraints: false });

export {
  sequelize,
  User,
  FriendRequest,
  Problem,
  Room,
  Message,
  Notification,
  Session
};