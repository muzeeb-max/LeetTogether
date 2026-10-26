import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, ArrowRight, Bookmark, BookOpen, Clock3, Code2, Flame, LogIn, Plus, Search, Sparkles, Target, UserCheck, UserMinus, UserPlus, Users, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { friendAPI, problemAPI, userAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { Avatar, DifficultyBadge, EmptyState, MetricCard, SectionHeading, Surface } from '../components/ui';

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
  const [profileOverview, setProfileOverview] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => { try { return JSON.parse(localStorage.getItem('leettogether-bookmarks') || '[]'); } catch { return []; } });

  // Modals state management
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: '', problemId: '' });
  const [joinRoomId, setJoinRoomId] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => { fetchDashboardData(); }, []);

  useEffect(() => {
    const create = () => setCreateModalOpen(true);
    const join = () => setJoinModalOpen(true);
    window.addEventListener('leettogether:create-room', create);
    window.addEventListener('leettogether:join-room', join);
    return () => { window.removeEventListener('leettogether:create-room', create); window.removeEventListener('leettogether:join-room', join); };
  }, []);

  useEffect(() => { localStorage.setItem('leettogether-bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);

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

      // Load personal activity and current friend presence.
      const overview = await userAPI.getProfile(user?.username).catch(() => null);
      if (overview?.data) setProfileOverview(overview.data);
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

  const openProblem = (prob) => {
    const uniqueSoloId = `SOLO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    navigate(`/room/${uniqueSoloId}`, { state: { roomName: `Solo: ${prob.title}`, problemId: prob.id } });
  };

  const toggleBookmark = (id) => setBookmarks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

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
    <div className="min-h-screen bg-[#09090B] text-zinc-100 pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Status Toast Alert */}
        {statusMsg.text && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl z-50 text-sm font-semibold border ${statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'} animate-fade-in`}>
            {statusMsg.text}
          </div>
        )}

        <div className="page-shell pb-12 pt-8 sm:pt-10">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }} className="hero-panel relative mb-7 overflow-hidden rounded-[28px] p-6 sm:p-9 lg:p-10" aria-labelledby="dashboard-welcome">
            <div className="pointer-events-none absolute -right-10 -top-28 h-80 w-80 rounded-full bg-violet-500/20 blur-[90px]" />
            <div className="pointer-events-none absolute bottom-[-120px] right-[24%] h-56 w-56 rounded-full bg-cyan-400/10 blur-[80px]" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.08] px-3 py-1.5 text-xs font-medium text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" /> Your collaborative coding space
                </div>
                <h1 id="dashboard-welcome" className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-[48px]">
                  Good to see you, <span className="bg-gradient-to-r from-violet-300 to-cyan-200 bg-clip-text text-transparent">{user?.username || 'coder'}</span>
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">Pick up a challenge, bring a friend into the room, and make progress together.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button onClick={() => setCreateModalOpen(true)} className="button-primary"><Plus className="h-4 w-4" /> Create a room</button>
                  <button onClick={() => setJoinModalOpen(true)} className="button-secondary"><LogIn className="h-4 w-4" /> Join with code</button>
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-3 sm:min-w-[320px]">
                <MetricCard label="Challenges solved" value={profileOverview?.stats?.problemsSolved ?? '—'} detail="Your total progress" icon={Target} accent="violet" />
                <MetricCard label="Friends online" value={friends.filter((friend) => ['online', 'in-room'].includes(friend.status)).length} detail={`${friends.length} connections`} icon={Users} accent="cyan" />
                <MetricCard label="Coding sessions" value={profileOverview?.stats?.sessionsCreated ?? '—'} detail="Rooms you’ve created" icon={Code2} accent="green" className="col-span-2" />
              </div>
            </div>
          </motion.section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-7">
              <Surface className="relative z-20 p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="eyebrow">Find your next challenge</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Search the problem universe</h2></div>
                  <span className="text-xs text-zinc-500">Search by title or topic</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input id="problem-search" type="search" placeholder="Try “Two Sum” or “binary tree”…" value={leetcodeQuery} onChange={(e) => setLeetcodeQuery(e.target.value)} onFocus={() => leetcodeResults.length > 0 && setShowLeetcodeDropdown(true)} onBlur={() => setTimeout(() => setShowLeetcodeDropdown(false), 180)} className="field-input h-12 w-full pl-11 pr-12" aria-label="Search LeetCode problems" />
                  {isSearchingLeetcode && <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />}
                </div>
                {showLeetcodeDropdown && <div className="absolute left-5 right-5 z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#141418]/95 p-2 shadow-2xl backdrop-blur-2xl sm:left-6 sm:right-6">
                  {leetcodeSearchError ? <p role="status" className="p-4 text-sm text-rose-300">{leetcodeSearchError}</p> : leetcodeResults.length ? leetcodeResults.map((problem, index) => <div key={`${problem.titleSlug}-${index}`} className="flex items-center justify-between gap-4 rounded-xl p-3 transition hover:bg-white/[0.04]"><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-100">{problem.title}</p><div className="mt-1 flex items-center gap-2"><DifficultyBadge difficulty={problem.difficulty} />{problem.acRate && <span className="text-xs text-zinc-500">{Math.round(problem.acRate)}% acceptance</span>}</div></div><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleLeetCodeProblemSelect(problem)} className="button-primary !px-3 !py-2 text-xs">Open <ArrowRight className="h-3.5 w-3.5" /></button></div>) : <p className="p-4 text-sm text-zinc-500">No matching challenges found.</p>}
                </div>}
              </Surface>

              <section aria-labelledby="catalog-heading">
                <SectionHeading eyebrow="Curated for your next session" title="Explore challenges" description="Choose a prompt and open a focused coding room in one click." action={<span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">{problems.length} available</span>} />
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2" aria-label="Filter by difficulty">{[['', 'All levels'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([value, label]) => <button key={value || 'all'} onClick={() => setDifficultyFilter(value)} aria-pressed={difficultyFilter === value} className={`rounded-full px-3.5 py-2 text-xs font-medium transition ${difficultyFilter === value ? 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/20' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'}`}>{label}</button>)}</div>
                  <label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Filter this collection" className="field-input h-10 w-full pl-9" /></label>
                </div>
                {problems.length === 0 ? <Surface className="mt-4"><EmptyState icon={BookOpen} title="No challenges in this view" description="Try another title or switch the difficulty filter." /></Surface> : <div className="mt-4 grid gap-4 md:grid-cols-2">{problems.map((prob, index) => <motion.article key={prob.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: index * 0.045 }} className="interactive-card group relative flex min-h-[230px] flex-col rounded-2xl border border-white/[0.06] bg-[#141418] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-400/15 to-cyan-300/10 text-sm font-semibold text-violet-200 ring-1 ring-white/[0.07]">{prob.title?.slice(0, 1)?.toUpperCase() || '◇'}</span><button type="button" onClick={() => toggleBookmark(prob.id)} aria-label={bookmarks.includes(prob.id) ? `Remove ${prob.title} from bookmarks` : `Bookmark ${prob.title}`} aria-pressed={bookmarks.includes(prob.id)} className={`rounded-lg p-2 transition hover:bg-white/[0.06] ${bookmarks.includes(prob.id) ? 'text-violet-300' : 'text-zinc-600 hover:text-zinc-200'}`}><Bookmark className={`h-4 w-4 ${bookmarks.includes(prob.id) ? 'fill-current' : ''}`} /></button></div>
                  <div className="mt-4 flex items-center gap-2"><h3 className="truncate text-base font-semibold text-zinc-100">{prob.title}</h3><DifficultyBadge difficulty={prob.difficulty} /></div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{summarizeProblem(prob.description) || 'Open this challenge to explore the prompt and examples.'}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4"><span className="inline-flex items-center gap-1.5 text-xs text-zinc-600"><Clock3 className="h-3.5 w-3.5" /> {(prob.constraints || []).length} constraints</span><button onClick={() => openProblem(prob)} className="button-primary !px-3.5 !py-2 text-xs">Solve <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></button></div>
                </motion.article>)}</div>}
              </section>

              <section>
                <SectionHeading eyebrow="Your journey" title="Recent sessions" description="A snapshot of your latest coding activity." />
                <Surface className="mt-4 overflow-hidden p-2">
                  {(profileOverview?.recentSessions || []).length === 0 ? <EmptyState icon={Activity} title="Your next session starts here" description="Create a room and your recent coding activity will show up here." action={<button onClick={() => setCreateModalOpen(true)} className="button-secondary">Start a session</button>} /> : <div className="divide-y divide-white/[0.05]">{profileOverview.recentSessions.slice(0, 4).map((session) => <div key={session.id} className="flex items-center gap-3 p-3 sm:gap-4"><span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/[0.04] text-zinc-400"><Code2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-200">{session.problemSolved?.title || session.roomName || 'Coding session'}</p><p className="mt-1 truncate text-xs text-zinc-600">{session.languageUsed || 'Workspace'} · {new Date(session.completedAt).toLocaleDateString()}</p></div><span className="text-xs text-zinc-500">{Math.max(1, Math.round((session.timeSpentSeconds || 0) / 60))} min</span></div>)}</div>}
                </Surface>
              </section>
            </div>

            <aside className="space-y-5">
              <Surface className="p-5 sm:p-6"><SectionHeading eyebrow="This week" title="Your rhythm" description="Sessions logged across your recent activity." />
                <div className="mt-6 flex h-28 items-end justify-between gap-2" aria-label="Recent session activity by day">{Array.from({ length: 7 }, (_, offset) => { const day = new Date(); day.setDate(day.getDate() - (6 - offset)); const count = (profileOverview?.recentSessions || []).filter((session) => new Date(session.completedAt).toDateString() === day.toDateString()).length; return <div key={offset} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${count} sessions`}><div className={`w-full max-w-8 rounded-t-lg transition-all ${count ? 'bg-gradient-to-t from-violet-600 to-cyan-300' : 'bg-white/[0.06]'}`} style={{ height: `${count ? Math.min(100, 24 + count * 30) : 8}%` }} /><span className="text-[10px] text-zinc-600">{day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)}</span></div>; })}</div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs text-zinc-500"><Flame className="h-4 w-4 text-amber-300" />{profileOverview?.stats?.timeSpentCoding ? `${Math.round(profileOverview.stats.timeSpentCoding / 60)} minutes of focused coding` : 'A little progress adds up.'}</div>
              </Surface>

              <Surface className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Your people</p><h2 className="mt-1 text-lg font-semibold text-white">Friends <span className="text-sm font-normal text-zinc-600">{friends.length}</span></h2></div><Users className="h-4 w-4 text-zinc-500" /></div>
                <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={searchUserQuery} onChange={handleUserSearch} placeholder="Find a teammate" aria-label="Find a teammate by username" className="field-input h-10 w-full pl-9" /></div>
                {searchUserResults.length > 0 && <div className="mt-2 rounded-xl border border-white/[0.07] bg-[#111113] p-1">{searchUserResults.map((person) => <div key={person.id} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-white/[0.04]"><div className="flex min-w-0 items-center gap-2"><Avatar src={person.avatar} name={person.username} size="sm" /><span className="truncate text-sm text-zinc-200">{person.username}</span></div><button onClick={() => sendFriendRequest(person.username)} aria-label={`Add ${person.username}`} className="rounded-lg p-2 text-violet-300 hover:bg-violet-400/10"><UserPlus className="h-4 w-4" /></button></div>)}</div>}
                {incomingRequests.length > 0 && <div className="mt-4 border-t border-white/[0.06] pt-4"><p className="mb-2 text-xs font-medium text-zinc-500">Friend requests · {incomingRequests.length}</p>{incomingRequests.map((request) => <div key={request.id} className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-2.5"><span className="truncate text-xs text-zinc-300">{request.sender?.username || 'Someone'} wants to connect</span><div className="flex gap-1"><button onClick={() => respondFriendRequest(request.id, 'accept')} aria-label="Accept request" className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-400/10"><UserCheck className="h-4 w-4" /></button><button onClick={() => respondFriendRequest(request.id, 'reject')} aria-label="Decline request" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06]"><UserMinus className="h-4 w-4" /></button></div></div>)}</div>}
                <div className="mt-4 border-t border-white/[0.06] pt-3">{friends.length === 0 ? <EmptyState icon={Users} title="Your circle starts here" description="Search for a friend to invite them into a room." className="px-2 py-7" /> : <div className="space-y-1">{friends.slice(0, 6).map((friend) => <div key={friend.id} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.035]"><div className="relative"><Avatar src={friend.avatar} name={friend.username} size="sm" /><span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#17171B] ${friend.status === 'in-room' ? 'bg-violet-400' : friend.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-600'}`} /></div><div className="min-w-0 flex-1"><Link to={`/profile/${friend.username}`} className="block truncate text-sm font-medium text-zinc-200 hover:text-violet-200">{friend.username}</Link><p className="text-[11px] text-zinc-600">{friend.status === 'in-room' ? 'In a room' : friend.status === 'online' ? 'Available now' : 'Offline'}</p></div><button onClick={() => removeFriend(friend.id)} aria-label={`Remove ${friend.username}`} className="rounded-lg p-1.5 text-zinc-700 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"><UserMinus className="h-4 w-4" /></button></div>)}</div>}</div>
              </Surface>

              <div className="grid grid-cols-2 gap-3"><button onClick={() => { if (problems.length) openProblem(problems[Math.floor(Math.random() * problems.length)]); else setCreateModalOpen(true); }} className="interactive-card flex flex-col items-start rounded-2xl border border-white/[0.06] bg-[#141418] p-4 text-left"><Zap className="h-4 w-4 text-amber-200" /><span className="mt-4 text-sm font-medium text-zinc-200">Surprise me</span><span className="mt-1 text-[11px] text-zinc-600">Random challenge</span></button><button onClick={() => { document.getElementById('problem-search')?.focus(); document.getElementById('problem-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="interactive-card flex flex-col items-start rounded-2xl border border-white/[0.06] bg-[#141418] p-4 text-left"><Search className="h-4 w-4 text-cyan-200" /><span className="mt-4 text-sm font-medium text-zinc-200">Quick search</span><span className="mt-1 text-[11px] text-zinc-600">Jump to a prompt</span></button></div>
            </aside>
          </div>
        </div>
      </main>

            {/* CREATE ROOM MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171B] border border-white/[0.08] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
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
                  className="w-full bg-[#101013] border border-white/[0.08] py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Initial Challenge</label>
                <select
                  value={roomForm.problemId}
                  onChange={(e) => setRoomForm({ ...roomForm, problemId: e.target.value })}
                  className="w-full bg-[#101013] border border-white/[0.08] py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 text-slate-200"
                >
                  {problems.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} ({p.difficulty.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20 cursor-pointer mt-2"
              >
                Create and Enter Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171B] border border-white/[0.08] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
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
                  className="w-full bg-[#101013] border border-white/[0.08] py-2.5 px-4 rounded-xl text-sm focus:outline-none focus:border-violet-400/50 text-slate-100 uppercase font-mono tracking-widest"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20 cursor-pointer mt-2"
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
