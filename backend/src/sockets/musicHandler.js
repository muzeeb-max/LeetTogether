// In-memory room music states map: roomId -> roomMusicState
const roomMusicStates = new Map();

export const registerMusicEvents = (io, socket) => {
  // When a user joins the room's music session
  socket.on('music:join', ({ roomId }) => {
    console.log('[MUSIC-SYNC] User joined music session:', socket.user?.username, 'roomId:', roomId);
    socket.join(`music-${roomId}`);
    socket.musicRoomId = roomId;

    const state = roomMusicStates.get(roomId);
    if (state) {
      console.log('[MUSIC-SYNC] Existing state found, syncing to late joiner:', {
        hasTrack: !!state.currentTrack,
        isPlaying: state.isPlaying,
        position: state.currentPosition,
        playlistLength: state.playlist.length
      });
      // Calculate estimated track position for late joiner
      let estimatedPosition = state.currentPosition;
      if (state.isPlaying && state.lastUpdated) {
        // Date.now() - lastUpdated is in ms; currentPosition is in seconds → divide by 1000
        estimatedPosition += (Date.now() - state.lastUpdated) / 1000;
        if (state.currentTrack && estimatedPosition > state.currentTrack.duration) {
          estimatedPosition = state.currentTrack.duration;
        }
      }

      socket.emit('music:sync-state', {
        ...state,
        currentPosition: estimatedPosition
      });
      console.log('[MUSIC-SYNC] Sent sync-state with estimated position:', estimatedPosition.toFixed(2));
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
      console.log('[MUSIC-SYNC] Initialized new room state for:', roomId);
    }
  });

  // When the host triggers play
  socket.on('music:play', ({ roomId, position }) => {
    console.log('[MUSIC-SYNC] Host triggered play:', socket.user?.username, 'position:', position);
    const state = roomMusicStates.get(roomId) || {};
    state.isPlaying = true;
    state.currentPosition = position ?? state.currentPosition;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
    console.log('[MUSIC-SYNC] Broadcasted play to room:', roomId);
  });

  // When the host triggers pause
  socket.on('music:pause', ({ roomId, position }) => {
    console.log('[MUSIC-SYNC] Host triggered pause:', socket.user?.username, 'position:', position);
    const state = roomMusicStates.get(roomId) || {};
    state.isPlaying = false;
    state.currentPosition = position ?? state.currentPosition;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
    console.log('[MUSIC-SYNC] Broadcasted pause to room:', roomId);
  });

  // When the host seeks
  socket.on('music:seek', ({ roomId, position }) => {
    console.log('[MUSIC-SYNC] Host triggered seek:', socket.user?.username, 'position:', position);
    const state = roomMusicStates.get(roomId) || {};
    state.currentPosition = position;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
    console.log('[MUSIC-SYNC] Broadcasted seek to room:', roomId);
  });

  // When the host changes the track
  socket.on('music:track-change', ({ roomId, track, index }) => {
    console.log('[MUSIC-SYNC] Host changed track:', socket.user?.username, 'track:', track.title, 'index:', index);
    const state = roomMusicStates.get(roomId) || {};
    state.currentTrack = track; // track = { videoId, title, channel, thumbnail, duration }
    state.currentPosition = 0;
    state.isPlaying = true;
    state.currentIndex = index ?? 0;
    state.lastUpdated = Date.now();
    state.hostController = socket.user.id.toString();
    roomMusicStates.set(roomId, state);

    socket.to(`music-${roomId}`).emit('music:sync-state', state);
    console.log('[MUSIC-SYNC] Broadcasted track change to room:', roomId);
  });

  // When the host adds a track to playlist
  socket.on('music:add-to-playlist', ({ roomId, track }) => {
    console.log('[MUSIC-SYNC] Host added to playlist:', socket.user?.username, 'track:', track.title);
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    state.playlist.push(track);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
    console.log('[MUSIC-SYNC] Broadcasted playlist update to room:', roomId, 'total:', state.playlist.length);
  });

  // When the host removes a track from playlist
  socket.on('music:remove-from-playlist', ({ roomId, index }) => {
    console.log('[MUSIC-SYNC] Host removed from playlist:', socket.user?.username, 'index:', index);
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    state.playlist.splice(index, 1);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
    console.log('[MUSIC-SYNC] Broadcasted playlist update to room:', roomId, 'total:', state.playlist.length);
  });

  // When the host reorders playlist
  socket.on('music:reorder-playlist', ({ roomId, fromIndex, toIndex }) => {
    console.log('[MUSIC-SYNC] Host reordered playlist:', socket.user?.username, 'from:', fromIndex, 'to:', toIndex);
    const state = roomMusicStates.get(roomId) || { playlist: [] };
    const [movedTrack] = state.playlist.splice(fromIndex, 1);
    state.playlist.splice(toIndex, 0, movedTrack);
    roomMusicStates.set(roomId, state);

    io.to(`music-${roomId}`).emit('music:playlist-updated', state.playlist);
    console.log('[MUSIC-SYNC] Broadcasted playlist reorder to room:', roomId);
  });

  // When track ends, auto-play next
  socket.on('music:track-ended', ({ roomId }) => {
    console.log('[MUSIC-SYNC] Track ended, auto-playing next');
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
    console.log('[MUSIC-SYNC] Auto-played next track:', nextTrack.title, 'index:', nextIndex);
  });

  // Leave event to clear socket group
  socket.on('music:leave', () => {
    console.log('[MUSIC-SYNC] User left music session:', socket.user?.username);
    if (socket.musicRoomId) {
      socket.leave(`music-${socket.musicRoomId}`);
      socket.musicRoomId = null;
    }
  });
};
