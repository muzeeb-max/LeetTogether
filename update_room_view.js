const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'MUZEEB', '.gemini', 'antigravity', 'scratch', 'leettogether', 'frontend', 'src', 'pages', 'RoomView.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const returnRegex = /return \([\s\S]*?\);\n};\n\nexport default RoomView;/;

const newReturn = `return (
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
            <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${
              permissionDenied || voiceStatus === 'FAILED' ? 'bg-amber-500' :
              voiceStatus === 'AUDIO RECEIVING' ? 'bg-blue-500 animate-pulse' :
              voiceStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
            }\`} />
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
        <section className={\`w-full md:w-[35%] lg:w-[30%] bg-[#282828] rounded-lg border border-[#3E3E42] flex flex-col overflow-hidden \${activeMobileTab === 'problem' ? 'flex' : 'hidden md:flex'}\`}>
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
                  <span className={\`inline-flex py-0.5 px-2.5 rounded-full text-[11px] font-medium \${problem.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' : problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}\`}>
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
        <section className={\`w-full md:w-[65%] lg:w-[45%] flex flex-col gap-2 \${activeMobileTab === 'code' ? 'flex' : 'hidden md:flex'}\`}>
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
                  className={\`text-[11px] font-medium py-1 px-2 rounded-md transition-colors \${showCustomInput ? 'bg-[#3E3E42] text-white' : 'text-slate-400 hover:text-slate-200'}\`}
                >
                  Testcases
                </button>
                <button
                  onClick={() => setShowCustomInput(false)}
                  className={\`text-[11px] font-medium py-1 px-2 rounded-md transition-colors \${!showCustomInput ? 'bg-[#3E3E42] text-white' : 'text-slate-400 hover:text-slate-200'}\`}
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
                    placeholder="Enter custom input (e.g., [2,7,11,15]\n9)"
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
                          className={\`text-lg font-semibold \${
                            executionMode === 'submit'
                              ? executionOutput.success ? 'text-emerald-500' : 'text-red-500'
                              : executionOutput.status?.id === 3 ? 'text-emerald-500' : 'text-red-500'
                          }\`}
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
        <section className={\`w-full lg:w-[25%] flex flex-col gap-2 \${activeMobileTab === 'social' ? 'flex' : 'hidden lg:flex'}\`}>
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
                <div key={idx} className={\`space-y-1 \${msg?.isSystemMessage ? 'text-center' : ''}\`}>
                  {msg?.isSystemMessage ? (
                    <span className="inline-block py-0.5 px-2 bg-[#282828] rounded-md text-[10px] text-slate-500 border border-[#3E3E42]">
                      {msg?.text}
                    </span>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className={\`text-[10px] font-semibold \${msg?.senderUsername === user?.username ? 'text-blue-400' : 'text-slate-400'}\`}>
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
          className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'problem' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Problem</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('code')}
          className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'code' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          <Play className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Code</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('social')}
          className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 relative \${activeMobileTab === 'social' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Room</span>
        </button>
      </div>
    </div>
  );
};
export default RoomView;
`;

content = content.replace(returnRegex, newReturn);
fs.writeFileSync(filePath, content);
console.log('Successfully updated RoomView.jsx return block.');
