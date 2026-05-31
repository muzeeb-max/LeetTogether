import jwt from 'jsonwebtoken';
import { sequelize, User, Room, Problem, Message, Notification, FriendRequest } from '../models/index.js';

// In-memory userId -> socketId map
const userSocketMap = new Map();

// Helper: fetch friends who are currently online
const getOnlineFriendSockets = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: User, as: 'Friends', attributes: ['id'], through: { attributes: [] } }]
  });
  if (!user) return [];
  return user.Friends
    .map(f => ({ id: f.id.toString(), socketId: userSocketMap.get(f.id.toString()) }))
    .filter(f => f.socketId);
};

// Helper: get full populated room as plain JSON object
const getPopulatedRoom = async (roomId) => {
  const room = await Room.findOne({
    where: { roomId },
    include: [
      { model: User, as: 'Host', attributes: ['id', 'username', 'avatar'] },
      { model: User, as: 'Participants', attributes: ['id', 'username', 'avatar', 'status'], through: { attributes: [] } },
      { model: Problem, as: 'CurrentProblem' }
    ]
  });

  if (!room) return null;

  // Convert Sequelize model to plain JSON with consistent property names
  const plainRoom = room.toJSON();

  return {
    id: plainRoom.id,
    roomId: plainRoom.roomId,
    roomName: plainRoom.roomName,
    hostId: plainRoom.hostId,
    currentProblemId: plainRoom.currentProblemId,
    programmingLanguage: plainRoom.programmingLanguage,
    host: plainRoom.Host,
    participants: plainRoom.Participants || [],
    currentProblem: plainRoom.CurrentProblem || null
  };
};

