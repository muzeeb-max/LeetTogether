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
<h1 style={{ color: "red" }}>
  TEST DEPLOYMENT MUZEEB
</h1>
const Dashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  // Problems catalog states
  const [problems, setProblems] = useState([]);
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
      setIncomingRequests(requestsRes.data.incoming);
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

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Status Toast Alert */}
        {statusMsg.text && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl z-50 text-sm font-semibold border ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'} animate-fade-in`}>
            {statusMsg.text}
          </div>
        )}

        {/* Welcome and actions row */}
          <h1 style={{ color: "red", fontSize: "50px" }}>
    MUZEEB TEST
  </h1>
        <div className="bg-[#1E293B]/40 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-10 backdrop-blur-sm">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-blue-450">{user.username}</span>!
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-lg">
              Unlock the power of multiplayer coding. Solve challenges together with friends, discuss solutions in real time, and compile on modern runtimes.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/15 transition-all cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" /> Create Room
            </button>
            <button
              onClick={() => setJoinModalOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200 transition-all cursor-pointer"
            >
              <LogIn className="w-5 h-5" /> Join Room
            </button>
          </div>
        </div>

        {/* Grid panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns - Problems List (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" /> Challenge Catalog
              </h2>

              {/* Filters */}
              <div className="flex gap-3">
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-750 text-xs font-semibold py-1.5 px-3 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="hard">Hard Only</option>
                </select>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-800 border border-slate-750 text-xs py-1.5 pl-8 pr-3 rounded-lg focus:outline-none focus:border-blue-500 w-44"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* List problems cards */}
            <div className="grid grid-cols-1 gap-4">
              {problems.length === 0 ? (
                <div className="bg-[#1E293B]/20 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-650" />
                  <p className="text-sm">No matching coding challenges found.</p>
                </div>
              ) : (
                problems.map((prob) => (
                  <div
                    key={prob.id}
                    className="bg-[#1E293B]/40 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex items-center justify-between gap-4 transition-all group hover:bg-[#1E293B]/60"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors">{prob.title}</h3>
                        <span className={`inline-flex py-0.5 px-2 rounded-full text-[10px] font-extrabold uppercase ${prob.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' : prob.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                          {prob.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-slate-450 mt-1 truncate max-w-sm">
                        Constraints: {prob.constraints?.join(', ') || 'Standard limits'}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/room/SOLO-${prob.slug}`, {
                        state: {
                          roomName: `Solo: ${prob.title}`,
                          problemId: prob.id
                        }
                      })}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-750 hover:border-blue-500 transition-all cursor-pointer"
                    >
                      Solve Solo <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - Friends Portal System */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Friend Connections
            </h2>

            {/* Friends list container */}
            <div className="bg-[#1E293B]/40 border border-slate-800 rounded-3xl p-5 space-y-5">
              
              {/* Lookup search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find user by username..."
                  value={searchUserQuery}
                  onChange={handleUserSearch}
                  className="w-full bg-slate-900 border border-slate-750 py-2.5 pl-10 pr-4 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
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
                        <span className="text-xs font-semibold text-slate-300">{req.sender.username}</span>
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
