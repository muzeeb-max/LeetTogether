import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, Search, Plus, Trash2, Volume2 } from 'lucide-react';
import { musicAPI } from '../services/api';

// ─── Helper: extract & validate a clean 11-char YouTube videoId ───────────────
const resolveVideoId = (raw) => {
  if (!raw) return null;
  // If someone accidentally passes a full URL, extract the id
  const urlMatch = String(raw).match(/(?:[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const candidate = urlMatch ? urlMatch[1] : String(raw).trim().slice(0, 11);
  return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
};

const YouTubeMusicWidget = React.memo(({ socket, roomId, isHost, participantsCount }) => {
  const [isOpen, setIsOpen]               = useState(false);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [currentTrack, setCurrentTrack]   = useState(null);
  const [position, setPosition]           = useState(0);
  const [duration, setDuration]           = useState(0);
  const [volume, setVolume]               = useState(50);
  const [playlist, setPlaylist]           = useState([]);
  const [currentIndex, setCurrentIndex]   = useState(0);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [showSearch, setShowSearch]       = useState(false);
  const [showPlaylist, setShowPlaylist]   = useState(true);
  const [playerReady, setPlayerReady]     = useState(false);

  const playerRef       = useRef(null);
  const isUpdatingRef   = useRef(false);
  const pendingTrackRef = useRef(null); // track to load once player is ready
  const apiLoadedRef    = useRef(false); // track if API script is loaded
  const playerCreatedRef = useRef(false); // guard: prevent creating player more than once

  // ── Load YouTube IFrame API script (once per component lifecycle) ───────────────
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      console.log('[YT-API] API already loaded');
      apiLoadedRef.current = true;
      return;
    }

    console.log('[YT-API] Loading YouTube IFrame API script...');
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    
    // Guard: Only insert if we have a valid parent node
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      // Fallback: append to head if no script tags exist
      document.head.appendChild(tag);
    }

    // Set up the global callback
    const originalCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      console.log('[YT-API] onYouTubeIframeAPIReady fired');
      apiLoadedRef.current = true;
      if (originalCallback) {
        originalCallback();
      }
    };

    return () => {
      // Don't remove the script or reset the callback as other components might use it
      console.log('[YT-API] Cleanup - API script remains loaded');
    };
  }, []); // Run once on mount

  // ── Player callbacks (MUST be defined before useEffect that uses them) ───────────
  const onPlayerReady = useCallback((event) => {
    console.log('[YT-READY] PLAYER READY - onPlayerReady fired');
    console.log('[YT-READY] event.target:', event.target);
    console.log('[YT-READY] typeof event.target.playVideo:', typeof event.target.playVideo);
    
    event.target.setVolume(volume);
    setPlayerReady(true);
    
    console.log('[YT-READY] playerReady state set to true');
    console.log('[YT-READY] playerRef.current:', playerRef.current);
    console.log('[YT-READY] typeof playerRef.current.playVideo:', typeof playerRef.current?.playVideo);

    // If a track was queued before the player finished initializing, load it now
    if (pendingTrackRef.current) {
      const track = pendingTrackRef.current;
      pendingTrackRef.current = null;
      const cleanId = resolveVideoId(track?.videoId);
      console.log('[YT-READY] Loading pending track:', cleanId);
      if (cleanId && playerRef.current) {
        playerRef.current.loadVideoById({ videoId: cleanId, startSeconds: 0 });
      }
    }
  }, []); // Empty deps - volume is read directly from state, not needed as dep

  const onPlayerStateChange = useCallback((event) => {
    console.log('[YT-STATE] State changed:', event.data);
    if (isUpdatingRef.current) return;
    const isPlayingNow = event.data === window.YT.PlayerState.PLAYING;
    const isEnded      = event.data === window.YT.PlayerState.ENDED;

    setIsPlaying(isPlayingNow);

    if (isHost && socket) {
      if (isPlayingNow) {
        socket.emit('music:play',  { roomId, position: event.target.getCurrentTime() });
      } else if (!isEnded) {
        socket.emit('music:pause', { roomId, position: event.target.getCurrentTime() });
      }
    }

    if (isEnded && isHost && socket) {
      socket.emit('music:track-ended', { roomId });
    }
  }, []); // Empty deps - isHost, socket, roomId read from closure, not needed as deps

  const onPlayerError = useCallback((event) => {
    const ERRORS = {
      2:   'Invalid parameter / bad videoId',
      5:   'HTML5 player error',
      100: 'Video not found or private',
      101: 'Embedding disabled by owner',
      150: 'Embedding disabled by owner',
    };
    console.error('[YT-ERROR] Code:', event.data, '→', ERRORS[event.data] || 'Unknown');
    console.error('[YT-ERROR] Current track:', JSON.stringify(currentTrack));
  }, []); // Empty deps - currentTrack read from closure, not needed as dep

  // ── Load IFrame API & initialize player ONCE when component mounts ─────────────
  useEffect(() => {
    console.log('[YT-INIT] Component mounted - initializing player once');
    
    const doInit = () => {
      console.log('[YT-INIT] doInit() called');
      console.log('[YT-INIT] playerCreatedRef.current:', playerCreatedRef.current);
      console.log('[YT-INIT] playerRef.current before:', playerRef.current);
      console.log('[YT-INIT] window.YT exists:', !!window.YT);
      console.log('[YT-INIT] window.YT.Player exists:', !!window.YT?.Player);
      
      // Guard: Only create player once per component lifecycle
      if (playerCreatedRef.current) {
        console.log('[YT-INIT] Player already created, skipping');
        return;
      }
      
      if (playerRef.current) {
        console.log('[YT-INIT] Player ref already exists, skipping');
        return;
      }
      
      const container = document.getElementById('youtube-player');
      console.log('[YT-INIT] Container #youtube-player exists:', !!container);
      
      if (!container) {
        console.warn('[YT-INIT] Container #youtube-player not found, retrying...');
        setTimeout(doInit, 200);
        return;
      }
      
      console.log('[YT-INIT] Creating YT.Player...');
      console.log('[YT-INIT] onPlayerReady function:', typeof onPlayerReady);
      console.log('[YT-INIT] onPlayerStateChange function:', typeof onPlayerStateChange);
      console.log('[YT-INIT] onPlayerError function:', typeof onPlayerError);
      
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '200',
        width: '100%',
        playerVars: { playsinline: 1, controls: 1, disablekb: 0 },
        events: {
          onReady:       onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError:       onPlayerError,
        },
      });
      
      playerCreatedRef.current = true;
      
      console.log('[YT-INIT] YT.Player constructor returned');
      console.log('[YT-INIT] playerRef.current after creation:', playerRef.current);
      console.log('[YT-INIT] typeof playerRef.current.playVideo:', typeof playerRef.current?.playVideo);
    };

    if (window.YT && window.YT.Player) {
      console.log('[YT-INIT] API already loaded, calling doInit immediately');
      doInit();
    } else {
      // API not loaded yet – wait for the global callback
      console.log('[YT-INIT] API not loaded, setting up onYouTubeIframeAPIReady callback');
      const original = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        console.log('[YT-INIT] onYouTubeIframeAPIReady fired');
        original?.();
        doInit();
      };
    }
    
    // Cleanup: Destroy player ONLY when component unmounts, not when isOpen changes
    return () => {
      console.log('[YT-INIT] Component unmounting - destroying player');
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        setPlayerReady(false);
        playerCreatedRef.current = false;
      }
    };
  }, []); // Empty deps - run once on mount, never re-run

  // ── Core: safely load a video into the player ───────────────────────────────
  const loadTrackIntoPlayer = useCallback((track, autoplay = false) => {
    const rawId   = track?.videoId ?? track?.id?.videoId ?? track?.id ?? '';
    const cleanId = resolveVideoId(rawId);

    console.log('[LOAD] Raw videoId input :', JSON.stringify(rawId));
    console.log('[LOAD] Resolved cleanId  :', cleanId);
    console.log('[LOAD] autoplay          :', autoplay);
    console.log('[LOAD] playerReady       :', playerReady);
    console.log('[LOAD] playerRef.current :', !!playerRef.current);
    console.log('[LOAD] currentTrack       :', currentTrack?.title);

    if (!cleanId) {
      console.error('[LOAD] ❌ Invalid videoId — aborting. raw was:', JSON.stringify(rawId));
      return;
    }

    // Guard: ALL conditions must be met before loading
    if (!playerReady || !playerRef.current || typeof playerRef.current.loadVideoById !== 'function') {
      console.warn('[LOAD] Player not ready yet, queuing track');
      pendingTrackRef.current = track;
      return;
    }

    console.log('[LOAD] ✅ Calling loadVideoById with:', cleanId);
    if (autoplay) {
      playerRef.current.loadVideoById({ videoId: cleanId, startSeconds: 0 });
    } else {
      playerRef.current.cueVideoById({ videoId: cleanId, startSeconds: 0 });
    }
  }, [playerReady, currentTrack]);

  // ── Socket.IO synchronization ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.emit('music:join', { roomId });

    socket.on('music:sync-state', (state) => {
      console.log('[SYNC] Received sync-state:', {
        hasTrack: !!state.currentTrack,
        isPlaying: state.isPlaying,
        position: state.currentPosition,
        playerReady: playerReady,
        playerExists: !!playerRef.current
      });
      
      isUpdatingRef.current = true;
      setIsPlaying(state.isPlaying);
      
      // Only update currentTrack if the new value is not null
      // This prevents race conditions where sync overwrites local track selection
      if (state.currentTrack !== null) {
        console.log('[SYNC] Updating currentTrack to:', state.currentTrack.title);
        setCurrentTrack(state.currentTrack);
      } else {
        console.log('[SYNC] Skipping currentTrack update - server sent null');
      }
      
      setPosition(state.currentPosition || 0);
      setPlaylist(state.playlist || []);
      setCurrentIndex(state.currentIndex || 0);

      // Only load video if ALL conditions are met
      if (playerReady && playerRef.current && state.currentTrack) {
        const cleanId = resolveVideoId(state.currentTrack.videoId);
        console.log('[SYNC] Attempting to load video:', {
          cleanId,
          isPlaying: state.isPlaying,
          position: state.currentPosition
        });
        
        if (cleanId) {
          if (state.isPlaying) {
            console.log('[SYNC] Calling loadVideoById with:', cleanId, 'at', state.currentPosition);
            playerRef.current.loadVideoById({ videoId: cleanId, startSeconds: state.currentPosition || 0 });
          } else {
            console.log('[SYNC] Calling cueVideoById with:', cleanId, 'at', state.currentPosition);
            playerRef.current.cueVideoById({ videoId: cleanId, startSeconds: state.currentPosition || 0 });
          }
        } else {
          console.error('[SYNC] Bad videoId in sync-state:', state.currentTrack.videoId);
        }
      } else {
        console.log('[SYNC] Skipping video load - conditions not met:', {
          playerReady,
          playerExists: !!playerRef.current,
          hasTrack: !!state.currentTrack
        });
      }

      setTimeout(() => { isUpdatingRef.current = false; }, 300);
    });

    socket.on('music:playlist-updated', (updatedPlaylist) => {
      setPlaylist(updatedPlaylist);
    });

    return () => {
      socket.emit('music:leave');
      socket.off('music:sync-state');
      socket.off('music:playlist-updated');
    };
  }, [socket, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Position polling while playing ─────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setPosition(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration());
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    console.log('[SEARCH] Search button clicked, query:', searchQuery);
    
    if (!searchQuery.trim()) {
      console.warn('[SEARCH] Empty search query, returning');
      return;
    }
    
    setIsSearching(true);
    try {
      console.log('[SEARCH] Calling API with query:', searchQuery);
      const res = await musicAPI.search(searchQuery);
      console.log('[SEARCH] API response:', res.data);
      
      const videos = res.data?.videos || [];
      console.log('[SEARCH] Videos found:', videos.length);
      setSearchResults(videos);
    } catch (err) {
      console.error('[SEARCH] Error:', err);
      console.error('[SEARCH] Error response:', err.response?.data);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // ── Playlist management ─────────────────────────────────────────────────────
  const addToPlaylist = useCallback((video) => {
    console.log('[ADD] addToPlaylist called, isHost:', isHost, 'video:', video);
    
    if (!isHost) {
      console.warn('[ADD] Non-host tried to add to playlist, blocked');
      alert('Only the host can add songs to the playlist.');
      return;
    }
    
    // Ensure we store a clean videoId string (not the nested object)
    const cleanId = resolveVideoId(video.id?.videoId ?? video.videoId ?? video.id);
    if (!cleanId) {
      console.error('[ADD] Bad videoId from search result:', video);
      alert('Invalid video ID. Please try a different video.');
      return;
    }
    
    const newTrack = {
      videoId:   cleanId,
      title:     video.title,
      channel:   video.channel,
      thumbnail: video.thumbnail,
      duration:  0,
    };
    console.log('[ADD] Adding track with cleanId:', cleanId);
    
    setPlaylist((prev) => [...prev, newTrack]);
    socket?.emit('music:add-to-playlist', { roomId, track: newTrack });
    setSearchResults([]);
    setSearchQuery('');
  }, [isHost, socket, roomId]);

  const removeFromPlaylist = useCallback((index) => {
    if (!isHost) return;
    setPlaylist((prev) => prev.filter((_, i) => i !== index));
    socket?.emit('music:remove-from-playlist', { roomId, index });
  }, [isHost, socket, roomId]);

  // ── Play track — FIX: host must also call loadTrackIntoPlayer ───────────────
  const playTrack = useCallback((track, index) => {
    if (!isHost) return;

    console.log('[PLAY-TRACK] Selected track:', JSON.stringify(track));
    const cleanId = resolveVideoId(track?.videoId);
    console.log('[PLAY-TRACK] cleanId:', cleanId);

    if (!cleanId) {
      console.error('[PLAY-TRACK] ❌ Invalid videoId, cannot play:', track?.videoId);
      return;
    }

    setCurrentIndex(index);
    setCurrentTrack(track);

    // Host loads the video directly into their own player
    loadTrackIntoPlayer(track, true);

    socket?.emit('music:track-change', { roomId, track: { ...track, videoId: cleanId }, index });
  }, [isHost, socket, roomId, loadTrackIntoPlayer]);

  // ── Playback controls ───────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    console.log('[CTRL] handlePlayPause — playerReady:', playerReady, 'isPlaying:', isPlaying, 'track:', currentTrack?.title);

    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') {
      console.warn('[CTRL] Player not ready');
      return;
    }

    if (!currentTrack) {
      // No track selected: try loading the first playlist item
      if (playlist.length > 0) {
        playTrack(playlist[0], 0);
      } else {
        console.warn('[CTRL] No track and empty playlist');
      }
      return;
    }

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      // If player has no video loaded yet, load it first
      const state = playerRef.current.getPlayerState?.();
      // state -1 = unstarted (no video cued)
      if (state === -1 || state === undefined) {
        console.log('[CTRL] Player unstarted — loading track first');
        loadTrackIntoPlayer(currentTrack, true);
      } else {
        playerRef.current.playVideo();
      }
    }
  }, [playerReady, isPlaying, currentTrack, playlist, playTrack, loadTrackIntoPlayer]);

  const handleNext = useCallback(() => {
    if (!isHost || !playlist.length) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playTrack(playlist[nextIndex], nextIndex);
  }, [isHost, playlist, currentIndex, playTrack]);

  const handlePrev = useCallback(() => {
    if (!isHost || !playlist.length) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prevIndex], prevIndex);
  }, [isHost, playlist, currentIndex, playTrack]);

  const handleSeek = useCallback((e) => {
    if (!isHost || !playerRef.current) return;
    const newPosition = parseInt(e.target.value, 10);
    setPosition(newPosition);
    playerRef.current.seekTo(newPosition, true);
    socket?.emit('music:seek', { roomId, position: newPosition });
  }, [isHost, socket, roomId]);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    playerRef.current?.setVolume(newVolume);
  }, []);

  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative font-sans">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
          isOpen ? 'bg-[#00B8A3] text-white' : 'bg-[#3E3E42]/50 hover:bg-[#3E3E42] text-[#FFFFFF]'
        }`}
      >
        <Music className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} />
        <span className="hidden sm:inline">Music</span>
      </button>

      {/* YouTube Player iframe container - ALWAYS mounted, hidden with CSS */}
      <div 
        id="youtube-player" 
        className={`w-full bg-black rounded overflow-hidden ${isOpen ? 'block' : 'hidden'}`} 
      />

      {/* Expanded Widget */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 w-full rounded-t-xl bg-[#262626] border-t border-[#3E3E42] shadow-2xl z-50 p-4 space-y-4 sm:absolute sm:bottom-auto sm:top-full sm:right-0 sm:left-auto sm:w-80 sm:rounded-lg sm:border sm:mt-2 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#3E3E42] pb-2">
            <span className="text-[11px] font-semibold text-[#00B8A3] flex items-center gap-1">
              <Music className="w-3.5 h-3.5" /> YouTube Music Room
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white transition-colors"
                title="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white transition-colors"
                title="Toggle Playlist"
              >
                <Music className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          {showSearch && (
            <form onSubmit={handleSearch} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search YouTube..."
                  className="flex-1 bg-[#1A1A1A] border border-[#3E3E42] rounded px-2 py-1.5 text-[11px] text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#00B8A3]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-3 py-1.5 bg-[#00B8A3] hover:bg-[#00A090] text-white rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                >
                  {isSearching ? '...' : 'Go'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((video) => (
                    <div
                      key={video.videoId}
                      className="flex items-center gap-2 p-2 bg-[#1A1A1A] rounded hover:bg-[#3E3E42] cursor-pointer transition-colors"
                      onClick={() => {
                        console.log('[SEARCH-RESULT] Clicked video:', video.title);
                        if (isHost) {
                          addToPlaylist(video);
                        } else {
                          // Non-host can click to play directly (if host allows)
                          alert('Only the host can add songs. Ask the host to add this song.');
                        }
                      }}
                    >
                      <img src={video.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white truncate">{video.title}</p>
                        <p className="text-[9px] text-[#A0A0A0] truncate">{video.channel}</p>
                      </div>
                      {isHost && <Plus className="w-4 h-4 text-[#00B8A3] shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

          {/* Current Track Info */}
          {currentTrack && (
            <div className="flex items-center gap-3 bg-[#1A1A1A] p-2 rounded border border-[#3E3E42]">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-[10px] text-[#A0A0A0] truncate">{currentTrack.channel}</p>
              </div>
            </div>
          )}

          {/* Progress Bar */}
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

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 py-1">
            <button
              onClick={handlePrev}
              disabled={!isHost || !playlist.length}
              className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white disabled:opacity-30 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!isHost}
              className="p-2 bg-white hover:bg-slate-200 rounded-full text-black disabled:opacity-30 transition-all transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
            </button>
            <button
              onClick={handleNext}
              disabled={!isHost || !playlist.length}
              className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white disabled:opacity-30 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-[#A0A0A0]" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-[#3E3E42] rounded-lg appearance-none cursor-pointer accent-[#00B8A3]"
            />
          </div>

          {/* Playlist */}
          {showPlaylist && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold text-[#A0A0A0]">
                <span>Playlist ({playlist.length})</span>
              </div>
              {playlist.length === 0 ? (
                <p className="text-[10px] text-[#A0A0A0] text-center py-4">
                  {isHost ? 'Search and add tracks above' : 'Host has not added tracks yet'}
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {playlist.map((track, index) => (
                    <div
                      key={`${track.videoId}-${index}`}
                      className={`flex items-center gap-2 p-2 rounded transition-colors ${
                        index === currentIndex
                          ? 'bg-[#00B8A3]/20 border border-[#00B8A3]/30'
                          : 'bg-[#1A1A1A] hover:bg-[#3E3E42]'
                      }`}
                    >
                      <span className="text-[9px] text-[#A0A0A0] w-4">{index + 1}</span>
                      <img src={track.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => playTrack(track, index)}
                      >
                        <p className="text-[10px] font-medium text-white truncate">{track.title}</p>
                        <p className="text-[9px] text-[#A0A0A0] truncate">{track.channel}</p>
                      </div>
                      {isHost && (
                        <button
                          onClick={() => removeFromPlaylist(index)}
                          className="p-1 hover:bg-red-500/20 rounded text-[#A0A0A0] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-[#3E3E42] pt-2 flex items-center justify-between text-[9px] text-[#A0A0A0]">
            <span>Listeners: {participantsCount || 1}</span>
            <span>{!isHost ? 'Host controls playback' : 'You are the host'}</span>
          </div>
        </div>
      )}
    </div>
  );
});

YouTubeMusicWidget.displayName = 'YouTubeMusicWidget';

export default YouTubeMusicWidget;
