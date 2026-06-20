import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, RefreshCw, Volume2, Link } from 'lucide-react';
import { spotifyAPI } from '../services/api';

const SpotifyWidget = ({ socket, roomId, isHost, participantsCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [isPremium, setIsPremium] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Mock / Simulation status
  const [isMockMode, setIsMockMode] = useState(false);

  const playerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Default mock tracks for simulation if Spotify Premium or credentials are not active
  const MOCK_TRACKS = [
    {
      id: 'mock-1',
      name: 'Beats to Code To',
      artists: 'Lofi Coder',
      albumCover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=120&auto=format&fit=crop',
      durationMs: 180000
    },
    {
      id: 'mock-2',
      name: 'Synthwave Coding Marathon',
      artists: 'Cyber DJ',
      albumCover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=120&auto=format&fit=crop',
      durationMs: 240000
    },
    {
      id: 'mock-3',
      name: 'Productivity Boost',
      artists: 'Focus Zone',
      albumCover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=120&auto=format&fit=crop',
      durationMs: 150000
    }
  ];
  const [currentMockIndex, setCurrentMockIndex] = useState(0);

  // 1. Initial Check: Fetch Spotify Status
  const checkSpotifyStatus = async () => {
    try {
      const res = await spotifyAPI.getToken();
      if (res.data && res.data.accessToken) {
        setIsConnected(true);
        setSpotifyUser(res.data.username);
        setIsPremium(res.data.product === 'premium');
        if (res.data.accessToken.startsWith('mock_')) {
          setIsMockMode(true);
        }
      }
    } catch (err) {
      setIsConnected(false);
      setSpotifyUser(null);
    }
  };

  useEffect(() => {
    checkSpotifyStatus();
  }, []);

  // 2. Connect Spotify Account Handler
  const connectSpotify = async () => {
    setIsLoading(true);
    try {
      localStorage.setItem('lastRoomId', roomId);
      const res = await spotifyAPI.getLoginUrl();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      console.error('Failed to get Spotify Auth URL', err);
      alert('Authentication request failed. Running in offline mock mode.');
      setIsConnected(true);
      setIsMockMode(true);
      setSpotifyUser('Mock Developer');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSpotify = async () => {
    if (confirm('Disconnect from Spotify?')) {
      try {
        await spotifyAPI.disconnect();
        setIsConnected(false);
        setSpotifyUser(null);
        setIsMockMode(false);
        if (playerRef.current) {
          playerRef.current.disconnect();
          playerRef.current = null;
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 3. Socket.IO Synchronization listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('music:join', { roomId });

    socket.on('music:sync-state', (state) => {
      console.log('[SpotifyWidget] Syncing music state from server:', state);
      
      // Avoid loops if host triggered the change
      isUpdatingRef.current = true;

      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.currentTrack);
      setPosition(state.currentPosition || 0);
      setDuration(state.currentTrack?.durationMs || 0);

      // Apply to Spotify Player if real premium player is active
      if (playerRef.current && !isMockMode && isPremium) {
        if (state.currentTrack) {
          // Play specific track or seek
          const trackUri = `spotify:track:${state.currentTrack.id}`;
          
          // Spotify Web SDK handles play via Web API or direct transfer
          // For simplicity we keep player state visual or trigger player play
          if (state.isPlaying) {
            playerRef.current.resume();
          } else {
            playerRef.current.pause();
          }
        }
      }

      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 300);
    });

    return () => {
      socket.emit('music:leave');
      socket.off('music:sync-state');
    };
  }, [socket, roomId]);

  // 4. Lazy-load Spotify SDK & Initialize Player
  const initSpotifyPlayer = async () => {
    if (playerRef.current || isMockMode || !isPremium) return;

    // Load Script
    await new Promise((resolve) => {
      if (window.Spotify) {
        resolve();
        return;
      }
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    });

    try {
      const tokenRes = await spotifyAPI.getToken();
      const token = tokenRes.data.accessToken;

      const player = new window.Spotify.Player({
        name: 'LeetTogether Web Player',
        getOAuthToken: (cb) => cb(token),
        volume: 0.4
      });

      player.addListener('initialization_error', ({ message }) => {
        console.error('Playback initialization error', message);
        setIsMockMode(true);
      });

      player.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error', message);
        setIsMockMode(true);
      });

      player.addListener('account_error', ({ message }) => {
        // Free user error
        console.warn('Account error (requires Spotify Premium):', message);
        setIsPremium(false);
        setIsMockMode(true);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state || isUpdatingRef.current) return;

        const track = state.track_window.current_track;
        const mappedTrack = {
          id: track.id,
          name: track.name,
          artists: track.artists.map(a => a.name).join(', '),
          albumCover: track.album.images[0]?.url,
          durationMs: state.duration
        };

        setCurrentTrack(mappedTrack);
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);

        // If host, sync state to server
        if (isHost && socket) {
          socket.emit('music:track-change', { roomId, track: mappedTrack });
          if (state.paused) {
            socket.emit('music:pause', { roomId, position: state.position });
          } else {
            socket.emit('music:play', { roomId, position: state.position });
          }
        }
      });

      await player.connect();
      playerRef.current = player;
    } catch (err) {
      console.error('Error starting Spotify Player', err);
      setIsMockMode(true);
    }
  };

  useEffect(() => {
    if (isOpen && isConnected) {
      if (isMockMode) {
        // Initialize default mock track if nothing playing
        if (!currentTrack) {
          setCurrentTrack(MOCK_TRACKS[0]);
          setDuration(MOCK_TRACKS[0].durationMs);
        }
      } else {
        initSpotifyPlayer();
      }
    }
  }, [isOpen, isConnected, isMockMode]);

  // 5. Timer for seekbar progress
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= duration) {
            clearInterval(progressIntervalRef.current);
            if (isHost && isMockMode) {
              handleNext(); // Auto play next in mock mode
            }
            return duration;
          }
          return prev + 1000;
        });
      }, 1000);
    } else {
      clearInterval(progressIntervalRef.current);
    }

    return () => clearInterval(progressIntervalRef.current);
  }, [isPlaying, duration]);

  // 6. Playback Commands (Host only)
  const handlePlayPause = () => {
    if (!isHost) return;
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (socket) {
      if (nextState) {
        socket.emit('music:play', { roomId, position });
      } else {
        socket.emit('music:pause', { roomId, position });
      }
    }
  };

  const handleSeek = (e) => {
    if (!isHost) return;
    const newPosition = parseInt(e.target.value, 10);
    setPosition(newPosition);
    if (socket) {
      socket.emit('music:seek', { roomId, position: newPosition });
    }
  };

  const handleNext = () => {
    if (!isHost) return;
    if (isMockMode) {
      const nextIndex = (currentMockIndex + 1) % MOCK_TRACKS.length;
      setCurrentMockIndex(nextIndex);
      const nextTrack = MOCK_TRACKS[nextIndex];
      setCurrentTrack(nextTrack);
      setPosition(0);
      setDuration(nextTrack.durationMs);
      if (socket) {
        socket.emit('music:track-change', { roomId, track: nextTrack });
      }
    } else if (playerRef.current) {
      playerRef.current.nextTrack();
    }
  };

  const handlePrev = () => {
    if (!isHost) return;
    if (isMockMode) {
      const prevIndex = (currentMockIndex - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length;
      setCurrentMockIndex(prevIndex);
      const prevTrack = MOCK_TRACKS[prevIndex];
      setCurrentTrack(prevTrack);
      setPosition(0);
      setDuration(prevTrack.durationMs);
      if (socket) {
        socket.emit('music:track-change', { roomId, track: prevTrack });
      }
    } else if (playerRef.current) {
      playerRef.current.previousTrack();
    }
  };

  // Helper formatting for duration (ms -> mm:ss)
  const formatTime = (ms) => {
    if (!ms) return '0:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000) / 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="relative font-sans">
      {/* Mini Toggle Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
          isOpen ? 'bg-[#00B8A3] text-white' : 'bg-[#3E3E42]/50 hover:bg-[#3E3E42] text-[#FFFFFF]'
        }`}
      >
        <Music className={`w-3.5 h-3.5 ${isPlaying ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">Music</span>
      </button>

      {/* Expanded Widget Dropdown Overlay */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 w-full rounded-t-xl bg-[#262626] border-t border-[#3E3E42] shadow-2xl z-50 p-4 space-y-4 sm:absolute sm:bottom-auto sm:top-full sm:right-0 sm:left-auto sm:w-64 sm:rounded-lg sm:border sm:mt-2">
          <div className="flex items-center justify-between border-b border-[#3E3E42] pb-2">
            <span className="text-[11px] font-semibold text-[#00B8A3] flex items-center gap-1">
              <Music className="w-3.5 h-3.5" /> Spotify Room Playback
            </span>
            {isConnected && (
              <button
                onClick={disconnectSpotify}
                className="text-[9px] text-red-400 hover:underline"
              >
                Disconnect
              </button>
            )}
          </div>

          {!isConnected ? (
            <div className="py-2 text-center space-y-3">
              <p className="text-[11px] text-[#A0A0A0]">Connect Spotify to sync music with room.</p>
              <button
                onClick={connectSpotify}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
              >
                {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                Connect Spotify
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Account Product / Premium status check */}
              {!isPremium && !isMockMode && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] text-center leading-normal">
                  Spotify Premium required for SDK device. Running in simulation fallback.
                </div>
              )}

              {/* Connected user badge */}
              <div className="flex items-center justify-between text-[9px] text-[#A0A0A0]">
                <span>User: <strong className="text-white">{spotifyUser}</strong></span>
                {isMockMode && <span className="px-1.5 py-0.2 bg-[#FFA116]/10 text-[#FFA116] rounded border border-[#FFA116]/20">MOCK DJ</span>}
              </div>

              {/* Current Track Details */}
              {currentTrack ? (
                <div className="flex items-center gap-3 bg-[#1A1A1A] p-2 rounded border border-[#3E3E42]">
                  <img
                    src={currentTrack.albumCover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=80&auto=format&fit=crop'}
                    alt={currentTrack.name}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-[#FFFFFF] truncate leading-tight">{currentTrack.name}</p>
                    <p className="text-[10px] text-[#A0A0A0] truncate leading-tight mt-0.5">{currentTrack.artists}</p>
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center bg-[#1A1A1A] rounded text-[11px] text-[#A0A0A0] border border-[#3E3E42]">
                  No track loaded
                </div>
              )}

              {/* Playback Progress Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={position}
                  onChange={handleSeek}
                  disabled={!isHost || !currentTrack}
                  className="w-full h-1 bg-[#3E3E42] rounded-lg appearance-none cursor-pointer accent-[#00B8A3] disabled:opacity-50"
                />
                <div className="flex justify-between text-[9px] text-[#A0A0A0] font-mono">
                  <span>{formatTime(position)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-4 py-1">
                <button
                  onClick={handlePrev}
                  disabled={!isHost || !currentTrack}
                  className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white disabled:opacity-30 transition-colors"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={!isHost || !currentTrack}
                  className="p-2 bg-white hover:bg-slate-200 rounded-full text-black disabled:opacity-30 transition-all transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!isHost || !currentTrack}
                  className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white disabled:opacity-30 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Connected listeners count */}
              <div className="border-t border-[#3E3E42] pt-2 flex items-center justify-between text-[9px] text-[#A0A0A0]">
                <span>Room Members: {participantsCount || 1}</span>
                <span>{!isHost ? 'Host controls playback' : 'DJ Mode Active'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyWidget;
