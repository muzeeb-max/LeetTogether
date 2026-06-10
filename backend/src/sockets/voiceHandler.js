/**
 * voiceHandler.js
 *
 * Isolated WebRTC signaling relay for LeetTogether voice chat.
 *
 * Responsibilities:
 *  - Track which users are in voice for each room (in-memory only, no DB)
 *  - Relay WebRTC SDP offers/answers and ICE candidates between peers
 *  - Broadcast voice:user-joined / voice:user-left when membership changes
 *
 * This file has ZERO coupling to existing room/chat/editor/auth logic.
 * It only ever touches events prefixed with "voice:" to prevent collisions.
 *
 * In-memory structure:
 *   voiceRooms: Map<roomId, Map<socketId, { socketId, userId, username }>>
 */

/**
 * Register all voice signaling socket events for a single connected socket.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server instance
 * @param {import('socket.io').Socket} socket - The authenticated socket for this connection
 * @param {Map} voiceRooms - Shared in-memory map: roomId -> Map<socketId, peerInfo>
 */
export function registerVoiceEvents(io, socket, voiceRooms) {
  const userId = socket.user.id.toString();
  const username = socket.user.username;

  // ─────────────────────────────────────────────────────────────────────────
  // voice:join
  // Client emits this after acquiring mic permission and entering a room.
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('voice:join', ({ roomId }) => {
    if (!roomId) return;

    // Initialize the room's voice map if first joiner
    if (!voiceRooms.has(roomId)) {
      voiceRooms.set(roomId, new Map());
    }

    const roomVoice = voiceRooms.get(roomId);

    // Guard: don't double-add same socket
    if (roomVoice.has(socket.id)) return;

    const peerInfo = { socketId: socket.id, userId, username };
    roomVoice.set(socket.id, peerInfo);

    // Tag socket so disconnect handler can find and clean the right room
    socket.voiceRoomId = roomId;

    console.log(`[Voice] ${username} joined voice in room ${roomId}. Peers: ${roomVoice.size}`);

    // Send the new user the list of ALL existing voice peers in this room
    // (excluding themselves) so they can initiate offers to each one.
    const existingPeers = [];
    roomVoice.forEach((peer, sid) => {
      if (sid !== socket.id) {
        existingPeers.push(peer);
      }
    });

    socket.emit('voice:room-users', { users: existingPeers });

    // Notify every existing peer that a new user has joined voice
    roomVoice.forEach((peer, sid) => {
      if (sid !== socket.id) {
        io.to(sid).emit('voice:user-joined', peerInfo);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // voice:leave
  // Client emits this on explicit leave (unmounting RoomView or leaving room).
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('voice:leave', () => {
    removeFromVoiceRoom(socket, voiceRooms, io);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // voice:offer
  // Relay an SDP offer from the sender to a specific target peer socket.
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('voice:offer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('voice:offer', { from: socket.id, sdp });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // voice:answer
  // Relay an SDP answer from the answerer back to the offerer.
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('voice:answer', ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit('voice:answer', { from: socket.id, sdp });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // voice:ice-candidate
  // Relay ICE candidate between peers during connection negotiation.
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('voice:ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;
    io.to(to).emit('voice:ice-candidate', { from: socket.id, candidate });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // disconnect hook
  // The main socketHandler also handles disconnect; we hook in here purely
  // to clean voice state. This is safe because multiple listeners on
  // 'disconnect' are allowed and each runs independently.
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    removeFromVoiceRoom(socket, voiceRooms, io);
  });
}

/**
 * Helper: remove a socket from its voice room and broadcast voice:user-left.
 * Safe to call multiple times — idempotent.
 */
function removeFromVoiceRoom(socket, voiceRooms, io) {
  const roomId = socket.voiceRoomId;
  if (!roomId) return;

  const roomVoice = voiceRooms.get(roomId);
  if (!roomVoice) return;

  if (!roomVoice.has(socket.id)) return; // already removed

  roomVoice.delete(socket.id);
  socket.voiceRoomId = null;

  console.log(`[Voice] ${socket.user?.username} left voice in room ${roomId}. Remaining: ${roomVoice.size}`);

  // Broadcast to remaining peers so they can close that RTCPeerConnection
  roomVoice.forEach((peer, sid) => {
    io.to(sid).emit('voice:user-left', { socketId: socket.id });
  });

  // Clean up empty room maps to prevent memory growth
  if (roomVoice.size === 0) {
    voiceRooms.delete(roomId);
  }
}
