import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, Search, Plus, Trash2, GripVertical, Volume2, X } from 'lucide-react';
import { musicAPI } from '../services/api';

const YouTubeMusicWidget = ({ socket, roomId, isHost, participantsCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(true);

  const playerRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    } else {
      initializePlayer();
    }
  }, []);

  const initializePlayer = () => {
    if (playerRef.current) return;

    playerRef.current = new window.YT.Player('youtube-player', {
      height: '200',
      width: '100%',
      playerVars: {
        'playsinline': 1,
        'controls': 1,
        'disablekb': 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
  };

  const onPlayerReady = (event) => {
    event.target.setVolume(volume);
  };

  const onPlayerStateChange = (event) => {
    if (isUpdatingRef.current) return;

    const playerState = event.data;
    const isPlayingNow = playerState === window.YT.PlayerState.PLAYING;
    const isEnded = playerState === window.YT.PlayerState.ENDED;

    if (isPlayingNow !== isPlaying) {
      setIsPlaying(isPlayingNow);
      if (isHost && socket) {
        if (isPlayingNow) {
          socket.emit('music:play', { roomId, position: event.target.getCurrentTime() });
        } else {
          socket.emit('music:pause', { roomId, position: event.target.getCurrentTime() });
        }
      }
    }

    if (isEnded && isHost && socket) {
      socket.emit('music:track-ended', { roomId });
    }
  };

  const onPlayerError = (event) => {
    console.error('YouTube player error:', event.data);
  };

  // Socket.IO synchronization
  useEffect(() => {
    if (!socket) return;

    socket.emit('music:join', { roomId });

    socket.on('music:sync-state', (state) => {
      isUpdatingRef.current = true;
      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.currentTrack);
      setPosition(state.currentPosition || 0);
      setPlaylist(state.playlist || []);
      setCurrentIndex(state.currentIndex || 0);

      if (playerRef.current && state.currentTrack) {
        const player = playerRef.current;
        if (state.isPlaying) {
          player.loadVideoById(state.currentTrack.videoId, state.currentPosition);
        } else {
          player.cueVideoById(state.currentTrack.videoId, state.currentPosition);
        }
      }

      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 300);
    });

    socket.on('music:playlist-updated', (updatedPlaylist) => {
      setPlaylist(updatedPlaylist);
    });

    return () => {
      socket.emit('music:leave');
      socket.off('music:sync-state');
      socket.off('music:playlist-updated');
    };
  }, [socket, roomId]);

  // Update position while playing
  useEffect(() => {
    let interval;
    if (isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          setPosition(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration());
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Search YouTube
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await musicAPI.search(searchQuery);
      setSearchResults(res.data.videos);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Add to playlist
  const addToPlaylist = (video) => {
    if (!isHost) return;
    const newTrack = {
      videoId: video.videoId,
      title: video.title,
      channel: video.channel,
      thumbnail: video.thumbnail,
      duration: 0
    };
    setPlaylist([...playlist, newTrack]);
    if (socket) {
      socket.emit('music:add-to-playlist', { roomId, track: newTrack });
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  // Play track from playlist
  const playTrack = (track, index) => {
    if (!isHost) return;
    setCurrentIndex(index);
    setCurrentTrack(track);
    if (socket) {
      socket.emit('music:track-change', { roomId, track, index });
    }
  };

  // Remove from playlist
  const removeFromPlaylist = (index) => {
    if (!isHost) return;
    const newPlaylist = playlist.filter((_, i) => i !== index);
    setPlaylist(newPlaylist);
    if (socket) {
      socket.emit('music:remove-from-playlist', { roomId, index });
    }
  };

  // Playback controls
  const handlePlayPause = () => {
    console.log("===== PLAY BUTTON CLICKED =====");
    console.log("playerRef =", playerRef.current);
    console.log("playVideo =", playerRef.current?.playVideo);
    console.log("currentTrack =", currentTrack);

    if (!isHost || !playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };
  const handleNext = () => {
    if (!isHost || !playlist.length) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playTrack(playlist[nextIndex], nextIndex);
  };

  const handlePrev = () => {
    if (!isHost || !playlist.length) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(playlist[prevIndex], prevIndex);
  };

  const handleSeek = (e) => {
    if (!isHost || !playerRef.current) return;
    const newPosition = parseInt(e.target.value, 10);
    setPosition(newPosition);
    playerRef.current.seekTo(newPosition, true);
    if (socket) {
      socket.emit('music:seek', { roomId, position: newPosition });
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="p-1 hover:bg-[#3E3E42] rounded text-[#A0A0A0] hover:text-white transition-colors"
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
                  {isSearching ? '...' : 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((video) => (
                    <div
                      key={video.videoId}
                      className="flex items-center gap-2 p-2 bg-[#1A1A1A] rounded hover:bg-[#3E3E42] cursor-pointer transition-colors"
                      onClick={() => addToPlaylist(video)}
                    >
                      <img src={video.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white truncate">{video.title}</p>
                        <p className="text-[9px] text-[#A0A0A0] truncate">{video.channel}</p>
                      </div>
                      {isHost && <Plus className="w-4 h-4 text-[#00B8A3]" />}
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

          {/* YouTube Player */}
          <div id="youtube-player" className="w-full bg-black rounded overflow-hidden" />

          {/* Current Track Info */}
          {currentTrack && (
            <div className="flex items-center gap-3 bg-[#1A1A1A] p-2 rounded border border-[#3E3E42]">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#FFFFFF] truncate">{currentTrack.title}</p>
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
              disabled={!isHost || !currentTrack}
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
                <p className="text-[10px] text-[#A0A0A0] text-center py-4">No tracks in playlist</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {playlist.map((track, index) => (
                    <div
                      key={track.videoId}
                      className={`flex items-center gap-2 p-2 rounded transition-colors ${
                        index === currentIndex ? 'bg-[#00B8A3]/20 border border-[#00B8A3]/30' : 'bg-[#1A1A1A] hover:bg-[#3E3E42]'
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
            <span>Room: {participantsCount || 1}</span>
            <span>{!isHost ? 'Host controls playback' : 'You are the host'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeMusicWidget;
