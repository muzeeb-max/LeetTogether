import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
const Editor = React.lazy(() => import('@monaco-editor/react'));
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
  UserMinus,
  Share2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { problemAPI, friendAPI, executionAPI } from '../services/api';
import Navbar from '../components/Navbar';
import VoicePanel from '../components/VoicePanel';
import YouTubeMusicWidget from '../components/YouTubeMusicWidget';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import * as awarenessProtocol from 'y-protocols/awareness';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';

const ResizeHandle = ({ className = "", direction = "horizontal" }) => (
  <PanelResizeHandle className={`relative flex flex-shrink-0 items-center justify-center bg-white/[0.07] hover:bg-[#7C5CFF] transition-colors group z-10 ${direction === 'horizontal' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'} ${className}`}>
    <div className={`rounded-full bg-[#A0A0A0] group-hover:bg-[#111113] transition-colors ${direction === 'horizontal' ? 'w-0.5 h-6' : 'h-0.5 w-6'}`} />
  </PanelResizeHandle>
);

const ProblemStatement = ({ problem, compact = false }) => {
  if (!problem) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-zinc-400">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-500 border-t-violet-400" />
        <span className="text-sm">Loading your problem…</span>
      </div>
    );
  }

  const paragraphs = String(problem.description || 'Read the prompt carefully, then write a solution in the editor.')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sectionId = compact ? 'mobile-problem' : 'desktop-problem';
  const difficulty = String(problem.difficulty || 'Challenge').toLowerCase();
  const difficultyStyle = difficulty === 'easy'
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    : difficulty === 'medium'
      ? 'border-violet-400/20 bg-violet-400/10 text-violet-200'
      : difficulty === 'hard'
        ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
        : 'border-violet-400/20 bg-violet-400/10 text-violet-200';

  return (
    <article className={compact ? 'space-y-6' : 'space-y-7'}>
      <header className="relative overflow-hidden rounded-2xl border border-[#FFFFFF12] bg-gradient-to-br from-[#17171B] via-[#141418] to-[#111113] p-5 shadow-lg shadow-black/10">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">Problem</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-white">{problem.title}</h2>
          </div>
          <span className={`mt-1 flex-shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${difficultyStyle}`}>
            {difficulty}
          </span>
        </div>
      </header>

      <section aria-labelledby={`${sectionId}-statement-heading`}>
        <h3 id={`${sectionId}-statement-heading`} className="text-sm font-bold text-white">Your task</h3>
        <div className="mt-3 space-y-3 text-[14px] leading-7 text-zinc-300">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
      </section>

      {problem.examples?.length > 0 && (
        <section className="space-y-3" aria-labelledby={`${sectionId}-examples-heading`}>
          <div className="flex items-center justify-between gap-3 border-t border-[#FFFFFF0D] pt-5">
            <h3 id={`${sectionId}-examples-heading`} className="text-sm font-bold text-white">Examples</h3>
            <span className="text-[11px] text-zinc-500">{problem.examples.length} sample {problem.examples.length === 1 ? 'case' : 'cases'}</span>
          </div>
          {problem.examples.map((example, index) => (
            <div key={index} className="rounded-2xl border border-[#FFFFFF0D] bg-[#111113] p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Example {String(index + 1).padStart(2, '0')}</p>
              <div className="grid gap-3">
                <div className="min-w-0">
                  <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">Input</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-[#FFFFFF0D] bg-[#101013] p-3 text-[12px] leading-5 text-violet-100">{example?.input || '—'}</pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">Output</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-[#FFFFFF0D] bg-[#101013] p-3 text-[12px] leading-5 text-emerald-200">{example?.output || '—'}</pre>
                </div>
                {example?.explanation && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">Why it works</p>
                    <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs leading-6 text-zinc-300">{example.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {problem.constraints?.length > 0 && (
        <section className="rounded-2xl border border-[#FFFFFF0D] bg-[#111113] p-4" aria-labelledby={`${sectionId}-constraints-heading`}>
          <h3 id={`${sectionId}-constraints-heading`} className="text-sm font-bold text-white">Constraints</h3>
          <ul className="mt-3 space-y-2">
            {problem.constraints.map((constraint, index) => (
              <li key={index} className="flex items-start gap-2 text-xs leading-5 text-zinc-300">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-400" />
                <code className="break-words font-mono">{constraint}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};

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
  const problemRef = useRef(null);
  const languageRef = useRef('javascript');
  const starterCodeRef = useRef('');
  const isCodeModifiedRef = useRef(false);
  const isApplyingStarterRef = useRef(false);
  // Flag: true while we are applying a remote Yjs update — blocks re-emission
  const isApplyingRemoteRef = useRef(false);
  // Flag: true while we are applying a remote awareness update — blocks re-emission
  const isApplyingRemoteAwarenessRef = useRef(false);
  // Guard: prevent duplicate room joins
  const hasJoinedRoomRef = useRef(false);

  const applyStarterCode = (nextLanguage, problemData = problemRef.current, force = false) => {
    const starters = problemData?.starterCode || [];
    const selected = starters.find((entry) => String(entry.language).toLowerCase() === String(nextLanguage).toLowerCase());
    const ytext = ydocRef.current.getText('monaco');
    const current = ytext.toString();
    const matchesKnownStarter = starters.some((entry) => entry.code === current);

    // Preserve handwritten code. A pristine starter can safely switch with the language.
    if (!force && current && current !== starterCodeRef.current && !matchesKnownStarter) return false;
    const nextCode = selected?.code || '';
    if (current === nextCode) {
      starterCodeRef.current = nextCode;
      isCodeModifiedRef.current = false;
      codeRef.current = nextCode;
      return Boolean(selected);
    }

    isApplyingStarterRef.current = true;
    try {
      ydocRef.current.transact(() => {
        ytext.delete(0, ytext.length);
        if (nextCode) ytext.insert(0, nextCode);
      });
      codeRef.current = nextCode;
      starterCodeRef.current = nextCode;
      isCodeModifiedRef.current = false;
    } finally {
      isApplyingStarterRef.current = false;
    }
    return Boolean(selected);
  };

  // Problem switching (for host)
  const [problemsList, setProblemsList] = useState([]);
  const [showProblemSelector, setShowProblemSelector] = useState(false);

  // Friends invite (for host)
  const [friendsList, setFriendsList] = useState([]);
  const [showInviteSelector, setShowInviteSelector] = useState(false);
  const [roomLinkCopied, setRoomLinkCopied] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState(null);
  const [executionMode, setExecutionMode] = useState(''); // 'run' or 'submit'
  const [customInput, setCustomInput] = useState('');
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const availableTestCases = useMemo(() => {
    if (problem?.testCases?.length) return problem.testCases.filter((testCase) => !testCase.isPrivate).map((testCase, index) => ({ ...testCase, label: `Case ${index + 1}` }));
    return (problem?.examples || []).map((example, index) => ({ input: example.input, expectedOutput: example.output, label: `Example ${index + 1}` }));
  }, [problem]);
  const activeTestCase = availableTestCases[activeTestCaseIndex] || null;

  useEffect(() => {
    setActiveTestCaseIndex(0);
    setCustomInput(availableTestCases[0]?.input || '');
    setExecutionOutput(null);
  }, [problem?.id, problem?.titleSlug]);

  // General timers for Profile statistics tracking
  const [timeSpent, setTimeSpent] = useState(0);

  // Mobile Layout state
  const [activeMobileTab, setActiveMobileTab] = useState('code'); // 'problem', 'code', 'chat', 'voice'
  
  // LeetCode panel states
  const [leftTab, setLeftTab] = useState('description'); // 'description', 'editorial', 'solutions'
  const [consoleTab, setConsoleTab] = useState('testcase'); // 'testcase', 'result', 'console'
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false); // 'problem', 'code', 'social'

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

  // Reset Code

    return () => clearInterval(ticker);
  }, []);

  // Handle LeetCode problem from navigation state
  useEffect(() => {
    const loadLeetCodeProblem = async () => {
      if (state?.isLeetCodeProblem && state?.leetcodeProblem?.titleSlug) {
        try {
          console.log('[RoomView] Loading LeetCode problem:', state.leetcodeProblem.titleSlug);
          const res = await problemAPI.getLeetCodeProblem(state.leetcodeProblem.titleSlug);
          console.log('[RoomView] LeetCode problem loaded:', res.data);
          problemRef.current = res.data;
          setProblem(res.data);
          applyStarterCode(languageRef.current, res.data);
        } catch (err) {
          console.error('[RoomView] Failed to load LeetCode problem:', err.message);
          // Show error but don't crash
          const fallbackProblem = {
            title: state.leetcodeProblem.title,
            difficulty: state.leetcodeProblem.difficulty,
            description: 'Failed to load problem details from LeetCode. Please try again.',
            examples: [],
            constraints: [],
            starterCode: []
          };
          problemRef.current = fallbackProblem;
          setProblem(fallbackProblem);
        }
      }
    };
    loadLeetCodeProblem();
  }, [state?.isLeetCodeProblem, state?.leetcodeProblem?.titleSlug]);

  // 2. Establish live room Socket connections
  useEffect(() => {
    console.log('[RoomView] useEffect triggered, socket:', socket ? socket.id : 'null', 'roomId:', roomId);
    if (!socket) {
      console.log('[RoomView] Socket is null, returning early');
      return;
    }

    // Guard: prevent duplicate room joins
    if (hasJoinedRoomRef.current && socket.id) {
      console.log('[RoomView] Already joined room, skipping duplicate join');
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

    // Join Room request (only once)
    if (!hasJoinedRoomRef.current) {
      console.log('[RoomView] Emitting room:join with:', { roomId, roomName: state?.roomName, problemId: state?.problemId });
      socket.emit('room:join', {
        roomId,
        roomName: state?.roomName,
        problemId: state?.problemId
      });
      hasJoinedRoomRef.current = true;
    }

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
      if (!state?.isLeetCodeProblem && !syncedRoom.currentProblem && syncedRoom.currentProblemId) {
        console.log('[RoomView] currentProblem is null but currentProblemId exists, fetching problem:', syncedRoom.currentProblemId);
        problemAPI.getProblem(syncedRoom.currentProblemId)
          .then(res => {
            console.log('[RoomView] Fetched problem:', res.data);
            problemRef.current = res.data;
            setProblem(res.data);
            if (String(syncedRoom.hostId) === String(user?.id)) applyStarterCode(syncedRoom.programmingLanguage, res.data);
          })
          .catch(err => {
            console.error('[RoomView] Failed to fetch problem:', err.message);
            problemRef.current = null;
            setProblem(null);
          });
      } else if (!state?.isLeetCodeProblem) {
        problemRef.current = syncedRoom.currentProblem;
        setProblem(syncedRoom.currentProblem);
      }
      
      const syncedLanguage = String(syncedRoom.programmingLanguage || 'javascript').toLowerCase();
      languageRef.current = syncedLanguage;
      setLanguage(syncedLanguage);

      // Initialize code editor with matching starter boilerplate if not already typed
      if (String(syncedRoom.hostId) === String(user?.id)) {
        if (state?.isLeetCodeProblem && problemRef.current) {
          applyStarterCode(syncedLanguage, problemRef.current);
        } else if (!state?.isLeetCodeProblem && syncedRoom.currentProblem?.starterCode) {
          problemRef.current = syncedRoom.currentProblem;
          applyStarterCode(syncedLanguage, syncedRoom.currentProblem);
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
      console.log('[RoomView] User left room:', leftId);
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
      problemRef.current = newProblem;
      setProblem(newProblem);
      if (String(updatedRoom.hostId) === String(user?.id)) {
        starterCodeRef.current = '';
        isCodeModifiedRef.current = false;
        applyStarterCode(updatedRoom.programmingLanguage, newProblem, true);
      }
    });

    // Swapping languages triggers
    socket.on('room:language-changed', ({ language: nextLang }) => {
      const normalizedLanguage = String(nextLang || 'javascript').toLowerCase();
      languageRef.current = normalizedLanguage;
      setLanguage(normalizedLanguage);
      // The host has already broadcast the matching starter through Yjs.
      // Peers must never insert a second copy into the shared document.
    });

    // Chat updates triggers
    socket.on('chat:message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    // Clean connections on room leave/unmount
    return () => {
      console.log('[RoomView] Cleanup - removing all socket listeners and leaving room');
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
      hasJoinedRoomRef.current = false;
    };
  }, [roomId, socket]);

  // 3. Editor handler callbacks
  const resetCode = () => {
    if (socket && isHost && problemRef.current?.starterCode) {
      if (window.confirm('Reset the shared editor to this language’s starter code?')) {
        applyStarterCode(languageRef.current, problemRef.current, true);
      }
    } else if (!isHost) {
      window.alert('Only the host can reset the workspace code.');
    }
  };
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme('leetTogetherNight', {
      base: 'vs-dark', inherit: true,
      rules: [{ token: '', foreground: 'E4E4E7' }, { token: 'comment', foreground: '71717A', fontStyle: 'italic' }, { token: 'keyword', foreground: 'B9A7FF' }, { token: 'string', foreground: 'A5E6C4' }],
      colors: { 'editor.background': '#111113', 'editorGutter.background': '#111113', 'editorLineNumber.foreground': '#52525B', 'editorLineNumber.activeForeground': '#A1A1AA', 'editor.lineHighlightBackground': '#FFFFFF08', 'editorCursor.foreground': '#00D4FF', 'editor.selectionBackground': '#7C5CFF55', 'editorIndentGuide.background1': '#FFFFFF0C', 'editorWidget.background': '#17171B', 'editorSuggestWidget.background': '#17171B', 'editorSuggestWidget.border': '#FFFFFF12' }
    });
    monaco.editor.setTheme('leetTogetherNight');

    if (ydocRef.current && awarenessRef.current) {
      const ytext = ydocRef.current.getText('monaco');
      bindingRef.current = new MonacoBinding(ytext, editor.getModel(), new Set([editor]), awarenessRef.current);
    }

    // Keep codeRef in sync for code execution — only fires when content
    // actually changes in the Monaco model (local OR remote via MonacoBinding).
    // NOTE: This does NOT emit anything; it just reads the value.
    editor.onDidChangeModelContent(() => {
      const currentCode = editor.getValue();
      codeRef.current = currentCode;
      if (!isApplyingStarterRef.current && !isApplyingRemoteRef.current) {
        isCodeModifiedRef.current = currentCode !== starterCodeRef.current;
      }
    });
  };

  // Switch challenge (Host capability)
  const changeProblem = (problemId) => {
    if (socket && String(host?.id) === String(user?.id)) {
      socket.emit('room:change-problem', { problemId });
      setShowProblemSelector(false);
    }
  };

  // Switch programming languages
  const changeLanguage = (nextLang) => {
    const normalizedLanguage = String(nextLang || 'javascript').toLowerCase();
    if (normalizedLanguage === languageRef.current) return;
    if (!isHost) return;

    const currentCode = ydocRef.current.getText('monaco').toString();
    const starters = problemRef.current?.starterCode || [];
    const isKnownStarter = !currentCode || currentCode === starterCodeRef.current || starters.some((entry) => entry.code === currentCode);
    const replacingWork = currentCode.length > 0 && !isKnownStarter;
    if (replacingWork && !window.confirm('Switching languages replaces the current shared code. Continue?')) return;

    languageRef.current = normalizedLanguage;
    setLanguage(normalizedLanguage);
    applyStarterCode(normalizedLanguage, problemRef.current, replacingWork);
    socket?.emit('room:change-language', { language: normalizedLanguage });
  };

  // Kick participant
  const kickUser = (targetUserId) => {
    if (socket && String(host?.id) === String(user?.id)) {
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

  // Run the selected public/sample case. Local challenges use stored drivers; external problems use their LeetCode-style function harness.
  const runCode = async () => {
    if (!problem || isExecuting) return;
    setIsExecuting(true);
    setExecutionMode('run');
    setExecutionOutput(null);
    setConsoleTab('result');

    try {
      const currentCode = codeRef.current || '';
      const isExternalProblem = !problem.id && Boolean(problem.titleSlug);
      const expectedOutput = customInput === activeTestCase?.input ? activeTestCase?.expectedOutput : null;
      const res = await executionAPI.runCode(
        currentCode,
        language,
        customInput,
        problem.id || null,
        isExternalProblem ? problem.titleSlug : null,
        expectedOutput
      );
      setExecutionOutput(res.data);
    } catch (err) {
      setExecutionOutput({
        status: { description: 'Execution Error' },
        stderr: err.response?.data?.message || 'Could not start the compiler. Check your input and try again.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Local problems run all private/public tests. External LeetCode problems run the public examples available in the prompt.
  const submitSolution = async () => {
    if (!problem || isExecuting) return;
    setIsExecuting(true);
    setExecutionMode('submit');
    setExecutionOutput(null);
    setConsoleTab('result');

    try {
      const currentCode = codeRef.current || '';
      const isExternalProblem = !problem.id && Boolean(problem.titleSlug);
      const examples = (problem.examples || []).filter((example) => example.input && example.output);
      const res = await executionAPI.submitCode(
        currentCode,
        language,
        problem.id || null,
        room?.roomName || 'Collaborative Room',
        timeSpent,
        isExternalProblem ? problem.titleSlug : null,
        isExternalProblem ? examples : []
      );
      setExecutionOutput(res.data);
    } catch (err) {
      setExecutionOutput({
        success: false,
        lastResult: {
          status: { description: 'Evaluation Error' },
          stderr: err.response?.data?.message || 'Could not submit this solution.'
        }
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const isHost = Boolean(user && host && String(host.id) === String(user.id));

  useEffect(() => {
    problemRef.current = problem;
    if (problem && isHost) applyStarterCode(languageRef.current, problem);
  }, [problem, isHost]);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F6FB] flex flex-col h-screen overflow-hidden font-sans">
      
      {/* 1. Header Workspace Info (LeetCode Style Header) */}
      <header className="bg-[#111113] border-b border-[#FFFFFF0D] px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0 z-10 shadow-lg shadow-black/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-cyan-300 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-violet-500/20">LT</div>
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {room?.roomName || 'Workspace'} 
                <span className="text-[10px] font-mono py-1 px-2 bg-[#17171B] rounded-lg text-[#9BA4B4] border border-[#303745]">
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
                className="flex items-center gap-1.5 py-2 px-3 bg-[#1b1b20] hover:bg-[#26262e] border border-[#FFFFFF12] rounded-lg text-xs font-semibold text-white transition-colors"
              >
                Problem <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
              
              {showProblemSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#17171B] border border-[#FFFFFF12] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {problemsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => changeProblem(p.id)}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#FFFFFF12] text-[#A0A0A0] transition-colors"
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
                className="flex items-center gap-1.5 py-2 px-3 bg-[#1b1b20] hover:bg-[#26262e] border border-[#FFFFFF12] rounded-lg text-xs font-semibold text-white transition-colors"
              >
                Invite <UserPlus className="w-3.5 h-3.5" />
              </button>
              
              {showInviteSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#17171B] border border-[#FFFFFF12] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {friendsList.length === 0 ? (
                    <p className="text-[10px] text-[#A0A0A0] text-center py-3">No online friends available.</p>
                  ) : (
                    friendsList.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => inviteFriend(f.id)}
                        className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#FFFFFF12] text-[#A0A0A0] transition-colors flex items-center gap-2"
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

          {/* YouTube music widget */}
          <YouTubeMusicWidget socket={socket} roomId={roomId} isHost={isHost} participantsCount={participants?.length} />

          {/* Voice status indicator */}
          <div className="hidden md:flex items-center gap-1.5 py-1 px-2.5 bg-[#111113] border border-[#FFFFFF12] rounded-md ml-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              permissionDenied || voiceStatus === 'FAILED' ? 'bg-amber-500' :
              voiceStatus === 'AUDIO RECEIVING' ? 'bg-cyan-400 animate-pulse' :
              voiceStatus === 'CONNECTED' ? 'bg-[#2ECC71] animate-pulse' : 'bg-slate-500'
            }`} />
            <span className="text-[10px] font-semibold text-zinc-400">
              {permissionDenied ? 'No mic' : voiceStatus}
            </span>
          </div>

          <button onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => { setRoomLinkCopied(true); window.setTimeout(() => setRoomLinkCopied(false), 1800); }).catch(() => {})} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white" aria-label="Copy room link"><Share2 className="h-3.5 w-3.5" />{roomLinkCopied ? 'Copied' : 'Share'}</button>

          {/* Leave room */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 py-2 px-3 hover:bg-[#1b1b20] text-zinc-300 rounded-lg text-xs font-medium transition-colors ml-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>
      </header>

      {/* 2. Workspace Body (LeetCode Desktop PanelGroup Layout) */}
      <div className="flex-grow hidden md:flex overflow-hidden min-h-0 bg-[#09090B] p-2.5">
        <PanelGroup orientation="horizontal" id="leettogether-main-layout" resizeTargetMinimumSize={14}>
          
          {/* LEFT PANEL: Problem */}
          <Panel defaultSize="29%" minSize="22%" collapsible={true} onCollapse={() => setLeftPanelCollapsed(true)} onExpand={() => setLeftPanelCollapsed(false)} className="bg-[#111113] border border-[#FFFFFF0D] rounded-2xl flex flex-col overflow-hidden">
            {leftPanelCollapsed ? (
              <div className="flex flex-col items-center py-4 h-full cursor-pointer hover:bg-[#FFFFFF12]/20" onClick={() => {
                // Programmatic uncollapse is tricky with PanelGroup unless we use imperative API, 
                // but user can drag the handle back. We can show a placeholder.
                alert('Drag the handle to expand the Problem panel.');
              }}>
                <MessageSquare className="w-4 h-4 text-[#A0A0A0]" />
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center bg-[#111113] border-b border-[#FFFFFF0D] px-3 flex-shrink-0">
                  <button onClick={() => setLeftTab('description')} className={`px-3.5 py-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${leftTab === 'description' ? 'border-violet-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}>
                    <MessageSquare className="w-3 h-3" /> Description
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 lg:p-5 custom-scrollbar">
                  {leftTab === 'description' && <ProblemStatement problem={problem} />}
                </div>
              </>
            )}
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* CENTER PANEL: Editor + Bottom Console */}
          <Panel defaultSize="54%" minSize="40%" className="bg-[#111113] border border-[#FFFFFF0D] rounded-2xl flex flex-col overflow-hidden mx-1.5">
            <PanelGroup orientation="vertical" id="leettogether-editor-layout">
              
              {/* Top: Editor */}
              <Panel defaultSize="72%" minSize="35%" className="flex flex-col min-h-0">
                {/* Editor Header */}
                <div className="min-h-14 px-4 py-2 bg-[#17171B] border-b border-[#FFFFFF0F] flex items-center justify-between gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="hidden sm:block min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#858B98]">Workspace</p>
                      <p className="text-sm font-semibold text-white truncate">{problem?.title || room?.roomName || 'Code editor'}</p>
                    </div>
                    <select
                      disabled={!isHost}
                      value={language}
                      onChange={(e) => changeLanguage(e.target.value)}
                      aria-label="Programming language"
                      className="bg-[#202026] border border-[#FFFFFF18] text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/40 text-white font-medium cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python 3</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="csharp">C#</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                      <option value="typescript">TypeScript</option>
                                                                                                            </select>
                    {!isHost && (
                      <span className="hidden sm:inline text-[11px] text-[#9298A4]" title="Only the room host can change the shared language.">Host controls language</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {typingUser && (
                      <span className="text-[10px] text-[#2ECC71] animate-pulse font-medium mr-2">
                        {typingUser} is typing...
                      </span>
                    )}
                    <button
                      onClick={resetCode}
                      className="flex items-center gap-1.5 py-2 px-3 hover:bg-[#202026] text-[#CBD0D8] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Reset Code
                    </button>
                    <button
                      onClick={runCode}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 py-2 px-3 bg-[#26262e] hover:bg-[#414650] text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-[#2ECC71]" /> Run
                    </button>
                    <button
                      onClick={submitSolution}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 py-2 px-3 bg-[#2ECC71] hover:bg-[#25B967] text-[#071a12] rounded-lg text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" /> {problem?.id ? 'Submit' : 'Check examples'}
                    </button>
                  </div>
                </div>

                <div className="flex-grow relative">
                  <Suspense fallback={<div className="grid h-full place-items-center text-xs text-zinc-500">Loading editor…</div>}>
                  <Editor
                    height="100%"
                    language={language}
                    theme="leetTogetherNight"
                    options={{
                      fontSize: 14,
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
                  </Suspense>
                </div>
              </Panel>

              <ResizeHandle direction="vertical" />

              {/* Bottom: Console */}
              <Panel defaultSize="28%" minSize="15%" className="bg-[#111113] flex flex-col min-h-0">
                <div className="flex items-center bg-[#17171B] border-b border-[#FFFFFF12] px-2 flex-shrink-0">
                  <button onClick={() => setConsoleTab('testcase')} className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 ${consoleTab === 'testcase' ? 'border-[#7C5CFF] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}`}>
                    Testcase
                  </button>
                  <button onClick={() => setConsoleTab('result')} className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 ${consoleTab === 'result' ? 'border-[#7C5CFF] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}`}>
                    Result
                  </button>
                  <button onClick={() => setConsoleTab('console')} className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 ${consoleTab === 'console' ? 'border-[#7C5CFF] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}`}>
                    Console
                  </button>
                </div>
                <div className="flex-grow p-4 font-mono text-[13px] overflow-y-auto select-text bg-[#101013] custom-scrollbar">
                  {consoleTab === 'testcase' && (
                    <div className="flex h-full min-h-0 flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">Test cases</p>
                          <p className="mt-1 text-[10px] text-zinc-500">Run checks the selected case. Submit checks {problem?.id ? 'all test cases' : 'the public examples'}.</p>
                        </div>
                        <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-500">{availableTestCases.length} available</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Choose a testcase">
                        {availableTestCases.map((testCase, index) => (
                          <button key={`${testCase.label}-${index}`} role="tab" aria-selected={activeTestCaseIndex === index} onClick={() => { setActiveTestCaseIndex(index); setCustomInput(testCase.input || ''); setExecutionOutput(null); }} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition ${activeTestCaseIndex === index ? 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/20' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200'}`}>{testCase.label}</button>
                        ))}
                        <button onClick={() => { setActiveTestCaseIndex(-1); setCustomInput(''); setExecutionOutput(null); }} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition ${activeTestCaseIndex === -1 ? 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/20' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200'}`}>Custom</button>
                      </div>
                      <label className="flex min-h-0 flex-1 flex-col gap-2 text-[10px] font-medium text-zinc-400">
                        Input <span className="font-normal text-zinc-600">Use the sample format shown in the prompt</span>
                        <textarea
                          value={customInput}
                          onChange={(event) => { setCustomInput(event.target.value); setActiveTestCaseIndex(-1); setExecutionOutput(null); }}
                          placeholder="Example: nums = [2,7,11,15], target = 9"
                          aria-label="Selected testcase input"
                          className="min-h-20 flex-1 rounded-xl border border-white/[0.08] bg-[#17171B] p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/10 resize-none custom-scrollbar"
                        />
                      </label>
                    </div>
                  )}
                  {consoleTab === 'result' && (
                    <div className="h-full">
                      {isExecuting ? (
                        <div className="flex items-center gap-2 text-[#A0A0A0] h-full justify-center">
                          <div className="w-4 h-4 rounded-full border-2 border-[#A0A0A0] border-t-transparent animate-spin" />
                          Evaluating...
                        </div>
                      ) : executionOutput ? (
                        <div className="space-y-4">
                          <div className="flex items-baseline gap-3">
                            <span className={`text-lg font-semibold ${
                                executionMode === 'submit'
                                  ? executionOutput.success ? 'text-[#2ECC71]' : 'text-red-400'
                                  : executionOutput.outputMatches === true || (executionOutput.outputMatches == null && executionOutput.status?.id === 3) ? 'text-[#2ECC71]' : 'text-red-400'
                              }`}>
                              {executionMode === 'submit'
                                ? executionOutput.success ? executionOutput.examplesOnly ? 'All examples passed' : 'Accepted' : executionOutput.failedTestCase?.status || 'Wrong Answer'
                                : executionOutput.outputMatches === true ? 'Sample passed' : executionOutput.outputMatches === false ? 'Wrong Answer' : executionOutput.status?.id === 3 ? 'Run complete' : executionOutput.status?.description || 'Execution error'}
                            </span>
                            {executionOutput.time && (
                              <span className="text-[11px] text-[#A0A0A0]">Runtime: {executionOutput.time}s, Memory: {executionOutput.memory ? Math.round(executionOutput.memory / 1024) : 0} MB</span>
                            )}
                          </div>

                          {executionMode === 'run' && executionOutput.expectedOutput != null && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div><p className="mb-1 text-[10px] text-zinc-500">Expected</p><pre className="rounded-xl border border-white/[0.06] bg-[#17171B] p-3 text-xs text-zinc-200">{executionOutput.expectedOutput}</pre></div>
                              <div><p className="mb-1 text-[10px] text-zinc-500">Your output</p><pre className={`rounded-xl border p-3 text-xs ${executionOutput.outputMatches ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200' : 'border-rose-400/15 bg-rose-400/[0.06] text-rose-200'}`}>{executionOutput.stdout || executionOutput.compile_output || executionOutput.stderr || 'No output'}</pre></div>
                            </div>
                          )}
                          {executionMode === 'submit' && executionOutput.examplesOnly && <p className="text-[11px] text-zinc-500">This external challenge is checked against its public examples only; hidden LeetCode tests are not available in this workspace.</p>}
                          {executionMode === 'submit' && executionOutput.failedTestCase && (
                            <div className="space-y-3">
                              <p className="text-[#FFFFFF] font-semibold text-[11px]">Failed Test Case {executionOutput.failedTestCase.testCaseNumber}</p>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Input</p>
                                  <div className="bg-[#111113] p-3 rounded-lg border border-[#FFFFFF0D] text-slate-200 break-all">{executionOutput.failedTestCase.input}</div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Output</p>
                                  <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-red-300 break-all">{executionOutput.failedTestCase.actualOutput}</div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Expected</p>
                                  <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-emerald-300 break-all">{executionOutput.failedTestCase.expectedOutput}</div>
                                </div>
                              </div>
                            </div>
                          )}
                          {!executionOutput.failedTestCase && executionOutput.stdout && (
                            <p className="text-[#A0A0A0] italic text-[11px]">Check Console tab for stdout.</p>
                          )}
                          {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compile_output && executionMode !== 'submit' && (
                            <p className="text-[#A0A0A0] italic text-[11px]">Finished evaluation.</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#A0A0A0] italic text-[11px]">
                          You must run your code first.
                        </div>
                      )}
                    </div>
                  )}
                  {consoleTab === 'console' && (
                    <div className="h-full">
                      {executionOutput ? (
                         <div className="space-y-4">
                            {executionOutput.stdout && (
                              <div>
                                <p className="text-[10px] text-[#A0A0A0] mb-1">Stdout</p>
                                <pre className="bg-[#17171B] p-2 rounded-sm border border-[#FFFFFF12] text-[#FFFFFF] whitespace-pre-wrap">{executionOutput.stdout}</pre>
                              </div>
                            )}

                            {executionOutput.stderr && (
                              <div>
                                <p className="text-[10px] text-red-400 mb-1">Runtime Error</p>
                                <pre className="bg-red-500/10 p-2 rounded-sm border border-red-500/20 text-red-400 whitespace-pre-wrap">{executionOutput.stderr}</pre>
                              </div>
                            )}
                            {executionOutput.compile_output && (
                              <div>
                                <p className="text-[10px] text-red-400 mb-1">Compile Error</p>
                                <pre className="bg-red-500/10 p-2 rounded-sm border border-red-500/20 text-red-400 whitespace-pre-wrap">{executionOutput.compile_output}</pre>
                              </div>
                            )}
                            {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compile_output && (
                              <p className="text-[#A0A0A0] italic text-[11px]">No stdout produced.</p>
                            )}
                         </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#A0A0A0] italic text-[11px]">
                          Nothing in console.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* RIGHT PANEL: Social */}
          <Panel defaultSize="17%" minSize="15%" className="bg-[#111113] border border-[#FFFFFF0D] rounded-2xl flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-[#FFFFFF12] bg-[#17171B] flex-shrink-0 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#A0A0A0]" />
              <span className="text-xs font-bold text-white">Room activity</span>
            </div>
            
            <div className="bg-[#111113] p-2 flex-shrink-0 border-b border-[#FFFFFF12]">
              <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                {participants?.map((p) => (
                  <div key={p?.id} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={p?.avatar} alt={p?.username} className="w-5 h-5 rounded bg-[#17171B] object-cover" />
                      <span className="text-xs font-medium text-slate-100 truncate">{p?.username}</span>
                      {String(p?.id) === String(host?.id) && (
                        <span className="text-[7px] font-bold py-0.5 px-1 bg-[#7C5CFF]/10 text-[#7C5CFF] rounded flex-shrink-0">HOST</span>
                      )}
                    </div>
                    {isHost && String(p?.id) !== String(user?.id) && (
                      <button
                        onClick={() => kickUser(p?.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#A0A0A0] hover:text-red-400 hover:bg-red-500/10 transition-all rounded"
                      >
                        <UserMinus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111113] border-b border-[#FFFFFF12] flex-shrink-0 overflow-hidden">
              <VoicePanel
                isMuted={isMuted}
                toggleMute={toggleMute}
                voiceUsers={voiceUsers}
                isConnected={isConnected}
                permissionDenied={permissionDenied}
                currentUserId={user?.id?.toString()}
              />
            </div>

            <div className="flex-grow flex flex-col bg-[#111113] overflow-hidden min-h-0">
              <div className="flex-grow p-2 overflow-y-auto space-y-3 custom-scrollbar select-text">
                {chatMessages?.map((msg, idx) => (
                  <div key={idx} className={`space-y-1 ${msg?.isSystemMessage ? 'text-center' : ''}`}>
                    {msg?.isSystemMessage ? (
                      <span className="inline-block py-0.5 px-2 bg-[#17171B] rounded text-[9px] text-[#A0A0A0] border border-[#FFFFFF12]">
                        {msg?.text}
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-[10px] font-semibold ${msg?.senderUsername === user?.username ? 'text-[#2ECC71]' : 'text-[#A0A0A0]'}`}>
                            {msg?.senderUsername}
                          </span>
                        </div>
                        <div className="text-xs text-slate-100 mt-1 leading-relaxed break-words bg-[#17171B] py-1.5 px-2.5 rounded-sm border border-[#FFFFFF12] inline-block self-start max-w-[90%]">
                          {msg?.text}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={sendChatMessage} className="p-2 bg-[#17171B] border-t border-[#FFFFFF12] flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-grow bg-[#111113] border border-[#FFFFFF12] py-1 px-2 rounded-sm text-[11px] text-[#FFFFFF] focus:outline-none focus:border-[#5E5E62] placeholder-[#A0A0A0]"
                />
                <button
                  type="submit"
                  className="p-1 rounded-sm bg-[#FFFFFF12] hover:bg-[#303038] text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </Panel>

        </PanelGroup>
      </div>

      {/* 3. Mobile Fallback View (Original activeMobileTab layout) */}
      <div className="md:hidden flex-grow flex flex-col overflow-hidden min-h-0 bg-[#09090B] p-2.5 gap-2">
        {/* We keep the mobile fallback simple to preserve functionality */}
        {activeMobileTab === 'problem' && (
          <div className="flex-grow rounded-2xl border border-[#FFFFFF0D] bg-[#111113] p-4 overflow-y-auto custom-scrollbar">
            <ProblemStatement problem={problem} compact />
          </div>
        )}
        {activeMobileTab === 'code' && (
          <div className="flex-grow flex flex-col bg-[#111113] border border-[#FFFFFF0F] rounded-xl overflow-hidden min-h-0">
            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#17171B] border-b border-[#FFFFFF0F]">
              <select
                disabled={!isHost}
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Programming language"
                className="min-w-0 bg-[#202026] border border-[#FFFFFF18] text-xs py-2 px-2.5 rounded-lg text-white disabled:opacity-70"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python 3</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="typescript">TypeScript</option>
                                                                              </select>
              <div className="flex items-center gap-1.5">
                <button onClick={resetCode} className="px-2.5 py-2 rounded-lg text-xs text-zinc-300 bg-[#202026]">Reset</button>
                <button onClick={runCode} disabled={isExecuting} className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-violet-500 disabled:opacity-50">Run</button>
                <button onClick={submitSolution} disabled={isExecuting} className="px-3 py-2 rounded-lg text-xs font-bold text-[#071a12] bg-[#2ECC71] disabled:opacity-50">{problem?.id ? 'Submit' : 'Check examples'}</button>
              </div>
            </div>
            <div className="flex-grow relative min-h-0">
              <Suspense fallback={<div className="grid h-full place-items-center text-xs text-zinc-500">Loading editor…</div>}>
              <Editor
                height="100%"
                language={language}
                theme="leetTogetherNight"
                options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }}
                onMount={handleEditorDidMount}
              />
              </Suspense>
            </div>
          </div>
        )}
        {activeMobileTab === 'chat' && (
           <div className="flex-grow bg-[#17171B] border border-[#FFFFFF12] p-4 text-[#A0A0A0] text-sm flex items-center justify-center">
             Chat not optimized for mobile yet.
           </div>
        )}
        {activeMobileTab === 'voice' && (
           <div className="flex-grow bg-[#17171B] border border-[#FFFFFF12] p-4">
             <VoicePanel isMuted={isMuted} toggleMute={toggleMute} voiceUsers={voiceUsers} isConnected={isConnected} permissionDenied={permissionDenied} currentUserId={user?.id?.toString()} />
           </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden bg-[#17171B] border-t border-[#FFFFFF12] flex justify-around p-2 flex-shrink-0 z-10 pb-safe">
        <button onClick={() => setActiveMobileTab('problem')} className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'problem' ? 'text-[#7C5CFF]' : 'text-[#A0A0A0]'}`}>
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Problem</span>
        </button>
        <button onClick={() => setActiveMobileTab('code')} className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'code' ? 'text-[#7C5CFF]' : 'text-[#A0A0A0]'}`}>
          <Play className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Code</span>
        </button>
        <button onClick={() => setActiveMobileTab('chat')} className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'chat' ? 'text-[#7C5CFF]' : 'text-[#A0A0A0]'}`}>
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Chat</span>
        </button>
        <button onClick={() => setActiveMobileTab('voice')} className={`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 ${activeMobileTab === 'voice' ? 'text-[#7C5CFF]' : 'text-[#A0A0A0]'}`}>
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Voice</span>
        </button>
      </div>
    </div>
  );
};
export default RoomView;


