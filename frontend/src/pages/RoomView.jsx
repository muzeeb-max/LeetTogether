import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Play,
  CheckCircle,
  MessageSquare,
  Volume2,
  Users,
  Settings,
  AlertTriangle,
  ChevronRight,
  LogOut,
  Send,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { problemAPI, friendAPI, executionAPI } from '../services/api';
import Navbar from '../components/Navbar';
import VoicePanel from '../components/VoicePanel';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import * as awarenessProtocol from 'y-protocols/awareness';

const RoomView = () => {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();

  // Voice chat — completely isolated WebRTC module
  const { isMuted, toggleMute, voiceUsers, isConnected, permissionDenied, voiceStatus } = useVoiceChat({ socket, roomId, user });

  // Room state
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [host, setHost] = useState(null);
  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState('javascript');
  
  // Editor state
  const codeRef = useRef('');
  const [typingUser, setTypingUser] = useState('');
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [ydoc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new awarenessProtocol.Awareness(ydoc));
  const ydocRef = useRef(ydoc);
  const awarenessRef = useRef(awareness);
  const bindingRef = useRef(null);
  // Flag: true while we are applying a remote Yjs update — blocks re-emission
  const isApplyingRemoteRef = useRef(false);
  // Flag: true while we are applying a remote awareness update — blocks re-emission
  const isApplyingRemoteAwarenessRef = useRef(false);

  // Problem switching (for host)
  const [problemsList, setProblemsList] = useState([]);
  const [showProblemSelector, setShowProblemSelector] = useState(false);

  // Friends invite (for host)
  const [friendsList, setFriendsList] = useState([]);
  const [showInviteSelector, setShowInviteSelector] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState(null);
  const [executionMode, setExecutionMode] = useState(''); // 'run' or 'submit'
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // General timers for Profile statistics tracking
  const [timeSpent, setTimeSpent] = useState(0);

  // Mobile Layout state
  const [activeMobileTab, setActiveMobileTab] = useState('code'); // 'problem', 'code', 'social'

  // 1. Fetch auxiliary lists (Problems, Friends) for selector panels
  useEffect(() => {
    const fetchAuxiliary = async () => {
      try {
        const probRes = await problemAPI.getProblems();
        setProblemsList(probRes.data);

        const friendRes = await friendAPI.getFriends();
        setFriendsList(friendRes.data);
      } catch (err) {
        console.error('Failed to load auxiliary items:', err.message);
      }
    };
    fetchAuxiliary();

    // Start ticker to count coding duration
    const ticker = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  // 2. Establish live room Socket connections
  useEffect(() => {
    console.log('[RoomView] useEffect triggered, socket:', socket ? 'connected' : 'null', 'roomId:', roomId);
    if (!socket) {
      console.log('[RoomView] Socket is null, returning early');
      return;
    }

    // Clean up any existing listeners before registering new ones (prevent duplicates)
    socket.off('room:sync-state');
    socket.off('editor:yjs-update');
    socket.off('editor:yjs-awareness');
    socket.off('editor:yjs-sync-step-1');
    socket.off('editor:yjs-sync-step-2');
    socket.off('room:user-joined');
    socket.off('room:user-left');
    socket.off('room:kicked-alert');
    socket.off('room:problem-changed');
    socket.off('room:language-changed');
    socket.off('chat:message');

    // Ensure refs are set to our single instances
    ydocRef.current = ydoc;
    awarenessRef.current = awareness;

    awareness.setLocalStateField('user', {
      name: user?.username || 'Anonymous',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
    });

    // ── Yjs document update handler ────────────────────────────────────────
    // Guards:
    //   1. isApplyingRemoteRef: set true while we process an inbound socket
    //      update — prevents re-broadcasting the remote change back out.
    //   2. origin check: MonacoBinding tags its transactions with its own
    //      instance as origin (not the string 'remote'), so non-remote origin
    //      means a genuine local user edit.
    const handleUpdate = (update, origin) => {
      // Belt-and-suspenders: if we are mid-application of a remote update,
      // never re-emit regardless of what origin Yjs reports.
      if (isApplyingRemoteRef.current) {
        console.log('[REMOTE_EDIT] Yjs update suppressed (isApplyingRemote=true), origin:', origin);
        return;
      }
      if (origin === 'remote') {
        console.log('[REMOTE_EDIT] Yjs update suppressed (origin=remote)');
        return;
      }
      // Genuine local edit — safe to emit
      console.log('[LOCAL_EDIT] User typed — preparing to emit');
      console.log('[EMIT_CODE_CHANGE] Emitting editor:yjs-update to room', roomId);
      socket.emit('editor:yjs-update', update);
    };

    // ── Awareness update handler ───────────────────────────────────────────
    // Guard against re-emitting awareness updates received from socket
    const handleAwarenessUpdate = ({ added, updated, removed }) => {
      if (isApplyingRemoteAwarenessRef.current) return;
      const changedClients = added.concat(updated).concat(removed);
      const encoder = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      socket.emit('editor:yjs-awareness', encoder);
    };

    ydoc.on('update', handleUpdate);
    awareness.on('update', handleAwarenessUpdate);

    // ── Inbound editor update from a remote peer ───────────────────────────
    socket.on('editor:yjs-update', (update) => {
      console.log('[RECEIVE_CODE_CHANGE] Received editor:yjs-update from peer in room', roomId);
      // Set flag BEFORE applyUpdate so handleUpdate knows to suppress emission
      isApplyingRemoteRef.current = true;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
        codeRef.current = ydoc.getText('monaco').toString();
        console.log('[REMOTE_EDIT] Applied remote Yjs update. Content length:', codeRef.current.length);
      } finally {
        // Always clear flag even if applyUpdate throws
        isApplyingRemoteRef.current = false;
      }
    });

    // ── Inbound awareness update from a remote peer ────────────────────────
    socket.on('editor:yjs-awareness', (update) => {
      isApplyingRemoteAwarenessRef.current = true;
      try {
        awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
      } finally {
        isApplyingRemoteAwarenessRef.current = false;
      }
    });

    socket.on('editor:yjs-sync-step-1', (stateVector) => {
      const update = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
      socket.emit('editor:yjs-sync-step-2', update);
    });

    // FIX BUG 2: Must pass 'remote' origin so handleUpdate does NOT re-emit
    // this full document sync back to all peers as a local edit.
    socket.on('editor:yjs-sync-step-2', (update) => {
      console.log('[RECEIVE_CODE_CHANGE] Received editor:yjs-sync-step-2 (initial doc sync)');
      isApplyingRemoteRef.current = true;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
        codeRef.current = ydoc.getText('monaco').toString();
        console.log('[REMOTE_EDIT] Applied initial doc sync. Content length:', codeRef.current.length);
      } finally {
        isApplyingRemoteRef.current = false;
      }
    });

    // Join Room request
    console.log('[RoomView] Emitting room:join with:', { roomId, roomName: state?.roomName, problemId: state?.problemId });
    socket.emit('room:join', {
      roomId,
      roomName: state?.roomName,
      problemId: state?.problemId
    });

    // Synchronize full initial room status
    socket.on('room:sync-state', (data) => {
      console.log('[RoomView] Received room:sync-state:', JSON.stringify(data, null, 2));
      const { room: syncedRoom } = data;
      if (!syncedRoom) return;
      setRoom(syncedRoom);
      setParticipants(syncedRoom.participants || []);
      setHost(syncedRoom.host);
      console.log('[RoomView] Setting problem from syncedRoom.currentProblem:', syncedRoom.currentProblem);
      
      // If currentProblem is null, try to fetch it from the problemId
      if (!syncedRoom.currentProblem && syncedRoom.currentProblemId) {
        console.log('[RoomView] currentProblem is null but currentProblemId exists, fetching problem:', syncedRoom.currentProblemId);
        problemAPI.getProblem(syncedRoom.currentProblemId)
          .then(res => {
            console.log('[RoomView] Fetched problem:', res.data);
            setProblem(res.data);
            const starter = res.data.starterCode?.find((c) => c.language === syncedRoom.programmingLanguage);
            if (starter) {
              const ytext = ydoc.getText('monaco');
              if (ytext.length === 0 && String(syncedRoom.hostId) === String(user?.id) && syncedRoom.participants?.length <= 1) {
                console.log("INIT TEMPLATE");
                ytext.insert(0, starter.code);
              }
            }
          })
          .catch(err => {
            console.error('[RoomView] Failed to fetch problem:', err.message);
            setProblem(null);
          });
      } else {
        setProblem(syncedRoom.currentProblem);
      }
      
      setLanguage(syncedRoom.programmingLanguage || 'javascript');

      // Initialize code editor with matching starter boilerplate if not already typed
      if (syncedRoom.currentProblem?.starterCode) {
        const starter = syncedRoom.currentProblem.starterCode.find(
          (c) => c.language === syncedRoom.programmingLanguage
        );
        if (starter) {
          const ytext = ydoc.getText('monaco');
          if (ytext.length === 0 && String(syncedRoom.hostId) === String(user?.id) && syncedRoom.participants?.length <= 1) {
            console.log("ROOM SYNC");
            console.log("INIT TEMPLATE");
            ytext.insert(0, starter.code);
          }
        }
      }

      // Request peer synchronization of Yjs document
      socket.emit('editor:yjs-sync-step-1', Y.encodeStateVector(ydoc));
    });



    // Peer room entrants logs
    socket.on('room:user-joined', ({ user: joinedUser, message }) => {
      if (!joinedUser) return;
      setParticipants((prev) => {
        if (prev.some((p) => p.id === joinedUser.id)) return prev;
        return [...prev, joinedUser];
      });
    });

    // Peer room leave logs
    socket.on('room:user-left', ({ userId: leftId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== leftId));
    });

    // Peer kicks alerts
    socket.on('room:kicked-alert', () => {
      alert('You have been removed from this room by the host.');
      navigate('/');
    });

    // Challenge modifications triggers
    socket.on('room:problem-changed', ({ room: updatedRoom, problem: newProblem }) => {
      console.log("PROBLEM SYNC");
      if (!updatedRoom || !newProblem) return;
      setRoom(updatedRoom);
      setProblem(newProblem);
      // Reset starter code
      const starter = newProblem.starterCode?.find((c) => c.language === updatedRoom.programmingLanguage);
      if (starter) {
        if (String(updatedRoom.hostId) === String(user?.id)) {
          console.log("SET CODE");
          console.log("INIT TEMPLATE");
          const ytext = ydoc.getText('monaco');
          ytext.delete(0, ytext.length);
          ytext.insert(0, starter.code);
        }
      }
    });

    // Swapping languages triggers
    socket.on('room:language-changed', ({ language: nextLang }) => {
      console.log("LANGUAGE SYNC");
      setLanguage(nextLang);
      if (problem?.starterCode) {
        const starter = problem.starterCode.find((c) => c.language === nextLang);
        const newCode = starter ? starter.code : '';
        if (String(room?.hostId) === String(user?.id)) {
          console.log("SET CODE");
          console.log("INIT TEMPLATE");
          const ytext = ydoc.getText('monaco');
          ytext.delete(0, ytext.length);
          ytext.insert(0, newCode);
        }
      }
    });

    // Chat updates triggers
    socket.on('chat:message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    // Clean connections on room leave/unmount
    return () => {
      ydoc.off('update', handleUpdate);
      awareness.off('update', handleAwarenessUpdate);
      socket.emit('room:leave');
      socket.off('room:sync-state');
      socket.off('editor:yjs-update');
      socket.off('editor:yjs-awareness');
      socket.off('editor:yjs-sync-step-1');
      socket.off('editor:yjs-sync-step-2');
      socket.off('room:user-joined');
      socket.off('room:user-left');
      socket.off('room:kicked-alert');
      socket.off('room:problem-changed');
      socket.off('room:language-changed');
      socket.off('chat:message');
    };
  }, [roomId, socket]);

  // 3. Editor handler callbacks
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (ydocRef.current && awarenessRef.current) {
      const ytext = ydocRef.current.getText('monaco');
      bindingRef.current = new MonacoBinding(ytext, editor.getModel(), new Set([editor]), awarenessRef.current);
    }

    // Keep codeRef in sync for code execution — only fires when content
    // actually changes in the Monaco model (local OR remote via MonacoBinding).
    // NOTE: This does NOT emit anything; it just reads the value.
    editor.onDidChangeModelContent(() => {
      codeRef.current = editor.getValue();
    });
  };

  // Switch challenge (Host capability)
  const changeProblem = (problemId) => {
    if (socket && host?.id === user.id) {
      socket.emit('room:change-problem', { problemId });
      setShowProblemSelector(false);
    }
  };

  // Switch programming languages
  const changeLanguage = (nextLang) => {
    // Update local editor immediately
    console.log("LANGUAGE SYNC");
    setLanguage(nextLang);
    if (problem?.starterCode) {
      const starter = problem.starterCode.find((c) => c.language === nextLang);
      const newCode = starter ? starter.code : '';
      if (String(room?.hostId) === String(user?.id)) {
        console.log("SET CODE");
        console.log("INIT TEMPLATE");
        const ytext = ydoc.getText('monaco');
        ytext.delete(0, ytext.length);
        ytext.insert(0, newCode);
      }
    }

    if (socket && host?.id === user.id) {
      socket.emit('room:change-language', { language: nextLang });
    }
  };

  // Kick participant
  const kickUser = (targetUserId) => {
    if (socket && host?.id === user.id) {
      if (confirm('Are you sure you want to remove this participant?')) {
        socket.emit('room:kick', { userIdToKick: targetUserId });
      }
    }
  };

  // Friends invite delivery triggers
  const inviteFriend = (friendId) => {
    if (socket) {
      socket.emit('invite:send', { friendId });
      setShowInviteSelector(false);
      alert('Invitation dispatched successfully!');
    }
  };

  // Chat message delivery trigger
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('chat:message', { text: chatInput.trim() });
    setChatInput('');
  };

  // Run Code trigger (Judge0 API)
  const runCode = async () => {
    if (!problem || isExecuting) return;
    setIsExecuting(true);
    setExecutionMode('run');
    setExecutionOutput(null);

    try {
      const currentCode = codeRef.current || '';
      const res = await executionAPI.runCode(currentCode, language, customInput, problem.id);
      setExecutionOutput(res.data);
    } catch (err) {
      console.error(err);
      setExecutionOutput({
        status: { description: 'Execution Error' },
        stderr: err.response?.data?.message || 'Failed to request compiler.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Submit Code solution trigger (Judge0 API)
  const submitSolution = async () => {
    if (!problem || isExecuting) return;
    setIsExecuting(true);
    setExecutionMode('submit');
    setExecutionOutput(null);

    try {
      const currentCode = codeRef.current || '';
      const res = await executionAPI.submitCode(
        currentCode,
        language,
        problem.id,
        room?.roomName || 'Collaborative Room',
        timeSpent
      );
      
      setExecutionOutput(res.data);
      if (res.data.success) {
        alert('Congratulations! All test cases passed successfully.');
      }
    } catch (err) {
      console.error(err);
      setExecutionOutput({
        success: false,
        lastResult: {
          status: { description: 'Evaluation Error' },
          stderr: 'Solution validation request failed.'
        }
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const isHost = host?.id === user.id;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-slate-300 flex flex-col h-screen overflow-hidden font-sans">
      
      {/* 1. Header Workspace Info (LeetCode Style Header) */}
      <header className="bg-[#282828] border-b border-[#3E3E42] px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-white text-[10px]">LT</div>
            <div className="flex flex-col">
              <h1 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                {room?.roomName || 'Workspace'} 
                <span className="text-[9px] font-mono py-0.5 px-1.5 bg-[#1E1E1E] rounded text-slate-400 border border-[#3E3E42]">
                  ID: {roomId}
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Dynamic selectors and buttons */}
        <div className="flex items-center gap-2">
          {/* Host problem picker */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowProblemSelector(!showProblemSelector)}
                className="flex items-center gap-1.5 py-1 px-2.5 bg-[#3E3E42]/50 hover:bg-[#3E3E42] rounded-md text-[11px] font-medium text-slate-300 transition-colors"
              >
                Problem <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
              
              {showProblemSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#282828] border border-[#3E3E42] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {problemsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => changeProblem(p.id)}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#3E3E42] text-slate-300 transition-colors"
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Host friend invitation trigger */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowInviteSelector(!showInviteSelector)}
                className="flex items-center gap-1.5 py-1 px-2.5 bg-[#3E3E42]/50 hover:bg-[#3E3E42] rounded-md text-[11px] font-medium text-slate-300 transition-colors"
              >
                Invite <UserPlus className="w-3.5 h-3.5" />
              </button>
              
              {showInviteSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#282828] border border-[#3E3E42] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {friendsList.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-3">No online friends available.</p>
                  ) : (
                    friendsList.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => inviteFriend(f.id)}
                        className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#3E3E42] text-slate-300 transition-colors flex items-center gap-2"
                      >
                        <img src={f.avatar} alt={f.username} className="w-4 h-4 rounded-full" />
                        {f.username}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voice status indicator */}
          <div className="hidden md:flex items-center gap-1.5 py-1 px-2.5 bg-[#1E1E1E] border border-[#3E3E42] rounded-md ml-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              permissionDenied || voiceStatus === 'FAILED' ? 'bg-amber-500' :
              voiceStatus === 'AUDIO RECEIVING' ? 'bg-blue-500 animate-pulse' :
              voiceStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
            }`} />
            <span className="text-[9px] font-semibold text-slate-400">
              {permissionDenied ? 'No mic' : voiceStatus}
            </span>
          </div>

          {/* Leave room */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 py-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-[11px] font-medium transition-colors ml-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>
      </header>

      {/* 2. Workspace Body Grid (LeetCode 3-Panel Layout) */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden min-h-0 bg-[#1A1A1A] p-2 gap-2">
        
        {/* LEFT COLUMN: Problem Specifications */}
        <section className={`w-full md:w-[35%] lg:w-[30%] bg-[#282828] rounded-lg border border-[#3E3E42] flex flex-col overflow-hidden ${activeMobileTab === 'problem' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center px-3 py-2 border-b border-[#3E3E42] bg-[#282828] flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[#E0E0E0]">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold">Description</span>
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
            {problem ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">{problem.title}</h2>
                  <span className={`inline-flex py-0.5 px-2.5 rounded-full text-[11px] font-medium ${problem.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' : problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                    {problem.difficulty}
                  </span>
                </div>

                <div className="text-[13px] text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {problem.description}
                </div>

                <div className="space-y-4 mt-6">
                  {problem?.examples?.map((ex, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-200">Example {idx + 1}:</p>
                      <div className="bg-[#1E1E1E] p-3 rounded-md border border-[#3E3E42] text-[12px] font-mono text-slate-300 space-y-1.5 border-l-2 border-l-slate-500">
                        <p><span className="text-slate-400 font-sans font-semibold">Input: </span>{ex?.input}</p>
                        <p><span className="text-slate-400 font-sans font-semibold">Output: </span>{ex?.output}</p>
                        {ex?.explanation && (
                          <p className="leading-relaxed"><span className="text-slate-400 font-sans font-semibold">Explanation: </span>{ex.explanation}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {problem.constraints?.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <p className="text-xs font-semibold text-slate-200">Constraints:</p>
                    <ul className="list-disc list-outside ml-4 text-[12px] font-mono text-slate-300 space-y-1.5">
                      {problem.constraints.map((c, i) => (
                        <li key={i} className="pl-1">
                          <code className="bg-[#1E1E1E] px-1.5 py-0.5 rounded text-slate-300 border border-[#3E3E42]">{c}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-full text-slate-500 text-xs gap-3">
                <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                Loading problem...
              </div>
            )}
          </div>
        </section>

        {/* CENTER COLUMN: Code Editor + Outputs Console */}
        <section className={`w-full md:w-[65%] lg:w-[45%] flex flex-col gap-2 ${activeMobileTab === 'code' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-grow flex flex-col bg-[#1E1E1E] rounded-lg border border-[#3E3E42] overflow-hidden min-h-[50%]">
            <div className="px-3 py-1.5 bg-[#282828] border-b border-[#3E3E42] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <select
                  disabled={!isHost}
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="bg-[#3E3E42]/50 border-none text-[11px] py-1 px-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 font-sans font-medium cursor-pointer disabled:opacity-50 appearance-none"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
                {!isHost && (
                  <span className="text-[9px] text-slate-500" title="Only host can change workspace language.">(Read-Only)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {typingUser && (
                  <span className="text-[10px] text-emerald-400 animate-pulse font-medium">
                    {typingUser} is typing...
                  </span>
                )}
              </div>
            </div>

            <div className="flex-grow relative">
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language === 'javascript' ? 'javascript' : language === 'python' ? 'python' : 'java'}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  minimap: { enabled: false },
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                  renderLineHighlight: "all",
                  cursorBlinking: "smooth"
                }}
                onMount={handleEditorDidMount}
              />
            </div>
          </div>

          <div className="h-[35%] bg-[#282828] rounded-lg border border-[#3E3E42] flex flex-col flex-shrink-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-[#3E3E42] flex items-center justify-between bg-[#282828] flex-shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowCustomInput(true)}
                  className={`text-[11px] font-medium py-1 px-2 rounded-md transition-colors ${showCustomInput ? 'bg-[#3E3E42] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Testcases
                </button>
                <button
                  onClick={() => setShowCustomInput(false)}
                  className={`text-[11px] font-medium py-1 px-2 rounded-md transition-colors ${!showCustomInput ? 'bg-[#3E3E42] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Test Result
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={runCode}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 py-1 px-3 bg-[#3E3E42] hover:bg-[#4E4E52] text-slate-200 rounded-md text-[11px] font-medium disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-emerald-400" /> Run
                </button>
                <button
                  onClick={submitSolution}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 py-1 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 rounded-md text-[11px] font-medium disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-3 h-3" /> Submit
                </button>
              </div>
            </div>

            <div className="flex-grow p-3 font-mono text-[12px] overflow-y-auto select-text bg-[#1E1E1E] custom-scrollbar">
              {showCustomInput ? (
                <div className="h-full flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Custom Input:</span>
                  </div>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter custom input (e.g., [2,7,11,15]
9)"
                    className="flex-grow bg-[#282828] border border-[#3E3E42] p-2 rounded-md text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 text-[12px] font-mono resize-none custom-scrollbar"
                  />
                </div>
              ) : (
                <div className="h-full">
                  {isExecuting ? (
                    <div className="flex items-center gap-2 text-slate-400 h-full justify-center">
                      <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                      Evaluating...
                    </div>
                  ) : executionOutput ? (
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-3">
                        <span
                          className={`text-lg font-semibold ${
                            executionMode === 'submit'
                              ? executionOutput.success ? 'text-emerald-500' : 'text-red-500'
                              : executionOutput.status?.id === 3 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {executionMode === 'submit'
                            ? executionOutput.success ? 'Accepted' : 'Wrong Answer'
                            : executionOutput.status?.id === 3 ? 'Accepted' : executionOutput.status?.description}
                        </span>
                        {executionOutput.time && (
                          <span className="text-[11px] text-slate-500">Runtime: {executionOutput.time}s, Memory: {executionOutput.memory ? Math.round(executionOutput.memory / 1024) : 0} MB</span>
                        )}
                      </div>

                      {executionMode === 'submit' && executionOutput.failedTestCase && (
                        <div className="space-y-3">
                          <p className="text-slate-300 font-semibold text-[11px]">Failed Test Case {executionOutput.failedTestCase.testCaseNumber}</p>
                          <div className="space-y-2">
                            <div>
                              <p className="text-[10px] text-slate-500 mb-1">Input</p>
                              <div className="bg-[#282828] p-2 rounded border border-[#3E3E42] text-slate-300 break-all">{executionOutput.failedTestCase.input}</div>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 mb-1">Output</p>
                              <div className="bg-red-500/10 p-2 rounded border border-red-500/20 text-red-400 break-all">{executionOutput.failedTestCase.actualOutput}</div>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 mb-1">Expected</p>
                              <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20 text-emerald-400 break-all">{executionOutput.failedTestCase.expectedOutput}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {executionOutput.stdout && (
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Stdout</p>
                          <pre className="bg-[#282828] p-2 rounded border border-[#3E3E42] text-slate-300 whitespace-pre-wrap">{executionOutput.stdout}</pre>
                        </div>
                      )}

                      {executionOutput.stderr && (
                        <div>
                          <p className="text-[10px] text-red-400 mb-1">Runtime Error</p>
                          <pre className="bg-red-500/10 p-2 rounded border border-red-500/20 text-red-400 whitespace-pre-wrap">{executionOutput.stderr}</pre>
                        </div>
                      )}
                      {executionOutput.compile_output && (
                        <div>
                          <p className="text-[10px] text-red-400 mb-1">Compile Error</p>
                          <pre className="bg-red-500/10 p-2 rounded border border-red-500/20 text-red-400 whitespace-pre-wrap">{executionOutput.compile_output}</pre>
                        </div>
                      )}
                      
                      {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compile_output && executionMode !== 'submit' && (
                        <p className="text-slate-500 italic text-[11px]">No stdout produced.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic text-[11px]">
                      You must run your code first.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Social */}
        <section className={`w-full lg:w-[25%] flex flex-col gap-2 ${activeMobileTab === 'social' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-[#282828] rounded-lg border border-[#3E3E42] p-3 flex-shrink-0">
            <h3 className="text-[11px] font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Session ({participants.length})
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
              {participants?.map((p) => (
                <div key={p?.id} className="flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={p?.avatar} alt={p?.username} className="w-6 h-6 rounded-md bg-[#1E1E1E] object-cover" />
                    <span className="text-[12px] font-medium text-slate-200 truncate">{p?.username}</span>
                    {p?.id === host?.id && (
                      <span className="text-[8px] font-bold py-0.5 px-1.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 flex-shrink-0">HOST</span>
                    )}
                  </div>
                  {isHost && p?.id !== user?.id && (
                    <button
                      onClick={() => kickUser(p?.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all rounded"
                      title="Kick participant"
                    >
                      <UserMinus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#282828] rounded-lg border border-[#3E3E42] flex-shrink-0 overflow-hidden">
            <VoicePanel
              isMuted={isMuted}
              toggleMute={toggleMute}
              voiceUsers={voiceUsers}
              isConnected={isConnected}
              permissionDenied={permissionDenied}
              currentUserId={user?.id?.toString()}
            />
          </div>

          <div className="flex-grow flex flex-col bg-[#282828] rounded-lg border border-[#3E3E42] overflow-hidden min-h-0">
            <div className="px-3 py-2 border-b border-[#3E3E42] bg-[#282828] flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-300">Room Chat</span>
              </div>
            </div>

            <div className="flex-grow p-3 overflow-y-auto space-y-3 bg-[#1E1E1E] custom-scrollbar select-text">
              {chatMessages?.map((msg, idx) => (
                <div key={idx} className={`space-y-1 ${msg?.isSystemMessage ? 'text-center' : ''}`}>
                  {msg?.isSystemMessage ? (
                    <span className="inline-block py-0.5 px-2 bg-[#282828] rounded-md text-[10px] text-slate-500 border border-[#3E3E42]">
                      {msg?.text}
                    </span>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[10px] font-semibold ${msg?.senderUsername === user?.username ? 'text-blue-400' : 'text-slate-400'}`}>
                          {msg?.senderUsername}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {new Date(msg?.createdAt || msg?.timestamp || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-300 mt-0.5 leading-snug break-words bg-[#282828] py-1.5 px-2.5 rounded-md border border-[#3E3E42] inline-block self-start max-w-[90%]">
                        {msg?.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={sendChatMessage} className="p-2 bg-[#282828] border-t border-[#3E3E42] flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder="Message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-grow bg-[#1E1E1E] border border-[#3E3E42] py-1.5 px-2.5 rounded-md text-[11px] text-slate-200 focus:outline-none focus:border-slate-500 placeholder-slate-600"
              />
              <button
                type="submit"
                className="p-1.5 rounded-md bg-[#3E3E42] hover:bg-[#4E4E52] text-slate-300 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>

      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden bg-[#282828] border-t border-[#3E3E42] flex justify-around p-2 flex-shrink-0 z-10 pb-safe">
        <button
          onClick={() => setActiveMobileTab('problem')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'problem' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Problem</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('code')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'code' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Play className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Code</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('social')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 relative ${activeMobileTab === 'social' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Room</span>
        </button>
      </div>
    </div>
  );
};
export default RoomView;


