import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/db.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 20],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: 'https://api.dicebear.com/7.x/bottts/svg?seed=default'
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'in-room'),
    defaultValue: 'offline'
  },
  problemsSolved: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  easySolved: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  mediumSolved: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  hardSolved: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sessionsCreated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  timeSpentCoding: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // In seconds
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
      if (user.username) {
        user.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Compare password method
User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default User;
