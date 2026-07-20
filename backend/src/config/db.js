import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Centralized Sequelize instance configured for MySQL
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: false,

    dialectOptions: {
      ssl: {
        rejectUnauthorized: true
      }
    },

    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Database Connected successfully via Sequelize ORM.');
  } catch (error) {
    console.error('MySQL connection error occurred:', error.message);
    process.exit(1);
  }
};

export default sequelize;
