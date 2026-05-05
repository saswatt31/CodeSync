"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "../../../context/AuthContext";
import { getSocket, connectSocket } from "../../../lib/socket";
import {
  getSession, endSession, executeCode, reviewCode,
  saveNotes, getNotes,
} from "../../../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, Cpu, MessageSquare, FileText,
  Users, Copy, Check, Mic, MicOff, Video, VideoOff,
  ChevronLeft, Loader2, X, Code2, Send, AlertTriangle,
  Zap, TrendingUp, AlertCircle, Lightbulb, Trophy,
} from "lucide-react";

import { Sidebar } from "../../../components/session/Sidebar";
import { Editor } from "../../../components/session/Editor";
// C-4/M-1: Removed unused top-level MonacoEditor dynamic import.
// The Editor component already lazy-loads Monaco internally.

// M-1: LANG_IDS removed — server is the single source of truth for Judge0 language IDs
const LANGUAGES = ["javascript", "python", "typescript", "java", "cpp", "go", "rust"];

export default function SessionPage() {
  const { id } = useParams();
  const { user, loading: authLoading, token } = useAuth();
  const router = useRouter();

  // Session state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor state
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const docVersion = useRef(0);
  const isApplyingRemote = useRef(false);
  // P-2: codeRef mirrors the latest code synchronously (avoids stale closure in OT handler)
  const codeRef = useRef("");

  // Execution state
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);

  // AI review
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(null);

  // Notes (host only)
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const notesSaveTimer = useRef(null);

  // Chat
  const [chat, setChat] = useState([]);

  // Participants
  const [participants, setParticipants] = useState([]);

  // WebRTC
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  // UI
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const isHost = session && user && session.host_id === user.id;

  // ── Load session ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { router.push("/auth/login"); return; }
    if (!id || !user) return;

    getSession(id)
      .then(({ data }) => {
        setSession(data.session);
        const initialCode = data.session.code_content || "";
        setCode(initialCode);
        codeRef.current = initialCode; // P-2: keep ref in sync
        setLanguage(data.session.language || "javascript");
        setParticipants(data.session.participants || []);
      })
      .catch((err) => setError(err.response?.data?.error || "Session not found"))
      .finally(() => setLoading(false));

    // Load notes if host
    getNotes(id).then(({ data }) => setNotes(data.notes || "")).catch(() => {});
  }, [id, user, authLoading]);

  // ── Socket.io ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user || !session) return;
    const socket = connectSocket(token);
    socket.emit("join_session", { sessionId: id, role: isHost ? "interviewer" : "candidate" });
    setConnected(true);

    const onOp = ({ op, version, userId, username }) => {
      if (userId === user.id) return;
      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          isApplyingRemote.current = true;
          let offset = 0;
          const edits = [];
          
          for (const component of op) {
            if (typeof component === "number") {
              offset += component;
            } else if (typeof component === "object" && component.d) {
              const deleteLen = component.d;
              const startPos = model.getPositionAt(offset);
              const endPos = model.getPositionAt(offset + deleteLen);
              edits.push({
                range: new monacoRef.current.Range(
                  startPos.lineNumber, startPos.column,
                  endPos.lineNumber, endPos.column
                ),
                text: "",
              });
            } else if (typeof component === "string") {
              const pos = model.getPositionAt(offset);
              edits.push({
                range: new monacoRef.current.Range(
                  pos.lineNumber, pos.column,
                  pos.lineNumber, pos.column
                ),
                text: component,
              });
              offset += component.length;
            }
          }
          
          if (edits.length > 0) {
            model.pushEditOperations([], edits, () => null);
          }
          docVersion.current = version;
          isApplyingRemote.current = false;
        }
      }
    };

    const onDocState = ({ content, version }) => {
      setCode(content);
      codeRef.current = content;
      docVersion.current = version;
      if (editorRef.current) {
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== content) {
          model.setValue(content);
        }
      }
    };

    const onSyncRequired = () => {
      socket.emit("sync_code", { sessionId: id });
    };

    const onLanguageChange = ({ language: lang }) => {
      setLanguage(lang);
      setSession((prev) => prev ? { ...prev, language: lang } : prev);
    };

    const onUserJoined = ({ userId: uid, username, role }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.user_id === uid)) return prev;
        return [...prev, { user_id: uid, username, role }];
      });
      addChat({ system: true, message: `${username} joined the session`, timestamp: new Date().toISOString() });
    };

    const onUserLeft = ({ userId: uid, username }) => {
      setParticipants((prev) => prev.filter((p) => p.user_id !== uid));
      addChat({ system: true, message: `${username} left the session`, timestamp: new Date().toISOString() });
    };

    const onExecutionResult = ({ result, username, timestamp }) => {
      setOutput({ ...result, runBy: username, timestamp });
    };

    const onChatMessage = (msg) => {
      addChat(msg);
    };

    const onSessionEnded = ({ endedBy }) => {
      addChat({ system: true, message: `Session ended by ${endedBy}`, timestamp: new Date().toISOString() });
    };

    const onWebrtcOffer = async ({ offer, fromId }) => {
      await handleWebRTCOffer(offer, fromId);
    };

    const onWebrtcAnswer = ({ answer }) => {
      peerRef.current?.signal(answer);
    };

    const onWebrtcIce = ({ candidate }) => {
      peerRef.current?.signal(candidate);
    };

    // Attach listeners
    socket.on("op", onOp);
    socket.on("doc_state", onDocState);
    socket.on("sync_required", onSyncRequired);
    socket.on("language_change", onLanguageChange);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("execution_result", onExecutionResult);
    socket.on("chat_message", onChatMessage);
    socket.on("session_ended", onSessionEnded);
    socket.on("webrtc_offer", onWebrtcOffer);
    socket.on("webrtc_answer", onWebrtcAnswer);
    socket.on("webrtc_ice", onWebrtcIce);

    return () => {
      socket.off("op", onOp);
      socket.off("doc_state", onDocState);
      socket.off("sync_required", onSyncRequired);
      socket.off("language_change", onLanguageChange);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("execution_result", onExecutionResult);
      socket.off("chat_message", onChatMessage);
      socket.off("session_ended", onSessionEnded);
      socket.off("webrtc_offer", onWebrtcOffer);
      socket.off("webrtc_answer", onWebrtcAnswer);
      socket.off("webrtc_ice", onWebrtcIce);
    };
  }, [id, user, session]);

  // M-3/P-6: addChat wrapped in useCallback so socket effect closures always
  // capture the stable reference — prevents stale closure bugs on re-render.
  const addChat = useCallback((msg) => {
    setChat((prev) => [...prev, msg]);
  }, []);

  // ── OT: send operation when editor changes ────────────────────────────────
  const handleEditorChange = useCallback((value, event) => {
    if (isApplyingRemote.current) return;
    if (!event?.changes?.length) return;

    const socket = getSocket();

    // Convert Monaco change to our op format
    for (const change of event.changes) {
      // P-2: Use codeRef.current (synchronous) not the stale `code` state
      const op = monacoChangeToOp(change, codeRef.current.length);
      if (op) {
        socket.emit("op", {
          sessionId: id,
          op,
          clientVersion: docVersion.current,
        });
      }
    }
    codeRef.current = value; // P-2: update ref synchronously before next render
    setCode(value);
  }, [id]);

  // ── Language change ───────────────────────────────────────────────────────
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    const socket = getSocket();
    socket.emit("language_change", { sessionId: id, language: lang });
  };

  // ── Execute code ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    try {
      const { data } = await executeCode({ code, language, sessionId: id });
      const result = data;
      setOutput({ ...result, runBy: user.username, timestamp: new Date().toISOString() });
      // C-6: DO NOT re-emit execution_result here.
      // The REST /execute/run route already broadcasts it to the room via Socket.IO.
      // Emitting again from the client would deliver two events to every participant.
    } catch (err) {
      setOutput({ stderr: err.message, status: "Error" });
    } finally {
      setRunning(false);
    }
  };

  // ── AI Code Review ────────────────────────────────────────────────────────
  const handleReview = async () => {
    setReviewing(true);
    try {
      const { data } = await reviewCode({
        code,
        language,
        sessionId: id,
        problem_description: session?.description || "",
      });
      setReview(data.review);
    } catch (err) {
      console.error(err);
    } finally {
      setReviewing(false);
    }
  };

  // ── Auto-save notes ───────────────────────────────────────────────────────
  const handleNotesChange = (val) => {
    setNotes(val);
    clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      await saveNotes(id, val).catch(() => {});
      setNotesSaving(false);
    }, 1500);
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = (message) => {
    const socket = getSocket();
    // M-7: Do NOT add the message locally here. The server broadcasts
    // chat_message to ALL room members including the sender (io.to(room).emit).
    // onChatMessage will fire for the sender too, making this the single source
    // of truth and preventing duplicate messages for the message author.
    socket.emit("chat_message", { sessionId: id, message });
  };

  // ── WebRTC ────────────────────────────────────────────────────────────────
  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMicOn(true);
      setVideoOn(true);

      // Signal other peers in room
      const socket = getSocket();
      socket.emit("webrtc_offer", {
        sessionId: id,
        offer: { type: "media_ready", userId: user.id },
      });
    } catch (err) {
      console.error("Media error:", err);
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !micOn));
      setMicOn(!micOn);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !videoOn));
      setVideoOn(!videoOn);
    }
  };

  const handleWebRTCOffer = async (offer, fromId) => {
    // Simplified — in production use simple-peer for full WebRTC
    console.log("WebRTC offer received from", fromId);
  };

  // ── Invite code copy ──────────────────────────────────────────────────────
  const copyInvite = () => {
    navigator.clipboard.writeText(session?.invite_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── End session ───────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    await endSession(id).catch(() => {});
    const socket = getSocket();
    socket.emit("end_session", { sessionId: id });
    router.push("/dashboard");
  };

  if (loading || authLoading) return <FullLoader />;
  if (error) return <ErrorPage message={error} />;
  if (!session) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* ── Top Bar ── */}
      <div className="panel border-b border-border h-12 flex items-center px-4 gap-4 flex-shrink-0">
        {/* Left */}
        <button
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className={connected ? "status-dot-green" : "status-dot-red"} />
          <span className="font-display font-semibold text-sm">{session.title}</span>
        </div>

        {/* Language selector */}
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="ml-4 bg-muted border border-border rounded-lg px-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-neon-green cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {/* Center — participants */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {participants.slice(0, 4).map((p) => (
            <div key={p.user_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green" />
              <span className="text-muted-foreground">{p.username}</span>
              <span className="text-muted-foreground/50">{p.role}</span>
            </div>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Invite code */}
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {session.invite_code}
          </button>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-solid-neon text-xs font-mono disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>

          {/* AI review */}
          <button
            onClick={handleReview}
            disabled={reviewing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
            style={{ background: "rgba(191,90,242,0.1)", border: "1px solid rgba(191,90,242,0.3)", color: "#bf5af2" }}
          >
            {reviewing ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
            AI Review
          </button>

          {/* Video controls */}
          <button
            onClick={localStreamRef.current ? toggleMic : startMedia}
            className={`p-1.5 rounded-lg transition-colors ${micOn ? "text-neon-green" : "text-muted-foreground"}`}
            title="Toggle mic"
          >
            {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
          <button
            onClick={localStreamRef.current ? toggleVideo : startMedia}
            className={`p-1.5 rounded-lg transition-colors ${videoOn ? "text-neon-blue" : "text-muted-foreground"}`}
            title="Toggle video"
          >
            {videoOn ? <Video size={14} /> : <VideoOff size={14} />}
          </button>

          {/* End session (host only) */}
          {isHost && (
            <button
              onClick={handleEndSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square size={12} /> End
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <Editor
          language={language}
          code={code}
          onCodeChange={handleEditorChange}
          sessionId={id}
          editorRef={editorRef}
          monacoRef={monacoRef}
        />

        {/* Right panel */}
        <div className="w-80 flex flex-col border-l border-border flex-shrink-0">
          <Sidebar
            output={output} running={running}
            review={review} reviewing={reviewing}
            notes={notes} handleNotesChange={handleNotesChange} notesSaving={notesSaving}
            isHost={isHost} chat={chat} sendChat={sendChat} userId={user.id}
          />

          {/* Video section */}
          <div className="border-t border-border p-3 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!videoOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <VideoOff size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute bottom-1 left-1 text-xs font-mono text-white/60 bg-black/40 px-1 rounded">
                  You
                </div>
              </div>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Users size={16} className="text-muted-foreground" />
                </div>
                <div className="absolute bottom-1 left-1 text-xs font-mono text-white/60 bg-black/40 px-1 rounded">
                  Remote
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── OT helpers ──────────────────────────────────────────────────────────────

/**
 * Converts a Monaco IModelContentChange into an ot-text operation array.
 * ot-text format: [retain (number), insert (string), {d: delete_count} (object)]
 *
 * M-4 bug fix: original order was [retain, delete, insert] which is WRONG.
 * ot-text requires insert before delete: [retain, insert, delete].
 * This matters because the retain offset is based on the ORIGINAL document;
 * inserting first then deleting keeps positions consistent.
 *
 * @param {object} change - Monaco IModelContentChange
 * @param {number} docLength - Length of the document BEFORE this change
 */
function monacoChangeToOp(change, docLength) {
  if (!change) return null;
  const { rangeOffset, rangeLength, text } = change;
  const op = [];

  // 1. Retain chars before the change position
  if (rangeOffset > 0) op.push(rangeOffset);

  // 2. Insert new text first (correct order for ot-text)
  if (text.length > 0) op.push(text);

  // 3. Delete the replaced range
  if (rangeLength > 0) op.push({ d: rangeLength });

  // 4. Retain the rest of the document
  const trailingRetain = docLength - rangeOffset - rangeLength;
  if (trailingRetain > 0) op.push(trailingRetain);

  return op.length > 0 ? op : null;
}

// ── Misc ────────────────────────────────────────────────────────────────────

function FullLoader() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex items-center gap-2 text-neon-green font-mono text-sm">
        <Loader2 size={18} className="animate-spin" />
        Loading session...
      </div>
    </div>
  );
}

function ErrorPage({ message }) {
  const router = useRouter();
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
      <AlertTriangle size={32} className="text-destructive" />
      <p className="font-mono text-sm text-muted-foreground">{message}</p>
      <button
        onClick={() => router.push("/dashboard")}
        className="btn-neon text-sm font-mono px-4 py-2 rounded-lg"
      >
        ← Back to dashboard
      </button>
    </div>
  );
}