export default (io) => {
  // Socket.IO JWT Authentication Middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error: Token missing'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_secure_key_for_leettogether_jwt_auth_12345');
      const user = await User.findByPk(decoded.id, { attributes: ['id', 'username', 'avatar', 'status'] });
      if (!user) return next(new Error('Authentication error: User not found'));
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id.toString();
    const username = socket.user.username;

    console.log(`Socket Connected: "${username}" (${userId})`);
    userSocketMap.set(userId, socket.id);

    // Mark user online
    try {
      await User.update({ status: 'online' }, { where: { id: userId } });
      const onlineFriends = await getOnlineFriendSockets(userId);
      onlineFriends.forEach(({ socketId }) => {
        io.to(socketId).emit('friend:status-change', { userId, username, status: 'online' });
      });
    } catch (err) {
      console.error('presence update error:', err.message);
    }

    // ============================================
    // ROOM EVENTS
    // ============================================

    socket.on('room:join', async ({ roomId, roomName, problemId }) => {
      console.log(`[socketHandler] room:join received from ${username}:`, { roomId, roomName, problemId });
      try {
        socket.join(roomId);
        socket.roomId = roomId;

        let room = await Room.findOne({ where: { roomId } });
        console.log(`[socketHandler] Room lookup:`, room ? `Found room ${room.roomName}` : 'Room not found');

        if (!room) {
          // Get first problem as fallback
          let pid = problemId;
          console.log(`[socketHandler] Initial problemId:`, pid);
          if (!pid) {
            const firstProblem = await Problem.findOne({ order: [['id', 'ASC']] });
            pid = firstProblem?.id;
            console.log(`[socketHandler] Using first problem as fallback, pid:`, pid);
          }
          room = await Room.create({
            roomName: roomName || `${username}'s Room`,
            roomId,
            hostId: userId,
            currentProblemId: pid,
            programmingLanguage: 'javascript'
          });
          console.log(`[socketHandler] Created new room with currentProblemId:`, room.currentProblemId);
        }

        // Add participant to join table (INSERT IGNORE handles duplicates)
        await sequelize.query(
          'INSERT IGNORE INTO RoomParticipants (roomId, userId, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
          { replacements: [room.id, userId] }
        );

        await User.update({ status: 'in-room' }, { where: { id: userId } });

        const populatedRoom = await getPopulatedRoom(roomId);
        console.log(`[socketHandler] Populated room - currentProblem:`, populatedRoom.CurrentProblem ? populatedRoom.CurrentProblem.title : 'NULL', 'id:', populatedRoom.CurrentProblem?.id);

        socket.to(roomId).emit('room:user-joined', {
          user: { id: userId, username, avatar: socket.user.avatar, status: 'in-room' },
          message: `${username} joined the coding workspace.`
        });

        // Notify friends of status change
        const onlineFriends = await getOnlineFriendSockets(userId);
        onlineFriends.forEach(({ socketId }) => {
          io.to(socketId).emit('friend:status-change', { userId, username, status: 'in-room' });
        });

        console.log(`[socketHandler] Emitting room:sync-state`);
        socket.emit('room:sync-state', { room: populatedRoom });

        // System chat message
        const sysMsg = await Message.create({
          roomId: room.id,
          senderUsername: 'System',
          text: `${username} joined the room.`,
          isSystemMessage: true
        });
        io.to(roomId).emit('chat:message', sysMsg);

      }catch (error) {
  console.error('room:join FULL ERROR:', error);

  if (error.errors) {
    error.errors.forEach(err => {
      console.error('Validation:', err.message);
    });
  }
}
    });

    socket.on('room:leave', async () => {
      await handleLeaveRoom(socket, io, userSocketMap, getOnlineFriendSockets);
    });

    socket.on('room:kick', async ({ userIdToKick }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      try {
        const room = await Room.findOne({ where: { roomId } });
        if (!room || room.hostId.toString() !== userId) {
          return socket.emit('error', { message: 'Only the host can remove participants' });
        }

        await sequelize.query(
          'DELETE FROM RoomParticipants WHERE roomId = ? AND userId = ?',
          { replacements: [room.id, userIdToKick] }
        );

        const kickedUser = await User.findByPk(userIdToKick, { attributes: ['username'] });
        if (kickedUser) {
          const sysMsg = await Message.create({
            roomId: room.id,
            senderUsername: 'System',
            text: `${kickedUser.username} was removed by the host.`,
            isSystemMessage: true
          });
          io.to(roomId).emit('chat:message', sysMsg);
        }

        const kickedSocketId = userSocketMap.get(userIdToKick.toString());
        if (kickedSocketId) io.to(kickedSocketId).emit('room:kicked-alert');

        const updatedRoom = await getPopulatedRoom(roomId);
        io.to(roomId).emit('room:sync-state', { room: updatedRoom });

      } catch (err) {
        console.error('room:kick error:', err.message);
      }
    });

    socket.on('room:change-problem', async ({ problemId }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      try {
        const room = await Room.findOne({ where: { roomId } });
        if (!room || room.hostId.toString() !== userId) {
          return socket.emit('error', { message: 'Only the host can change the problem' });
        }

        const problem = await Problem.findByPk(problemId);
        if (!problem) return;

        await room.update({ currentProblemId: problemId });

        const populatedRoom = await getPopulatedRoom(roomId);
        io.to(roomId).emit('room:problem-changed', { room: populatedRoom, problem });

        const sysMsg = await Message.create({
          roomId: room.id,
          senderUsername: 'System',
          text: `Host changed problem to "${problem.title}".`,
          isSystemMessage: true
        });
        io.to(roomId).emit('chat:message', sysMsg);

      } catch (err) {
        console.error('room:change-problem error:', err.message);
      }
    });

    socket.on('room:change-language', async ({ language }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      try {
        const room = await Room.findOne({ where: { roomId } });
        if (!room || room.hostId.toString() !== userId) {
          return socket.emit('error', { message: 'Only the host can change the language' });
        }

        await room.update({ programmingLanguage: language });
        io.to(roomId).emit('room:language-changed', { language });

        const sysMsg = await Message.create({
          roomId: room.id,
          senderUsername: 'System',
          text: `Programming language switched to ${language.toUpperCase()}.`,
          isSystemMessage: true
        });
        io.to(roomId).emit('chat:message', sysMsg);

      } catch (err) {
        console.error('room:change-language error:', err.message);
      }
    });

    // ============================================
    // EDITOR SYNC EVENTS
    // ============================================

    socket.on('editor:code-change', ({ code }) => {
      if (socket.roomId) socket.to(socket.roomId).emit('editor:code-change', { code, username });
    });

    socket.on('editor:cursor-change', ({ cursor, selection }) => {
      if (socket.roomId) socket.to(socket.roomId).emit('editor:cursor-change', { userId, username, cursor, selection });
    });

    socket.on('editor:typing', () => {
      if (socket.roomId) socket.to(socket.roomId).emit('editor:typing', { username });
    });

    // ============================================
    // CHAT EVENTS
    // ============================================

    socket.on('chat:message', async ({ text }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      try {
        const room = await Room.findOne({ where: { roomId } });
        if (!room) return;

        const message = await Message.create({
          roomId: room.id,
          senderId: userId,
          senderUsername: username,
          text
        });

        io.to(roomId).emit('chat:message', message);
      } catch (err) {
        console.error('chat:message error:', err.message);
      }
    });

    // ============================================
    // INVITE EVENTS
    // ============================================

    socket.on('invite:send', async ({ friendId }) => {
      const roomId = socket.roomId;
      if (!roomId) return socket.emit('error', { message: 'Must be in a room to invite friends' });

      try {
        const room = await Room.findOne({ where: { roomId } });
        if (!room) return;

        const recipientSocketId = userSocketMap.get(friendId.toString());
        if (!recipientSocketId) {
          return socket.emit('error', { message: 'Friend is currently offline' });
        }

        const notification = await Notification.create({
          recipientId: friendId,
          type: 'room_invitation',
          senderId: userId,
          senderUsername: username,
          message: `${username} invited you to join room "${room.roomName}".`,
          roomId
        });

        io.to(recipientSocketId).emit('invite:received', {
          notification,
          senderUsername: username,
          roomName: room.roomName,
          roomId
        });

        socket.emit('invite:sent-success', { message: 'Invitation sent!' });
      } catch (err) {
        console.error('invite:send error:', err.message);
      }
    });

    // ============================================
    // DISCONNECT
    // ============================================

    socket.on('disconnect', async () => {
      console.log(`Socket Disconnected: "${username}" (${userId})`);

      if (socket.roomId) {
        await handleLeaveRoom(socket, io, userSocketMap, getOnlineFriendSockets);
      }

      userSocketMap.delete(userId);

      try {
        await User.update({ status: 'offline' }, { where: { id: userId } });
        const onlineFriends = await getOnlineFriendSockets(userId);
        onlineFriends.forEach(({ socketId }) => {
          io.to(socketId).emit('friend:status-change', { userId, username, status: 'offline' });
        });
      } catch (err) {
        console.error('disconnect presence error:', err.message);
      }
    });
  });
};

