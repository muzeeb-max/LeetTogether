// In-memory room music states map: roomId -> roomMusicState
const roomMusicStates = new Map();

export const registerMusicEvents = (io, socket) => {
  // When a user joins the room's music session
  socket.on('music:join', ({ roomId }) => {
    socket.join(`music-${roomId}`);
    socket.musicRoomId = roomId;

    const state = roomMusicStates.get(roomId);
    if (state) {
      // Calculate estimated track position for late joiner
      let estimatedPosition = state.currentPosition;
      if (state.isPlaying && state.lastUpdated) {
        estimatedPosition += Date.now() - state.lastUpdated;
        if (state.currentTrack && estimatedPosition > state.currentTrack.durationMs) {
          estimatedPosition = state.currentTrack.durationMs;
        }
      }

      socket.emit('music:sync-state', {
        ...state,
        currentPosition: estimatedPosition
      });
    } else {
      // Initialize room music state
      const newState = {
        currentTrack: null,
        currentPosition: 0,
        isPlaying: false,
        hostController: null,
        lastUpdated: Date.now()
      };
      roomMusicStates.set(roomId, newState);
      socket.emit('music:sync-state', newState);
    }
  });

  // When the host triggers play
  socket.on('music:play', ({ roomId, position }) => {
    const state = roomMusicStates.get(roomId) || {};
    state.isPlaying = true;
    state.currentPosition = position ?? state.currentPosition;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // When the host triggers pause
  socket.on('music:pause', ({ roomId, position }) => {
    const state = roomMusicStates.get(roomId) || {};
    state.isPlaying = false;
    state.currentPosition = position ?? state.currentPosition;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // When the host seeks
  socket.on('music:seek', ({ roomId, position }) => {
    const state = roomMusicStates.get(roomId) || {};
    state.currentPosition = position;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // When the host changes the track
  socket.on('music:track-change', ({ roomId, track }) => {
    const state = roomMusicStates.get(roomId) || {};
    state.currentTrack = track; // track = { id, name, artists, albumCover, durationMs }
    state.currentPosition = 0;
    state.isPlaying = true;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // Leave event to clear socket group
  socket.on('music:leave', () => {
    if (socket.musicRoomId) {
      socket.leave(`music-${socket.musicRoomId}`);
      socket.musicRoomId = null;
    }
  });
};
