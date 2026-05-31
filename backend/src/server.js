import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { sequelize } from './models/index.js';
import socketHandler from './sockets/socketHandler.js';
import { corsOptions } from './config/security.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Verify MySQL connection
    await connectDB();

    // 2. Sync all Sequelize models to MySQL (creates/alters tables automatically)
    await sequelize.sync();
    console.log('All Sequelize models synchronized to MySQL database tables.');

    // 3. Create HTTP + Socket.IO server
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: corsOptions,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    socketHandler(io);

    // 4. Start listening
    server.listen(PORT, () => {
      console.log('====================================================');
      console.log(`LeetTogether Backend | ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`Server active on Port: ${PORT}`);
      console.log(`Database: MySQL (${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME})`);
      console.log(`CORS origin: ${corsOptions.origin}`);
      console.log('====================================================');
    });

    process.on('unhandledRejection', (err) => {
      console.error(`Unhandled Rejection: ${err.message}`);
    });

    process.on('uncaughtException', (err) => {
      console.error(`Uncaught Exception: ${err.message}`);
    });

  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
