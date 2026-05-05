"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "../../../../context/AuthContext";
import { getSession, getSessionEvents } from "../../../../lib/api";
import { Play, Pause, SkipBack, ChevronLeft, Loader2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function ReplayPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentCode, setCurrentCode] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/auth/login"); return; }
    if (!id || !user) return;

    Promise.all([getSession(id), getSessionEvents(id)])
      .then(([sRes, eRes]) => {
        setSession(sRes.data.session);
        // Filter to only code op events
        const codeEvents = eRes.data.events.filter(
          (e) => e.type === "op" || e.type === "code_snapshot"
        );
        setEvents(codeEvents);
        setCurrentCode(sRes.data.session.code_content || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, user, authLoading]);

  /**
   * C-7 FIX: applyOp now handles ot-text array format correctly.
   * ot-text ops are arrays of: number (retain), string (insert), {d: N} (delete).
   * The old implementation expected {type, position, text} — which never matched
   * what the server stores, so replay was completely broken.
   */
  const applyOp = (content, op) => {
    if (!op || !Array.isArray(op)) return content;
    let result = "";
    let offset = 0;
    for (const component of op) {
      if (typeof component === "number") {
        result += content.slice(offset, offset + component);
        offset += component;
      } else if (typeof component === "string") {
        result += component;
      } else if (typeof component === "object" && component !== null && typeof component.d === "number") {
        offset += component.d;
      }
    }
    result += content.slice(offset);
    return result;
  };

  // Replay forward one step
  const stepForward = () => {
    if (currentIdx >= events.length) return;
    const event = events[currentIdx];
    if (event?.data?.op) {
      setCurrentCode((prev) => applyOp(prev, event.data.op));
    }
    setCurrentIdx((i) => i + 1);
  };

  // Play / pause
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx((i) => {
          if (i >= events.length) { setPlaying(false); return i; }
          const event = events[i];
          if (event?.data?.op) {
            setCurrentCode((prev) => applyOp(prev, event.data.op));
          }
          return i + 1;
        });
      }, 200 / speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, events, speed]);

  const restart = () => {
    setPlaying(false);
    setCurrentIdx(0);
    setCurrentCode(session?.code_content || "");
  };

  const progress = events.length > 0 ? (currentIdx / events.length) * 100 : 0;

  if (loading || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="animate-spin text-neon-green" size={24} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="panel border-b border-border h-12 flex items-center px-4 gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft size={16} />
        </button>
        <span className="font-display font-semibold text-sm">
          Replay — {session?.title}
        </span>
        <span className="text-xs font-mono text-muted-foreground ml-2">
          {currentIdx}/{events.length} events
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          height="100%"
          language={session?.language || "javascript"}
          value={currentCode}
          theme="vs-dark"
          options={{
            readOnly: true,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16 },
          }}
        />
      </div>

      {/* Replay controls */}
      <div className="panel border-t border-border p-4">
        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full mb-4 cursor-pointer bg-muted"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const targetIdx = Math.floor(pct * events.length);
            // Replay from start to targetIdx
            setPlaying(false);
            setCurrentIdx(0);
            let code = session?.code_content || "";
            for (let i = 0; i < targetIdx && i < events.length; i++) {
              const ev = events[i];
              if (ev?.data?.op) code = applyOp(code, ev.data.op);
            }
            setCurrentCode(code);
            setCurrentIdx(targetIdx);
          }}
        >
          <div
            className="h-full rounded-full bg-neon-green transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={restart} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="w-10 h-10 rounded-full btn-solid-neon flex items-center justify-center"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Speed</span>
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-2 py-1 rounded text-xs font-mono transition-all"
                style={{
                  background: speed === s ? "rgba(0,255,136,0.15)" : "#111",
                  color: speed === s ? "#00ff88" : "#555",
                  border: `1px solid ${speed === s ? "#00ff88" : "#1e1e1e"}`,
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
