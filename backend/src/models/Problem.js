import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Problem = sequelize.define('Problem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  examples: {
    type: DataTypes.JSON, // Array of { input, output, explanation }
    allowNull: true
  },
  constraints: {
    type: DataTypes.JSON, // Array of strings
    allowNull: true
  },
  starterCode: {
    type: DataTypes.JSON, // Array of { language, code }
    allowNull: false
  },
  testCases: {
    type: DataTypes.JSON, // Array of { input, expectedOutput, isPrivate }
    allowNull: false
  }
}, {
  hooks: {
    beforeValidate: (problem) => {
      if (problem.title && !problem.slug) {
        problem.slug = problem.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }
    }
  }
});

export default Problem;