// ============================================
// HELPER: Leave Room Logic
// ============================================

const handleLeaveRoom = async (socket, io, userSocketMap, getOnlineFriendSockets) => {
  const roomId = socket.roomId;
  if (!roomId) return;

  const userId = socket.user.id.toString();
  const username = socket.user.username;

  try {
    const room = await Room.findOne({ where: { roomId } });
    if (!room) return;

    // Remove from participants join table
    await sequelize.query(
      'DELETE FROM RoomParticipants WHERE roomId = ? AND userId = ?',
      { replacements: [room.id, userId] }
    );

    const sysMsg = await Message.create({
      roomId: room.id,
      senderUsername: 'System',
      text: `${username} left the room.`,
      isSystemMessage: true
    });
    io.to(roomId).emit('chat:message', sysMsg);

    // Check remaining participants
    const [participantRows] = await sequelize.query(
      'SELECT userId FROM RoomParticipants WHERE roomId = ?',
      { replacements: [room.id] }
    );

    if (participantRows.length === 0) {
      // Empty room: delete room and its messages
      await Message.destroy({ where: { roomId: room.id } });
      await Room.destroy({ where: { id: room.id } });
      console.log(`Empty room ${roomId} deleted from MySQL.`);
    } else {
      // Transfer host if needed
      if (room.hostId.toString() === userId) {
        const nextHostId = participantRows[0].userId;
        await room.update({ hostId: nextHostId });
        const nextHostUser = await User.findByPk(nextHostId, { attributes: ['username'] });
        const hostMsg = await Message.create({
          roomId: room.id,
          senderUsername: 'System',
          text: `${nextHostUser?.username || 'A participant'} is now the host.`,
          isSystemMessage: true
        });
        io.to(roomId).emit('chat:message', hostMsg);
      }

      const updatedRoom = await Room.findOne({
        where: { roomId },
        include: [
          { model: User, as: 'Host', attributes: ['id', 'username', 'avatar'] },
          { model: User, as: 'Participants', attributes: ['id', 'username', 'avatar', 'status'], through: { attributes: [] } },
          { model: Problem, as: 'CurrentProblem' }
        ]
      });
      socket.to(roomId).emit('room:sync-state', { room: updatedRoom });
      socket.to(roomId).emit('room:user-left', { userId, username });
    }

    await User.update({ status: 'online' }, { where: { id: userId } });

    const onlineFriends = await getOnlineFriendSockets(userId);
    onlineFriends.forEach(({ socketId }) => {
      io.to(socketId).emit('friend:status-change', { userId, username, status: 'online' });
    });

    socket.leave(roomId);
    socket.roomId = null;

  } catch (err) {
    console.error('handleLeaveRoom error:', err.message);
  }
};
