"use client";
import { useState, useRef, useEffect } from "react";
import { Terminal, Cpu, FileText, MessageSquare, Loader2, AlertTriangle, AlertCircle, Lightbulb, Send, Code2 } from "lucide-react";

export function Sidebar({
  output, running,
  review, reviewing,
  notes, handleNotesChange, notesSaving, isHost,
  chat, sendChat, userId
}) {
  const [activePanel, setActivePanel] = useState("output");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, activePanel]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput);
    setChatInput("");
  };

  return (
    <div className="w-80 flex flex-col border-l border-border flex-shrink-0">
      {/* Panel tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {[
          { key: "output", icon: <Terminal size={12} />, label: "Output" },
          { key: "ai", icon: <Cpu size={12} />, label: "AI" },
          ...(isHost ? [{ key: "notes", icon: <FileText size={12} />, label: "Notes" }] : []),
          { key: "chat", icon: <MessageSquare size={12} />, label: "Chat", badge: chat.filter(m => !m.system).length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActivePanel(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors relative"
            style={{
              color: activePanel === tab.key ? "#00ff88" : "#555",
              borderBottom: activePanel === tab.key ? "2px solid #00ff88" : "2px solid transparent",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activePanel === "output" && (
          <OutputPanel output={output} running={running} />
        )}
        {activePanel === "ai" && (
          <AIPanel review={review} reviewing={reviewing} />
        )}
        {activePanel === "notes" && isHost && (
          <NotesPanel notes={notes} onChange={handleNotesChange} saving={notesSaving} />
        )}
        {activePanel === "chat" && (
          <ChatPanel
            chat={chat}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={handleSendChat}
            userId={userId}
            chatEndRef={chatEndRef}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-panels ──────────────────────────────────────────────────────────────

function OutputPanel({ output, running }) {
  if (running) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-neon-green text-xs font-mono">
        <Loader2 size={14} className="animate-spin" />
        Executing...
      </div>
    );
  }
  if (!output) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs font-mono">
        Hit Run to execute code
      </div>
    );
  }

  const statusColor = output.status === "Accepted" ? "#00ff88"
    : output.status === "Mock" ? "#f59e0b"
    : "#ff4444";

  return (
    <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground">
          Run by <span className="text-foreground">{output.runBy}</span>
        </span>
        <span style={{ color: statusColor }}>{output.status}</span>
      </div>
      {output.stdout && (
        <div className="mb-3">
          <div className="text-muted-foreground mb-1">stdout</div>
          <pre className="bg-muted rounded-lg p-3 text-neon-green whitespace-pre-wrap break-all text-xs leading-relaxed">
            {output.stdout}
          </pre>
        </div>
      )}
      {output.stderr && (
        <div className="mb-3">
          <div className="text-red-400 mb-1">stderr</div>
          <pre className="bg-muted rounded-lg p-3 text-red-400 whitespace-pre-wrap break-all text-xs leading-relaxed">
            {output.stderr}
          </pre>
        </div>
      )}
      {output.compile_output && (
        <div className="mb-3">
          <div className="text-yellow-400 mb-1">compile</div>
          <pre className="bg-muted rounded-lg p-3 text-yellow-400 whitespace-pre-wrap break-all text-xs">
            {output.compile_output}
          </pre>
        </div>
      )}
      <div className="flex items-center gap-4 text-muted-foreground mt-2">
        {output.time && <span>⏱ {output.time}s</span>}
        {output.memory && <span>💾 {(output.memory / 1024).toFixed(1)}MB</span>}
      </div>
    </div>
  );
}

function AIPanel({ review, reviewing }) {
  if (reviewing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs font-mono p-4">
        <Loader2 size={20} className="animate-spin text-neon-purple" style={{ color: "#bf5af2" }} />
        <span style={{ color: "#bf5af2" }}>Gemini analyzing...</span>
      </div>
    );
  }
  if (!review) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <Cpu size={28} className="text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground font-mono">Click AI Review to analyze the code</p>
      </div>
    );
  }

  const hireColors = {
    strong_yes: "#00ff88", yes: "#34d399", maybe: "#f59e0b", no: "#ff4444",
  };
  const severityIcon = {
    critical: <AlertTriangle size={11} className="text-red-400" />,
    warning: <AlertCircle size={11} className="text-yellow-400" />,
    suggestion: <Lightbulb size={11} className="text-blue-400" />,
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs font-mono">
      {/* Score + hire signal */}
      <div className="panel-neon rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">Overall score</span>
          <span className="text-neon-green font-bold text-base">{review.overall_score}/10</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Hire signal</span>
          <span
            className="px-2 py-0.5 rounded font-bold capitalize"
            style={{ color: hireColors[review.hire_signal], background: `${hireColors[review.hire_signal]}15` }}
          >
            {review.hire_signal?.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div>
        <p className="text-muted-foreground leading-relaxed">{review.summary}</p>
      </div>

      {/* Complexity */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted rounded-lg p-2.5">
          <div className="text-muted-foreground mb-1">Time</div>
          <div className="text-neon-green font-bold">{review.time_complexity?.value}</div>
        </div>
        <div className="bg-muted rounded-lg p-2.5">
          <div className="text-muted-foreground mb-1">Space</div>
          <div className="text-neon-blue font-bold" style={{ color: "#00d4ff" }}>{review.space_complexity?.value}</div>
        </div>
      </div>

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1.5">Strengths</div>
          {review.strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 mb-1">
              <span className="text-neon-green mt-0.5">✓</span>
              <span className="text-foreground/80">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Issues */}
      {review.issues?.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1.5">Issues</div>
          {review.issues.map((issue, i) => (
            <div key={i} className="bg-muted rounded-lg p-2.5 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                {severityIcon[issue.severity]}
                <span className="font-semibold capitalize">{issue.title}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{issue.description}</p>
              {issue.line_hint && (
                <code className="mt-1 block text-yellow-400">{issue.line_hint}</code>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edge cases */}
      {review.edge_cases_missed?.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1.5">Edge cases missed</div>
          {review.edge_cases_missed.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5 mb-1">
              <span className="text-yellow-400 mt-0.5">⚠</span>
              <span className="text-foreground/80">{e}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesPanel({ notes, onChange, saving }) {
  return (
    <div className="flex-1 flex flex-col p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground">Private notes</span>
        {saving && <span className="text-xs font-mono text-muted-foreground">Saving...</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notes here are only visible to you..."
        className="flex-1 bg-muted rounded-xl p-3 text-xs font-mono text-foreground placeholder-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-neon-green/30 border border-border leading-relaxed"
      />
    </div>
  );
}

function ChatPanel({ chat, chatInput, setChatInput, onSend, userId, chatEndRef }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chat.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground font-mono pt-4">
            No messages yet
          </div>
        ) : (
          chat.map((msg, i) => (
            msg.system ? (
              <div key={i} className="text-center text-xs text-muted-foreground font-mono py-1">
                {msg.message}
              </div>
            ) : (
              <div key={i} className={`flex flex-col ${msg.userId === userId ? "items-end" : "items-start"}`}>
                <span className="text-xs text-muted-foreground font-mono mb-0.5">{msg.username}</span>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-xs font-body"
                  style={{
                    background: msg.userId === userId ? "rgba(0,255,136,0.1)" : "#1a1a1a",
                    border: `1px solid ${msg.userId === userId ? "rgba(0,255,136,0.2)" : "#2a2a2a"}`,
                    color: msg.userId === userId ? "#00ff88" : "#e8e8e8",
                  }}
                >
                  {msg.message}
                </div>
              </div>
            )
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Message..."
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-neon-green transition-colors"
        />
        <button
          onClick={onSend}
          className="btn-solid-neon p-2 rounded-lg"
          disabled={!chatInput.trim()}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
