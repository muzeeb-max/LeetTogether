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
import { problemAPI, friendAPI, executionAPI } from '../services/api';
import Navbar from '../components/Navbar';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import * as awarenessProtocol from 'y-protocols/awareness';

const RoomView = () => {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();

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

    const handleUpdate = (update, origin) => {
      if (origin !== 'remote') {
        const currentCode = ydoc.getText('monaco').toString();
        console.log("EMIT code-change", roomId, currentCode);
        socket.emit('editor:yjs-update', update);
      }
    };

    const handleAwarenessUpdate = ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      socket.emit('editor:yjs-awareness', encoder);
    };

    ydoc.on('update', handleUpdate);
    awareness.on('update', handleAwarenessUpdate);

    socket.on('editor:yjs-update', (update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
      codeRef.current = ydoc.getText('monaco').toString();
      console.log("RECEIVED code-change", roomId, codeRef.current);
    });

    socket.on('editor:yjs-awareness', (update) => {
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
    });

    socket.on('editor:yjs-sync-step-1', (stateVector) => {
      const update = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
      socket.emit('editor:yjs-sync-step-2', update);
    });

    socket.on('editor:yjs-sync-step-2', (update) => {
      Y.applyUpdate(ydoc, new Uint8Array(update));
      codeRef.current = ydoc.getText('monaco').toString();
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
              if (ytext.length === 0 && String(syncedRoom.hostId) === String(user?.id)) {
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
          if (ytext.length === 0 && String(syncedRoom.hostId) === String(user?.id)) {
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

    // We still want to update codeRef when content changes for execution
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
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col h-screen overflow-hidden">
      
      {/* 1. Header Workspace Info */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">LT</div>
          <div>
            <h1 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              {room?.roomName || 'Workspace'} 
              <span className="text-[10px] font-mono py-0.5 px-2 bg-slate-800 rounded border border-slate-700 text-slate-400 uppercase">
                ID: {roomId}
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Host: <span className="font-semibold text-slate-300">{host?.username || 'Loading'}</span>
            </p>
          </div>
        </div>

        {/* Dynamic selectors and buttons */}
        <div className="flex items-center gap-3">
          {/* Host problem picker */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowProblemSelector(!showProblemSelector)}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Change Problem <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
              
              {showProblemSelector && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 py-1 max-h-56 overflow-y-auto">
                  {problemsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => changeProblem(p.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
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
                className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Invite Friend <UserPlus className="w-3.5 h-3.5" />
              </button>
              
              {showInviteSelector && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 py-1.5 max-h-56 overflow-y-auto">
                  {friendsList.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4">No online friends available.</p>
                  ) : (
                    friendsList.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => inviteFriend(f.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <img src={f.avatar} alt={f.username} className="w-5 h-5 rounded-full" />
                        {f.username}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voice Integration preview alerts */}
          <button
            onClick={() => alert('Voice feature is coming soon!')}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
            title="Start voice call (Coming Soon)"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Leave room */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Room
          </button>
        </div>
      </header>

      {/* 2. Workspace Body Grid */}
      <div className="flex-grow flex overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Problem Specifications (Spans 25%) */}
        <section className="w-[30%] border-r border-slate-800 bg-[#0F172A] flex flex-col overflow-y-auto p-5">
          {problem ? (
            <div className="space-y-5">
              <div>
                <span className={`inline-flex py-0.5 px-2 rounded-full text-[10px] font-extrabold uppercase mb-2 ${problem.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' : problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                  {problem.difficulty}
                </span>
                <h2 className="text-xl font-black text-white">{problem.title}</h2>
              </div>

              {/* MD Render */}
              <div className="text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                {problem.description}
              </div>

              {/* Examples rendering */}
              {problem?.examples?.map((ex, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Example {idx + 1}</p>
                  <div className="text-xs font-mono space-y-1">
                    <p><span className="text-slate-500">Input:</span> <span className="text-slate-200">{ex?.input}</span></p>
                    <p><span className="text-slate-500">Output:</span> <span className="text-slate-200 font-semibold">{ex?.output}</span></p>
                    {ex?.explanation && (
                      <p className="text-slate-400 leading-normal"><span className="text-slate-500">Explanation:</span> {ex.explanation}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Constraints rendering */}
              {problem.constraints?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-850">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Constraints</p>
                  <ul className="list-disc list-inside text-xs font-mono text-slate-400 space-y-1 pl-1">
                    {problem.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-full text-slate-500 text-sm">
              <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent animate-spin mb-2" />
              Loading problem parameters...
            </div>
          )}
        </section>

        {/* CENTER COLUMN: Code Editor + Outputs Console (Spans 50%) */}
        <section className="w-[50%] flex flex-col border-r border-slate-800 bg-[#0F172A]">
          {/* Top Panel Controls */}
          <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Compiler Terminal</span>
              {typingUser && (
                <span className="text-[10px] text-blue-400 animate-pulse font-medium bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                  {typingUser}
                </span>
              )}
            </div>

            {/* Language Selection */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Language:</label>
              <select
                disabled={!isHost}
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs py-1 px-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-slate-200 font-mono disabled:opacity-50"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
              {!isHost && (
                <span className="text-[9px] text-slate-500 font-semibold" title="Only host can change workspace language.">(Read-Only)</span>
              )}
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-grow min-h-0 relative">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language === 'javascript' ? 'javascript' : language === 'python' ? 'python' : 'java'}
              theme="vs-dark"
              value={codeRef.current}
              options={{
                fontSize: 14,
                fontFamily: 'Fira Code, JetBrains Mono, monospace',
                minimap: { enabled: false },
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12 }
              }}
              onMount={handleEditorDidMount}
              onChange={(val) => {
                // Only update ref, don't trigger re-render
                codeRef.current = val;
              }}
            />
          </div>

          {/* Output Panel Panel (Bottom Console) */}
          <div className="h-[30%] bg-slate-900 border-t border-slate-800 flex flex-col flex-shrink-0 overflow-hidden">
            {/* Console Toolbar */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900 flex-shrink-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Output Terminal Console</span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className={`text-[10px] font-semibold py-1 px-2 rounded transition-colors ${showCustomInput ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Custom Input
                </button>
                <button
                  onClick={runCode}
                  disabled={isExecuting}
                  className="flex items-center gap-1 py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Run Code
                </button>
                <button
                  onClick={submitSolution}
                  disabled={isExecuting}
                  className="flex items-center gap-1 py-1 px-3 bg-blue-600 hover:bg-blue-600 text-white rounded text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Submit Solution
                </button>
              </div>
            </div>

            {/* Console Output contents */}
            <div className="flex-grow p-4 font-mono text-xs overflow-y-auto select-text space-y-3 bg-[#090D16]">
              {showCustomInput && (
                <div className="space-y-1.5 pb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Custom Stdin Input</label>
                  <textarea
                    rows={2}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter input parameters here (e.g. [2,7,11,15]\n9)"
                    className="w-full bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-xs font-mono"
                  />
                </div>
              )}

              {isExecuting ? (
                <div className="flex items-center gap-2 text-blue-400 animate-pulse font-semibold">
                  <div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />
                  Compiling and running code against Judge0 API instances...
                </div>
              ) : executionOutput ? (
                <div className="space-y-2">
                  {/* Status header */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Status:</span>
                    <span
                      className={`font-bold ${
                        executionMode === 'submit'
                          ? executionOutput.success
                            ? 'text-green-400'
                            : 'text-red-400'
                          : executionOutput.status?.id === 3
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {executionMode === 'submit'
                        ? executionOutput.success
                          ? 'Accepted'
                          : 'Wrong Answer'
                        : executionOutput.status?.id === 3
                        ? 'Execution Successful'
                        : executionOutput.status?.description}
                    </span>
                    {executionOutput.time && (
                      <span className="text-[10px] text-slate-500 font-medium">({executionOutput.time}s, {executionOutput.memory ? Math.round(executionOutput.memory / 1024) : 0} KB)</span>
                    )}
                  </div>

                  {/* Submission Test case failures */}
                  {executionMode === 'submit' && executionOutput.failedTestCase && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1.5">
                      <p className="text-red-400 font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Failed Test Case {executionOutput.failedTestCase.testCaseNumber}</p>
                      <p><span className="text-slate-500">Input:</span> <code className="text-slate-300 bg-slate-900/60 px-1 py-0.5 rounded">{executionOutput.failedTestCase.input}</code></p>
                      <p><span className="text-slate-500">Expected:</span> <code className="text-green-400 bg-slate-900/60 px-1 py-0.5 rounded">{executionOutput.failedTestCase.expectedOutput}</code></p>
                      <p><span className="text-slate-500">Actual Output:</span> <code className="text-red-400 bg-slate-900/60 px-1 py-0.5 rounded">{executionOutput.failedTestCase.actualOutput}</code></p>
                    </div>
                  )}

                  {/* Program Stdouts */}
                  {executionOutput.stdout && (
                    <div>
                      <p className="text-slate-500 font-semibold mb-1">Standard Output:</p>
                      <pre className="p-3 bg-slate-900/80 rounded-lg text-slate-200 border border-slate-850 max-h-24 overflow-y-auto whitespace-pre-wrap">{executionOutput.stdout}</pre>
                    </div>
                  )}

                  {/* Program Stderr / Runtime errors */}
                  {executionOutput.stderr && (
                    <div>
                      <p className="text-red-400 font-semibold mb-1">Runtime Error:</p>
                      <pre className="p-3 bg-red-500/5 text-red-300 rounded-lg border border-red-500/20 max-h-24 overflow-y-auto whitespace-pre-wrap">{executionOutput.stderr}</pre>
                    </div>
                  )}

                  {/* Compile logs */}
                  {executionOutput.compile_output && (
                    <div>
                      <p className="text-red-400 font-semibold mb-1">Compilation Logs:</p>
                      <pre className="p-3 bg-red-500/5 text-red-300 rounded-lg border border-red-500/20 max-h-24 overflow-y-auto whitespace-pre-wrap">{executionOutput.compile_output}</pre>
                    </div>
                  )}

                  {/* If successful run with no standard output */}
                  {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compile_output && (
                    <p className="text-slate-400 italic">Process completed with no output logs.</p>
                  )}
                </div>
              ) : (
                <div className="text-slate-600 italic">Run or Submit code to print logs here...</div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Users Presence and Room Chats Sidebar (Spans 20%) */}
        <section className="w-[20%] flex flex-col bg-[#0F172A] overflow-hidden">
          {/* Active Participants Lists */}
          <div className="p-4 border-b border-slate-800 flex-shrink-0">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" /> Active Coders ({participants.length})
            </h3>
            
            <div className="space-y-2 max-h-36 overflow-y-auto pl-0.5">
              {participants?.map((p) => (
                <div key={p?.id} className="flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={p?.avatar} alt={p?.username} className="w-6.5 h-6.5 rounded-full bg-slate-800" />
                    <span className="text-xs font-semibold text-slate-200 truncate">{p?.username}</span>
                    {p?.id === host?.id && (
                      <span className="text-[8px] font-bold py-0.2 px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/25 flex-shrink-0">HOST</span>
                    )}
                  </div>

                  {/* Host kick options */}
                  {isHost && p?.id !== user?.id && (
                    <button
                      onClick={() => kickUser(p?.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all rounded"
                      title="Kick participant"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right chat panel */}
          <div className="flex-grow flex flex-col min-h-0">
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-1.5 bg-slate-900/60 flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Workspace Chat</span>
            </div>

            {/* Chat message content bubble streams */}
            <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-[#0E1524]/60 min-h-0 select-text">
              {chatMessages?.map((msg, idx) => (
                <div key={idx} className={`space-y-0.5 ${msg?.isSystemMessage ? 'text-center' : ''}`}>
                  {msg?.isSystemMessage ? (
                    <span className="inline-block py-0.5 px-2 bg-slate-800/40 rounded text-[9px] font-semibold text-slate-400 border border-slate-800">
                      {msg?.text}
                    </span>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[10px] font-bold ${msg?.senderUsername === user?.username ? 'text-blue-400' : 'text-slate-300'}`}>
                          {msg?.senderUsername}
                        </span>
                        <span className="text-[8px] text-slate-500">
                          {new Date(msg?.createdAt || msg?.timestamp || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-0.5 leading-normal max-w-full break-words bg-slate-800/30 p-2 rounded-lg border border-slate-850/40">
                        {msg?.text}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input elements toolbar footer */}
            <form onSubmit={sendChatMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-grow bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>

      </div>

    </div>
  );
};

export default RoomView;

