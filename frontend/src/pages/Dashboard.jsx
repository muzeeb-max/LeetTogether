import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  PlusCircle,
  LogIn,
  Search,
  BookOpen,
  Send,
  UserCheck,
  UserMinus,
  Play,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { friendAPI, problemAPI, userAPI } from '../services/api';
import Navbar from '../components/Navbar';

const summarizeProblem = (description = '') => String(description)
  .replace(/<[^>]*>/g, ' ')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/\*(.*?)\*/g, '$1')
  .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const Dashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  // Problems catalog states
  const [problems, setProblems] = useState([]);
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // LeetCode search states
  const [leetcodeQuery, setLeetcodeQuery] = useState('');
  const [leetcodeResults, setLeetcodeResults] = useState([]);
  const [showLeetcodeDropdown, setShowLeetcodeDropdown] = useState(false);
  const [isSearchingLeetcode, setIsSearchingLeetcode] = useState(false);
  const [leetcodeSearchError, setLeetcodeSearchError] = useState('');

  // Friends states
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchUserResults, setSearchUserResults] = useState([]);

  // Modals state management
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: '', problemId: '' });
  const [joinRoomId, setJoinRoomId] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen to live presence updates of friends via WebSocket
  useEffect(() => {
    if (!socket) return;

    socket.on('friend:status-change', (data) => {
      setFriends((prevFriends) =>
        prevFriends.map((f) =>
          f.id === data.userId ? { ...f, status: data.status } : f
        )
      );
    });

    socket.on('invite:received', () => {
      // Audio cue or dashboard indicator could be played
    });

    return () => {
      socket.off('friend:status-change');
      socket.off('invite:received');
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch seed problems
      const probRes = await problemAPI.getProblems(difficultyFilter, searchQuery);
      setProblems(probRes.data);
      if (probRes.data.length > 0) {
        setRoomForm((prev) => ({ ...prev, problemId: probRes.data[0].id }));
      }

      // 2. Fetch friends
      const friendsRes = await friendAPI.getFriends();
      setFriends(friendsRes.data);

    // 3. Fetch friend requests
    const requestsRes = await friendAPI.getFriendRequests();
    console.log('Dashboard friend requests response:', requestsRes.data);
    const incoming = (requestsRes.data?.incoming || [])
      .map((req) => ({
        id: req?.id || req?.Id || Date.now().toString(),
        sender: req?.sender || req?.Sender || { id: null, username: 'Unknown' },
        senderUsername: req?.sender?.username || req?.Sender?.username || 'Unknown User',
        status: req?.status || 'pending',
        createdAt: req?.createdAt || new Date().toISOString()
      }))
      .filter(req => req.senderUsername !== 'Unknown User' || req.sender?.id);
    setIncomingRequests(incoming);
    } catch (err) {
      console.error('Failed to load dashboard data:', err.message);
    }
  };

  // Re-trigger problem searches when filter params change
  useEffect(() => {
    const searchProblems = async () => {
      try {
        const res = await problemAPI.getProblems(difficultyFilter, searchQuery);
        setProblems(res.data);
      } catch (err) {
        console.error(err.message);
      }
    };
    searchProblems();
  }, [difficultyFilter, searchQuery]);

  // Debounced LeetCode search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (leetcodeQuery.trim().length >= 2) {
        console.log('[Dashboard] Starting LeetCode search for:', leetcodeQuery);
        setIsSearchingLeetcode(true);
        setLeetcodeSearchError('');
        try {
          const res = await problemAPI.searchLeetCode(leetcodeQuery);
          console.log('[Dashboard] LeetCode search response:', res);
          console.log('[Dashboard] LeetCode search results:', res.data);
          setLeetcodeResults(res.data || []);
          setShowLeetcodeDropdown(true);
        } catch (err) {
          console.error('[Dashboard] LeetCode search error:', err.message);
          console.error('[Dashboard] Full error:', err);
          setLeetcodeResults([]);
          setLeetcodeSearchError('Could not search LeetCode right now. Please try again.');
        } finally {
          setIsSearchingLeetcode(false);
        }
      } else {
        setLeetcodeResults([]);
        setShowLeetcodeDropdown(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [leetcodeQuery]);

  // Friend System actions
  const handleUserSearch = async (e) => {
    const q = e.target.value;
    setSearchUserQuery(q);
    if (q.trim().length >= 2) {
      try {
        const res = await userAPI.searchUsers(q);
        setSearchUserResults(res.data);
      } catch (err) {
        console.error(err.message);
      }
    } else {
      setSearchUserResults([]);
    }
  };

  const sendFriendRequest = async (username) => {
    try {
      await friendAPI.sendRequest(username);
      setSearchUserResults((prev) => prev.filter((u) => u.username !== username));
      setSearchUserQuery('');
      showStatus('success', `Friend request sent to ${username}`);
    } catch (err) {
      showStatus('error', err.response?.data?.message || 'Failed to send request');
    }
  };

  const respondFriendRequest = async (requestId, action) => {
    try {
      await friendAPI.respondRequest(requestId, action);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      // Reload friends list
      const friendsRes = await friendAPI.getFriends();
      setFriends(friendsRes.data);
      showStatus('success', `Friend request ${action}ed`);
    } catch (err) {
      showStatus('error', 'Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendId) => {
    try {
      await friendAPI.removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      showStatus('success', 'Friend connection removed');
    } catch (err) {
      showStatus('error', 'Failed to remove friend');
    }
  };

  // Room creations & joins
  const createRoom = (e) => {
    e.preventDefault();
    if (!roomForm.name.trim()) return;

    // Generate short UUID Room ID
    const shortRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Redirect to the created Room path with dynamic states
    navigate(`/room/${shortRoomId}`, {
      state: {
        roomName: roomForm.name,
        problemId: roomForm.problemId
      }
    });
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;
    navigate(`/room/${joinRoomId.trim().toUpperCase()}`);
  };

  const handleLeetCodeProblemSelect = async (problem) => {
    setShowLeetcodeDropdown(false);
    setLeetcodeQuery('');

    // Create a unique room ID
    const uniqueRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Navigate to room with LeetCode problem data
    navigate(`/room/${uniqueRoomId}`, {
      state: {
        roomName: `LeetCode: ${problem.title}`,
        leetcodeProblem: problem,
        isLeetCodeProblem: true
      }
    });
  };

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#F5F5F5] pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Status Toast Alert */}
        {statusMsg.text && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl z-50 text-sm font-semibold border ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'} animate-fade-in`}>
            {statusMsg.text}
          </div>
        )}

        {/* Compact welcome */}
        <section className="mb-6 flex flex-col justify-between gap-5 rounded-2xl border border-[#303030] bg-[#1A1A1A] px-5 py-5 sm:flex-row sm:items-center sm:px-7" aria-labelledby="dashboard-welcome">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A1A1A1]">Your coding workspace</p>
            <h1 id="dashboard-welcome" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, <span className="text-[#FFA116]">{user?.username || 'coder'}!</span>
            </h1>
            <p className="mt-2 text-sm text-[#A1A1A1]">Choose a problem and start coding, or invite a friend to solve it together.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFA116] px-4 py-2.5 text-sm font-bold text-[#1A1A1A] transition hover:bg-[#ffb13b] focus:outline-none focus:ring-2 focus:ring-[#FFA116]/50"
            >
              <PlusCircle className="h-4 w-4" /> Create room
            </button>
            <button
              onClick={() => setJoinModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#454545] bg-[#262626] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-[#303030] focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <LogIn className="h-4 w-4" /> Join room
            </button>
          </div>
        </section>

        {/* LeetCode search */}
        <div className="relative mb-6 rounded-xl border border-[#303030] bg-[#1A1A1A] p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A1A1A1]">LeetCode</p>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                <Search className="h-5 w-5 text-[#FFA116]" /> Search questions
              </h2>
            </div>
            <p className="text-xs text-[#858585]">Search by title or topic, then open it in your editor.</p>
          </div>
          <div className="relative">
            <input
              type="text"
              id="problem-search"
              placeholder="Try “Two Sum”, “Reverse Integer”, or “Valid Parentheses”…"
              value={leetcodeQuery}
              onChange={(e) => setLeetcodeQuery(e.target.value)}
              onFocus={() => leetcodeResults.length > 0 && setShowLeetcodeDropdown(true)}
              onBlur={() => setTimeout(() => setShowLeetcodeDropdown(false), 200)}
              className="w-full rounded-lg border border-[#3D3D3D] bg-[#141414] py-3 pl-11 pr-12 text-sm text-slate-100 transition placeholder:text-[#777] focus:border-[#777] focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {isSearchingLeetcode && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* LeetCode Search Results Dropdown */}
          {showLeetcodeDropdown && leetcodeResults.length > 0 && (
            <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-[#3A3A3A] bg-[#1D1D1D] shadow-2xl">
              {leetcodeResults.map((problem, index) => (
                <div
                  key={`${problem.titleSlug}-${index}`}
                  className="border-b border-[#303030] p-4 transition-colors hover:bg-[#282828]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-semibold text-slate-100">{problem.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex py-0.5 px-2 rounded-full text-[10px] font-extrabold uppercase ${problem.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' : problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                          {problem.difficulty}
                        </span>
                        {problem.acRate && (
                          <span className="text-[10px] text-slate-500">
                            {Math.round(problem.acRate)}% Acceptance
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleLeetCodeProblemSelect(problem)}
                      className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-[#FFA116] px-3 py-2 text-xs font-bold text-[#1A1A1A] transition-colors hover:bg-[#ffb13b] focus:outline-none focus:ring-2 focus:ring-[#FFA116]/50"
                      aria-label={`Open ${problem.title} in the editor`}
                    >
                      Open in editor <Play className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showLeetcodeDropdown && leetcodeSearchError && !isSearchingLeetcode && (
            <div role="status" className="absolute z-50 mt-2 w-full rounded-xl border border-red-500/30 bg-[#1D1D1D] p-4 shadow-2xl">
              <p className="text-sm text-red-300 text-center">{leetcodeSearchError}</p>
            </div>
          )}

          {showLeetcodeDropdown && !leetcodeSearchError && leetcodeResults.length === 0 && leetcodeQuery.trim().length >= 2 && !isSearchingLeetcode && (
            <div className="absolute z-50 mt-2 w-full rounded-xl border border-[#3A3A3A] bg-[#1D1D1D] p-4 shadow-2xl">
              <p className="text-sm text-slate-500 text-center">No problems found</p>
            </div>
          )}
        </div>

        {/* Grid panel */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Challenge list */}
          <div className="lg:col-span-2 space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#303030] bg-[#1A1A1A]">
              <div className="flex flex-col gap-4 border-b border-[#303030] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <BookOpen className="h-5 w-5 text-[#FFA116]" /> Problems
                  </h2>
                  <p className="mt-1 text-sm text-[#A1A1A1]">Browse the challenge list or search LeetCode above.</p>
                </div>
                <span className="w-fit rounded-full border border-[#3D3D3D] bg-[#242424] px-3 py-1 text-xs font-medium text-[#C4C4C4]">
                  {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
                </span>
              </div>

              <div className="flex flex-col gap-3 border-b border-[#303030] bg-[#202020] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" aria-label="Filter by difficulty">
                  {[['', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([value, label]) => (
                    <button
                      key={value || 'all'}
                      type="button"
                      onClick={() => setDifficultyFilter(value)}
                      aria-pressed={difficultyFilter === value}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${difficultyFilter === value ? 'bg-[#343434] text-white ring-1 ring-[#515151]' : 'text-[#A1A1A1] hover:bg-[#2A2A2A] hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    placeholder="Filter catalog"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[#3D3D3D] bg-[#141414] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-[#777] focus:border-[#777] focus:outline-none"
                  />
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858585]" />
                </div>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_120px_130px] items-center gap-4 border-b border-[#303030] bg-[#1D1D1D] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#858585] sm:grid">
                <span>Title</span><span>Difficulty</span><span className="text-right">Action</span>
              </div>

              {problems.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <BookOpen className="mx-auto mb-3 h-8 w-8 text-[#666]" />
                  <p className="text-sm font-semibold text-slate-200">No problems found</p>
                  <p className="mt-1 text-xs text-[#858585]">Try a different title or difficulty.</p>
                </div>
              ) : (
                <div>
                  {problems.map((prob, index) => (
                    <div
                      key={prob.id}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 transition-colors hover:bg-[#242424] sm:grid-cols-[minmax(0,1fr)_120px_130px] sm:gap-4 sm:px-5 ${index < problems.length - 1 ? 'border-b border-[#2B2B2B]' : ''}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 w-9 flex-shrink-0 text-xs tabular-nums text-[#777]">{String(index + 1).padStart(2, '0')}</span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-100 sm:text-[15px]">{prob.title}</h3>
                          <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#929292]">
                            {summarizeProblem(prob.description) || 'Open the problem to read the full statement and examples.'}
                          </p>
                        </div>
                      </div>
                      <span className={`col-start-1 row-start-2 ml-12 justify-self-start text-xs font-semibold capitalize sm:col-start-2 sm:row-start-1 sm:ml-0 ${prob.difficulty === 'easy' ? 'text-[#00B8A3]' : prob.difficulty === 'medium' ? 'text-[#FFA116]' : 'text-[#FF6B6B]'}`}>
                        {prob.difficulty}
                      </span>
                      <button
                        onClick={() => {
                          const uniqueSoloId = `SOLO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                          navigate(`/room/${uniqueSoloId}`, {
                            state: { roomName: `Solo: ${prob.title}`, problemId: prob.id }
                          });
                        }}
                        className="col-start-2 row-start-1 inline-flex items-center justify-center gap-1.5 justify-self-end rounded-lg border border-[#454545] bg-[#2B2B2B] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[#FFA116]/50 hover:bg-[#343434] hover:text-white sm:col-start-3"
                      >
                        Solve <Play className="h-3 w-3 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column - Friends Portal System */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Users className="h-5 w-5 text-[#FFA116]" /> Friends
            </h2>

            {/* Friends list container */}
            <div className="space-y-5 rounded-xl border border-[#303030] bg-[#1A1A1A] p-4">
              
              {/* Lookup search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find user by username..."
                  value={searchUserQuery}
                  onChange={handleUserSearch}
                  className="w-full rounded-lg border border-[#3D3D3D] bg-[#141414] py-2.5 pl-10 pr-4 text-sm text-slate-100 transition-colors placeholder:text-[#777] focus:border-[#777] focus:outline-none"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Dynamic search results list dropdown items */}
              {searchUserResults.length > 0 && (
                <div className="bg-slate-900 border border-slate-750 rounded-xl overflow-hidden divide-y divide-slate-800 animate-slide-down">
                  {searchUserResults.map((u) => (
                    <div key={u.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full bg-slate-800" />
                        <span className="text-sm font-semibold text-slate-200">{u.username}</span>
                      </div>
                      <button
                        onClick={() => sendFriendRequest(u.username)}
                        className="p-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white transition-colors cursor-pointer"
                        title="Add Friend"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Incoming Friend requests panel notifications items */}
              {incomingRequests.length > 0 && (
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Pending Invitations</p>
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div key={req.id} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-300">{req.sender?.username || 'Unknown'}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => respondFriendRequest(req.id, 'accept')}
                            className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => respondFriendRequest(req.id, 'reject')}
                            className="p-1 rounded bg-slate-700 hover:bg-slate-650 text-slate-350 transition-colors cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active friends lists items */}
              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Friends ({friends.length})</p>
                {friends.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No friend connections yet.</p>
                ) : (
                  <div className="space-y-3.5 max-h-72 overflow-y-auto">
                    {friends.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img src={f.avatar} alt={f.username} className="w-8.5 h-8.5 rounded-full bg-slate-800 border border-slate-700" />
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0F172A] ${f.status === 'in-room' ? 'bg-blue-500 animate-pulse' : f.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                          </div>
                          <div className="min-w-0">
                            <Link to={`/profile/${f.username}`} className="text-sm font-semibold text-slate-200 hover:text-blue-400 transition-colors block truncate">
                              {f.username}
                            </Link>
                            <span className="text-[10px] text-slate-450 block font-medium">
                              {f.status === 'in-room' ? 'Coding' : f.status === 'online' ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFriend(f.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* CREATE ROOM MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-100">Create Coding Room</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <UserMinus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={createRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Algorithms Marathon"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-750 py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Initial Challenge</label>
                <select
                  value={roomForm.problemId}
                  onChange={(e) => setRoomForm({ ...roomForm, problemId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-750 py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-200"
                >
                  {problems.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.difficulty.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 cursor-pointer mt-2"
              >
                Create and Enter Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-100">Join Coding Room</h3>
              <button onClick={() => setJoinModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <UserMinus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={joinRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Room ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit Code (e.g. A3FG2W)"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-100 uppercase font-mono tracking-widest"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 cursor-pointer mt-2"
              >
                Join Collaborative Workspace
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
