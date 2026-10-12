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
  otherKey: 'friendId' 
});

// 2. FriendRequest (Direct associations linking sender and receiver)
FriendRequest.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'CASCADE' });
FriendRequest.belongsTo(User, { as: 'Receiver', foreignKey: 'receiverId', onDelete: 'CASCADE' });
User.hasMany(FriendRequest, { as: 'SentRequests', foreignKey: 'senderId' });
User.hasMany(FriendRequest, { as: 'ReceivedRequests', foreignKey: 'receiverId' });

// 3. Problem Associations
// Problems are independent, but sessions log solved problems
Session.belongsTo(Problem, { as: 'ProblemSolved', foreignKey: 'problemSolvedId', onDelete: 'SET NULL' });
Problem.hasMany(Session, { foreignKey: 'problemSolvedId' });

// 4. Room Associations
Room.belongsTo(User, { as: 'Host', foreignKey: 'hostId', onDelete: 'CASCADE' });
Room.belongsTo(Problem, { as: 'CurrentProblem', foreignKey: 'currentProblemId', onDelete: 'CASCADE' });

// Room Participants (Many-To-Many Join Table RoomParticipants)
Room.belongsToMany(User, { 
  as: 'Participants', 
  through: 'RoomParticipants', 
  foreignKey: 'roomId', 
  otherKey: 'userId' 
});
User.belongsToMany(Room, { 
  through: 'RoomParticipants', 
  foreignKey: 'userId', 
  otherKey: 'roomId' 
});

// 5. Message Associations
Message.belongsTo(Room, { foreignKey: 'roomId', onDelete: 'CASCADE' });
Room.hasMany(Message, { foreignKey: 'roomId', onDelete: 'CASCADE' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'SET NULL' });

// 6. Notification Associations
Notification.belongsTo(User, { as: 'Recipient', foreignKey: 'recipientId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { as: 'Sender', foreignKey: 'senderId', onDelete: 'CASCADE' });
User.hasMany(Notification, { foreignKey: 'recipientId' });

// 7. Session Associations
Session.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(Session, { foreignKey: 'userId' });

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
