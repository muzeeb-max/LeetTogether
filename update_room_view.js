const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'MUZEEB', '.gemini', 'antigravity', 'scratch', 'leettogether', 'frontend', 'src', 'pages', 'RoomView.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
if (!content.includes('react-resizable-panels')) {
  content = content.replace(
    "import * as awarenessProtocol from 'y-protocols/awareness';",
    "import * as awarenessProtocol from 'y-protocols/awareness';\nimport { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';"
  );
}

// 2. Add ResizeHandle component above RoomView
if (!content.includes('const ResizeHandle')) {
  content = content.replace(
    "const RoomView = () => {",
    `const ResizeHandle = ({ className = "", direction = "horizontal" }) => (
  <PanelResizeHandle className={\`relative flex flex-shrink-0 items-center justify-center bg-[#3E3E42]/50 hover:bg-[#FFA116] transition-colors group z-10 \${direction === 'horizontal' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'} \${className}\`}>
    <div className={\`rounded-full bg-[#A0A0A0] group-hover:bg-[#1A1A1A] transition-colors \${direction === 'horizontal' ? 'w-0.5 h-4' : 'h-0.5 w-4'}\`} />
  </PanelResizeHandle>
);

const RoomView = () => {`
  );
}

// 3. Add new states inside RoomView
if (!content.includes('const [leftTab')) {
  content = content.replace(
    "const [activeMobileTab, setActiveMobileTab] = useState('code');",
    `const [activeMobileTab, setActiveMobileTab] = useState('code'); // 'problem', 'code', 'chat', 'voice'
  
  // LeetCode panel states
  const [leftTab, setLeftTab] = useState('description'); // 'description', 'editorial', 'solutions'
  const [consoleTab, setConsoleTab] = useState('testcase'); // 'testcase', 'result', 'console'
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);`
  );
}

