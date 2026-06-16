const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'MUZEEB', '.gemini', 'antigravity', 'scratch', 'leettogether', 'frontend', 'src', 'pages', 'RoomView.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const missingContent = `    return () => clearInterval(ticker);
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

`;

content = content.replace('    return (\n    <div className="min-h-screen bg-[#1A1A1A] text-slate-300 flex flex-col h-screen overflow-hidden font-sans">', missingContent + '  return (\n    <div className="min-h-screen bg-[#1A1A1A] text-slate-300 flex flex-col h-screen overflow-hidden font-sans">');

fs.writeFileSync(filePath, content);
console.log('Restored the missing middle section of RoomView.jsx');
