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
        if (state.currentTrack && estimatedPosition > state.currentTrack.duration) {
          estimatedPosition = state.currentTrack.duration;
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
        playlist: [],
        currentIndex: 0,
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
  socket.on('music:track-change', ({ roomId, track, index }) => {
    const state = roomMusicStates.get(roomId) || {};
    state.currentTrack = track; // track = { videoId, title, channel, thumbnail, duration }
    state.currentPosition = 0;
    state.isPlaying = true;
    state.currentIndex = index ?? 0;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // When the host adds a track to playlist
  socket.on('music:add-to-playlist', ({ roomId, track }) => {
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    state.playlist.push(track);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
  });

  // When the host removes a track from playlist
  socket.on('music:remove-from-playlist', ({ roomId, index }) => {
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    state.playlist.splice(index, 1);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
  });

  // When the host reorders playlist
  socket.on('music:reorder-playlist', ({ roomId, fromIndex, toIndex }) => {
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    const [movedTrack] = state.playlist.splice(fromIndex, 1);
    state.playlist.splice(toIndex, 0, movedTrack);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
  });

  // When track ends, auto-play next
  socket.on('music:track-ended', ({ roomId }) => {
    const state = roomMusicStates.get(roomId);
    if (!state || !state.playlist.length) return;

    const nextIndex = (state.currentIndex + 1) % state.playlist.length;
    const nextTrack = state.playlist[nextIndex];

    state.currentTrack = nextTrack;
    state.currentPosition = 0;
    state.isPlaying = true;
    state.currentIndex = nextIndex;
    state.lastUpdated = Date.now();
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:sync-state', state);
  });

  // Leave event to clear socket group
  socket.on('music:leave', () => {
    if (socket.musicRoomId) {
      socket.leave(`music-${socket.musicRoomId}`);
      socket.musicRoomId = null;
    }
  });
};