// 4. Add resetCode and replace the return block
const resetCodeStr = `
  // Reset Code
  const resetCode = () => {
    if (socket && isHost && problem?.starterCode) {
      if (confirm('Are you sure you want to reset the code to the default template? This cannot be undone.')) {
        const starter = problem.starterCode.find((c) => c.language === language);
        if (starter) {
          const ytext = ydocRef.current.getText('monaco');
          ytext.delete(0, ytext.length);
          ytext.insert(0, starter.code);
        }
      }
    } else if (!isHost) {
      alert('Only the host can reset the workspace code.');
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#FFFFFF] flex flex-col h-screen overflow-hidden font-sans">
      
      {/* 1. Header Workspace Info (LeetCode Style Header) */}
      <header className="bg-[#262626] border-b border-[#3E3E42] px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#FFA116] flex items-center justify-center font-bold text-white text-[10px]">LT</div>
            <div className="flex flex-col">
              <h1 className="text-xs font-bold text-[#FFFFFF] flex items-center gap-2">
                {room?.roomName || 'Workspace'} 
                <span className="text-[9px] font-mono py-0.5 px-1.5 bg-[#1A1A1A] rounded text-[#A0A0A0] border border-[#3E3E42]">
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
                className="flex items-center gap-1.5 py-1 px-2.5 bg-[#3E3E42]/50 hover:bg-[#3E3E42] rounded-md text-[11px] font-medium text-[#FFFFFF] transition-colors"
              >
                Problem <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </button>
              
              {showProblemSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#262626] border border-[#3E3E42] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {problemsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => changeProblem(p.id)}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#3E3E42] text-[#A0A0A0] transition-colors"
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
                className="flex items-center gap-1.5 py-1 px-2.5 bg-[#3E3E42]/50 hover:bg-[#3E3E42] rounded-md text-[11px] font-medium text-[#FFFFFF] transition-colors"
              >
                Invite <UserPlus className="w-3.5 h-3.5" />
              </button>
              
              {showInviteSelector && (
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[#262626] border border-[#3E3E42] shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                  {friendsList.length === 0 ? (
                    <p className="text-[10px] text-[#A0A0A0] text-center py-3">No online friends available.</p>
                  ) : (
                    friendsList.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => inviteFriend(f.id)}
                        className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#3E3E42] text-[#A0A0A0] transition-colors flex items-center gap-2"
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
          <div className="hidden md:flex items-center gap-1.5 py-1 px-2.5 bg-[#1A1A1A] border border-[#3E3E42] rounded-md ml-2">
            <span className={\`w-1.5 h-1.5 rounded-full flex-shrink-0 \${
              permissionDenied || voiceStatus === 'FAILED' ? 'bg-amber-500' :
              voiceStatus === 'AUDIO RECEIVING' ? 'bg-blue-500 animate-pulse' :
              voiceStatus === 'CONNECTED' ? 'bg-[#00B8A3] animate-pulse' : 'bg-slate-500'
            }\`} />
            <span className="text-[9px] font-semibold text-[#A0A0A0]">
              {permissionDenied ? 'No mic' : voiceStatus}
            </span>
          </div>

          {/* Leave room */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 py-1 px-2.5 hover:bg-[#3E3E42]/50 text-[#A0A0A0] rounded-md text-[11px] font-medium transition-colors ml-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>
      </header>

      {/* 2. Workspace Body (LeetCode Desktop PanelGroup Layout) */}
      <div className="flex-grow hidden md:flex overflow-hidden min-h-0 bg-[#1A1A1A]">
        <PanelGroup direction="horizontal" autoSaveId="leettogether-main-layout">
          
          {/* LEFT PANEL: Problem */}
          <Panel defaultSize={38} minSize={20} collapsible={true} onCollapse={() => setLeftPanelCollapsed(true)} onExpand={() => setLeftPanelCollapsed(false)} className="bg-[#262626] border-r border-[#3E3E42] flex flex-col">
            {leftPanelCollapsed ? (
              <div className="flex flex-col items-center py-4 h-full cursor-pointer hover:bg-[#3E3E42]/20" onClick={() => {
                // Programmatic uncollapse is tricky with PanelGroup unless we use imperative API, 
                // but user can drag the handle back. We can show a placeholder.
                alert('Drag the handle to expand the Problem panel.');
              }}>
                <MessageSquare className="w-4 h-4 text-[#A0A0A0]" />
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center bg-[#262626] border-b border-[#3E3E42] px-2 flex-shrink-0">
                  <button onClick={() => setLeftTab('description')} className={\`px-3 py-2 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${leftTab === 'description' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    <MessageSquare className="w-3 h-3" /> Description
                  </button>
                  <button onClick={() => setLeftTab('editorial')} className={\`px-3 py-2 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${leftTab === 'editorial' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    Editorial
                  </button>
                  <button onClick={() => setLeftTab('solutions')} className={\`px-3 py-2 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${leftTab === 'solutions' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    Solutions
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                  {leftTab === 'description' && (
                    problem ? (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold text-[#FFFFFF] mb-2">{problem.title}</h2>
                          <span className={\`inline-flex py-0.5 px-2.5 rounded-full text-[11px] font-medium \${problem.difficulty === 'easy' ? 'text-[#00B8A3] bg-[#00B8A3]/10' : problem.difficulty === 'medium' ? 'text-[#FFA116] bg-[#FFA116]/10' : 'text-red-500 bg-red-500/10'}\`}>
                            {problem.difficulty}
                          </span>
                        </div>

                        <div className="text-[13px] text-[#A0A0A0] leading-relaxed font-sans whitespace-pre-wrap">
                          {problem.description}
                        </div>

                        <div className="space-y-4 mt-6">
                          {problem?.examples?.map((ex, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <p className="text-xs font-semibold text-[#FFFFFF]">Example {idx + 1}:</p>
                              <div className="bg-[#1A1A1A] p-3 rounded-none border-l-2 border-[#3E3E42] text-[12px] font-mono text-[#A0A0A0] space-y-1.5">
                                <p><span className="text-[#FFFFFF] font-sans font-semibold">Input: </span>{ex?.input}</p>
                                <p><span className="text-[#FFFFFF] font-sans font-semibold">Output: </span>{ex?.output}</p>
                                {ex?.explanation && (
                                  <p className="leading-relaxed"><span className="text-[#FFFFFF] font-sans font-semibold">Explanation: </span>{ex.explanation}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {problem.constraints?.length > 0 && (
                          <div className="space-y-2 mt-6">
                            <p className="text-xs font-semibold text-[#FFFFFF]">Constraints:</p>
                            <ul className="list-disc list-outside ml-4 text-[12px] font-mono text-[#A0A0A0] space-y-1.5">
                              {problem.constraints.map((c, i) => (
                                <li key={i} className="pl-1">
                                  <code className="bg-[#1A1A1A] px-1.5 py-0.5 rounded text-[#A0A0A0] border border-[#3E3E42]">{c}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col justify-center items-center h-full text-[#A0A0A0] text-xs gap-3">
                        <div className="w-6 h-6 border-2 border-[#A0A0A0] border-t-transparent rounded-full animate-spin" />
                        Loading problem...
                      </div>
                    )
                  )}
                  {leftTab === 'editorial' && <div className="text-[#A0A0A0] text-sm">Editorial content placeholder</div>}
                  {leftTab === 'solutions' && <div className="text-[#A0A0A0] text-sm">Solutions content placeholder</div>}
                </div>
              </>
            )}
          </Panel>

          <ResizeHandle direction="horizontal" />

          {/* CENTER PANEL: Editor + Bottom Console */}
          <Panel defaultSize={42} minSize={30} className="bg-[#1A1A1A] flex flex-col border-r border-[#3E3E42]">
            <PanelGroup direction="vertical" autoSaveId="leettogether-editor-layout">
              
              {/* Top: Editor */}
              <Panel defaultSize={70} minSize={30} className="flex flex-col">
                {/* Editor Header */}
                <div className="px-3 py-1.5 bg-[#262626] border-b border-[#3E3E42] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <select
                      disabled={!isHost}
                      value={language}
                      onChange={(e) => changeLanguage(e.target.value)}
                      className="bg-[#3E3E42]/50 border-none text-[11px] py-1 px-2 rounded focus:outline-none focus:ring-1 focus:ring-[#FFA116] text-[#FFFFFF] font-sans font-medium cursor-pointer disabled:opacity-50 appearance-none"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                    </select>
                    {!isHost && (
                      <span className="text-[9px] text-[#A0A0A0]" title="Only host can change workspace language.">(Read-Only)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {typingUser && (
                      <span className="text-[10px] text-[#00B8A3] animate-pulse font-medium mr-2">
                        {typingUser} is typing...
                      </span>
                    )}
                    <button
                      onClick={resetCode}
                      className="flex items-center gap-1.5 py-1 px-2 hover:bg-[#3E3E42]/50 text-[#A0A0A0] rounded text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Reset Code
                    </button>
                    <button
                      onClick={runCode}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 py-1 px-3 bg-[#3E3E42] hover:bg-[#4E4E52] text-[#FFFFFF] rounded text-[11px] font-medium disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-[#00B8A3]" /> Run
                    </button>
                    <button
                      onClick={submitSolution}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 py-1 px-3 bg-[#00B8A3]/10 hover:bg-[#00B8A3]/20 text-[#00B8A3] rounded text-[11px] font-medium disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" /> Submit
                    </button>
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
              </Panel>

              <ResizeHandle direction="vertical" />

              {/* Bottom: Console */}
              <Panel defaultSize={30} minSize={10} className="bg-[#262626] flex flex-col">
                <div className="flex items-center bg-[#262626] border-b border-[#3E3E42] px-2 flex-shrink-0">
                  <button onClick={() => setConsoleTab('testcase')} className={\`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${consoleTab === 'testcase' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    Testcase
                  </button>
                  <button onClick={() => setConsoleTab('result')} className={\`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${consoleTab === 'result' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    Result
                  </button>
                  <button onClick={() => setConsoleTab('console')} className={\`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 \${consoleTab === 'console' ? 'border-[#FFA116] text-[#FFFFFF]' : 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF]'}\`}>
                    Console
                  </button>
                </div>
                <div className="flex-grow p-3 font-mono text-[12px] overflow-y-auto select-text bg-[#1A1A1A] custom-scrollbar">
                  {consoleTab === 'testcase' && (
                    <div className="h-full flex flex-col gap-2">
                      <span className="text-[11px] text-[#A0A0A0]">Custom Input:</span>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Enter custom input (e.g., [2,7,11,15]\\n9)"
                        className="flex-grow bg-[#262626] border border-[#3E3E42] p-2 rounded-sm text-[#FFFFFF] placeholder-[#A0A0A0] focus:outline-none focus:border-[#5E5E62] text-[12px] font-mono resize-none custom-scrollbar"
                      />
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
                            <span className={\`text-lg font-semibold \${
                                executionMode === 'submit'
                                  ? executionOutput.success ? 'text-[#00B8A3]' : 'text-red-500'
                                  : executionOutput.status?.id === 3 ? 'text-[#00B8A3]' : 'text-red-500'
                              }\`}>
                              {executionMode === 'submit'
                                ? executionOutput.success ? 'Accepted' : 'Wrong Answer'
                                : executionOutput.status?.id === 3 ? 'Accepted' : executionOutput.status?.description}
                            </span>
                            {executionOutput.time && (
                              <span className="text-[11px] text-[#A0A0A0]">Runtime: {executionOutput.time}s, Memory: {executionOutput.memory ? Math.round(executionOutput.memory / 1024) : 0} MB</span>
                            )}
                          </div>

                          {executionMode === 'submit' && executionOutput.failedTestCase && (
                            <div className="space-y-3">
                              <p className="text-[#FFFFFF] font-semibold text-[11px]">Failed Test Case {executionOutput.failedTestCase.testCaseNumber}</p>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Input</p>
                                  <div className="bg-[#262626] p-2 rounded-sm border border-[#3E3E42] text-[#FFFFFF] break-all">{executionOutput.failedTestCase.input}</div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Output</p>
                                  <div className="bg-red-500/10 p-2 rounded-sm border border-red-500/20 text-red-400 break-all">{executionOutput.failedTestCase.actualOutput}</div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#A0A0A0] mb-1">Expected</p>
                                  <div className="bg-[#00B8A3]/10 p-2 rounded-sm border border-[#00B8A3]/20 text-[#00B8A3] break-all">{executionOutput.failedTestCase.expectedOutput}</div>
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
                                <pre className="bg-[#262626] p-2 rounded-sm border border-[#3E3E42] text-[#FFFFFF] whitespace-pre-wrap">{executionOutput.stdout}</pre>
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
          <Panel defaultSize={20} minSize={15} className="bg-[#262626] flex flex-col">
            <div className="px-3 py-2 border-b border-[#3E3E42] bg-[#262626] flex-shrink-0 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#A0A0A0]" />
              <span className="text-[11px] font-semibold text-[#FFFFFF]">Room Activity</span>
            </div>
            
            <div className="bg-[#1A1A1A] p-2 flex-shrink-0 border-b border-[#3E3E42]">
              <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                {participants?.map((p) => (
                  <div key={p?.id} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={p?.avatar} alt={p?.username} className="w-5 h-5 rounded bg-[#262626] object-cover" />
                      <span className="text-[11px] font-medium text-[#FFFFFF] truncate">{p?.username}</span>
                      {p?.id === host?.id && (
                        <span className="text-[7px] font-bold py-0.5 px-1 bg-[#FFA116]/10 text-[#FFA116] rounded flex-shrink-0">HOST</span>
                      )}
                    </div>
                    {isHost && p?.id !== user?.id && (
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

            <div className="bg-[#1A1A1A] border-b border-[#3E3E42] flex-shrink-0 overflow-hidden">
              <VoicePanel
                isMuted={isMuted}
                toggleMute={toggleMute}
                voiceUsers={voiceUsers}
                isConnected={isConnected}
                permissionDenied={permissionDenied}
                currentUserId={user?.id?.toString()}
              />
            </div>

            <div className="flex-grow flex flex-col bg-[#1A1A1A] overflow-hidden min-h-0">
              <div className="flex-grow p-2 overflow-y-auto space-y-3 custom-scrollbar select-text">
                {chatMessages?.map((msg, idx) => (
                  <div key={idx} className={\`space-y-1 \${msg?.isSystemMessage ? 'text-center' : ''}\`}>
                    {msg?.isSystemMessage ? (
                      <span className="inline-block py-0.5 px-2 bg-[#262626] rounded text-[9px] text-[#A0A0A0] border border-[#3E3E42]">
                        {msg?.text}
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <span className={\`text-[9px] font-semibold \${msg?.senderUsername === user?.username ? 'text-[#00B8A3]' : 'text-[#A0A0A0]'}\`}>
                            {msg?.senderUsername}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#FFFFFF] mt-0.5 leading-snug break-words bg-[#262626] py-1.5 px-2.5 rounded-sm border border-[#3E3E42] inline-block self-start max-w-[90%]">
                          {msg?.text}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={sendChatMessage} className="p-2 bg-[#262626] border-t border-[#3E3E42] flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-grow bg-[#1A1A1A] border border-[#3E3E42] py-1 px-2 rounded-sm text-[11px] text-[#FFFFFF] focus:outline-none focus:border-[#5E5E62] placeholder-[#A0A0A0]"
                />
                <button
                  type="submit"
                  className="p-1 rounded-sm bg-[#3E3E42] hover:bg-[#4E4E52] text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </Panel>

        </PanelGroup>
      </div>

      {/* 3. Mobile Fallback View (Original activeMobileTab layout) */}
      <div className="md:hidden flex-grow flex flex-col overflow-hidden min-h-0 bg-[#1A1A1A] p-2 gap-2">
        {/* We keep the mobile fallback simple to preserve functionality */}
        {activeMobileTab === 'problem' && (
          <div className="flex-grow bg-[#262626] border border-[#3E3E42] p-4 overflow-y-auto">
             <h2 className="text-xl font-bold text-[#FFFFFF] mb-2">{problem?.title}</h2>
             <div className="text-[13px] text-[#A0A0A0]">{problem?.description}</div>
          </div>
        )}
        {activeMobileTab === 'code' && (
           <div className="flex-grow flex flex-col bg-[#1A1A1A] border border-[#3E3E42]">
              <div className="flex-grow relative">
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  onMount={handleEditorDidMount}
                />
              </div>
           </div>
        )}
        {activeMobileTab === 'chat' && (
           <div className="flex-grow bg-[#262626] border border-[#3E3E42] p-4 text-[#A0A0A0] text-sm flex items-center justify-center">
             Chat not optimized for mobile yet.
           </div>
        )}
        {activeMobileTab === 'voice' && (
           <div className="flex-grow bg-[#262626] border border-[#3E3E42] p-4">
             <VoicePanel isMuted={isMuted} toggleMute={toggleMute} voiceUsers={voiceUsers} isConnected={isConnected} permissionDenied={permissionDenied} currentUserId={user?.id?.toString()} />
           </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden bg-[#262626] border-t border-[#3E3E42] flex justify-around p-2 flex-shrink-0 z-10 pb-safe">
        <button onClick={() => setActiveMobileTab('problem')} className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'problem' ? 'text-[#FFA116]' : 'text-[#A0A0A0]'}\`}>
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Problem</span>
        </button>
        <button onClick={() => setActiveMobileTab('code')} className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'code' ? 'text-[#FFA116]' : 'text-[#A0A0A0]'}\`}>
          <Play className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Code</span>
        </button>
        <button onClick={() => setActiveMobileTab('chat')} className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'chat' ? 'text-[#FFA116]' : 'text-[#A0A0A0]'}\`}>
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Chat</span>
        </button>
        <button onClick={() => setActiveMobileTab('voice')} className={\`flex flex-col items-center gap-1 p-2 rounded-lg flex-1 \${activeMobileTab === 'voice' ? 'text-[#FFA116]' : 'text-[#A0A0A0]'}\`}>
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Voice</span>
        </button>
      </div>
    </div>
  );
};
export default RoomView;`;

// Replace from 'return (' to 'export default RoomView;'
const returnRegex = /return \([\s\S]*?\);\n};\nexport default RoomView;/;
content = content.replace(returnRegex, resetCodeStr);

fs.writeFileSync(filePath, content);
console.log('Successfully updated RoomView.jsx with resizable panels and strict LeetCode layout.');
