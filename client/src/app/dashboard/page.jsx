"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { getSessions, createSession, joinSession } from "../../lib/api";
import { motion } from "framer-motion";
import {
  Code2, Plus, LogOut, Clock, Users, Play,
  ChevronRight, Hash, Loader2, Terminal, Copy, Check,
} from "lucide-react";

const LANG_COLORS = {
  javascript: "#f7df1e", python: "#3776ab", typescript: "#3178c6",
  java: "#ed8b00", cpp: "#00599c", go: "#00add8", rust: "#ce422b",
};

const STATUS_STYLES = {
  active: { label: "Live", color: "#00ff88", dot: "status-dot-green" },
  ended: { label: "Ended", color: "#666", dot: "status-dot-red" },
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    // P-3: Include router in deps to satisfy exhaustive-deps and prevent stale closures
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getSessions()
        .then(({ data }) => setSessions(data.sessions || []))
        .catch(console.error)
        .finally(() => setSessionsLoading(false));
    }
  }, [user]);

  const handleCreated = (session) => {
    setSessions((p) => [session, ...p]);
    setShowCreate(false);
    router.push(`/session/${session.id}`);
  };

  const handleJoined = (session) => {
    router.push(`/session/${session.id}`);
  };

  if (loading || !user) return <Loader />;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="panel border-b border-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neon-green flex items-center justify-center">
              <Code2 size={14} className="text-black" />
            </div>
            <span className="font-display font-bold">CodeSync</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center text-xs font-mono text-neon-green">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-mono text-muted-foreground">{user.username}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <h1 className="font-display text-3xl font-bold mb-1">Sessions</h1>
            <p className="text-muted-foreground font-body text-sm">
              {sessions.length} interview session{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoin(true)}
              className="btn-neon text-sm font-display font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
            >
              <Hash size={14} /> Join session
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-solid-neon text-sm font-display font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"
            >
              <Plus size={14} /> New session
            </button>
          </div>
        </motion.div>

        {/* Sessions grid */}
        {sessionsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="text-neon-green animate-spin" size={24} />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} userId={user.id} />
            ))}
          </div>
        )}
      </main>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />}
    </div>
  );
}

function SessionCard({ session, index, userId }) {
  const router = useRouter();
  const isHost = session.host_id === userId;
  const status = STATUS_STYLES[session.status] || STATUS_STYLES.ended;
  const langColor = LANG_COLORS[session.language] || "#fff";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => router.push(`/session/${session.id}`)}
      className="panel rounded-xl p-5 cursor-pointer hover:border-neon-green/20 transition-all hover:scale-[1.02] group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={status.dot} />
          <span className="text-xs font-mono" style={{ color: status.color }}>{status.label}</span>
        </div>
        <div
          className="text-xs font-mono px-2 py-1 rounded-md"
          style={{ background: `${langColor}15`, color: langColor }}
        >
          {session.language}
        </div>
      </div>

      <h3 className="font-display font-semibold mb-1 truncate group-hover:text-neon-green transition-colors">
        {session.title}
      </h3>
      {session.description && (
        <p className="text-xs text-muted-foreground font-body truncate mb-4">{session.description}</p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
            <Clock size={11} /> {new Date(session.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neon-green/10 text-neon-green">
              host
            </span>
          )}
          <ChevronRight size={14} className="text-muted-foreground group-hover:text-neon-green transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", language: "javascript" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  const languages = ["javascript", "python", "typescript", "java", "cpp", "go", "rust"];

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await createSession(form);
      setInviteCode(data.session.invite_code);
      onCreated(data.session);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create session");
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal onClose={onClose} title="New session" subtitle="Set up your interview environment">
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">Title *</label>
          <input
            type="text"
            placeholder="e.g. Frontend Engineer Round 2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-neon-green focus:ring-1 focus:ring-neon-green/30 focus:outline-none text-foreground placeholder-muted-foreground font-mono text-sm transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">Description</label>
          <input
            type="text"
            placeholder="Optional notes for this session"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-neon-green focus:ring-1 focus:ring-neon-green/30 focus:outline-none text-foreground placeholder-muted-foreground font-mono text-sm transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Language</label>
          <div className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <button
                key={l}
                onClick={() => setForm({ ...form, language: l })}
                className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={{
                  background: form.language === l ? `${LANG_COLORS[l]}20` : "#111",
                  color: form.language === l ? LANG_COLORS[l] : "#666",
                  border: `1px solid ${form.language === l ? LANG_COLORS[l] + "60" : "#1e1e1e"}`,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading || !form.title.trim()}
          className="w-full py-3 mt-2 btn-solid-neon rounded-xl font-display font-semibold text-sm disabled:opacity-40"
        >
          {loading ? "Creating..." : "Create session"}
        </button>
      </div>
    </Modal>
  );
}

function JoinModal({ onClose, onJoined }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await joinSession(code.trim());
      onJoined(data.session);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid invite code");
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Join session" subtitle="Enter the invite code from your interviewer">
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      <input
        type="text"
        placeholder="e.g. AB12CD"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-neon-green focus:outline-none text-foreground font-mono text-lg text-center tracking-[0.3em] mb-4 transition-colors"
        maxLength={6}
      />
      <button
        onClick={handleJoin}
        disabled={loading || !code.trim()}
        className="w-full py-3 btn-solid-neon rounded-xl font-display font-semibold text-sm disabled:opacity-40"
      >
        {loading ? "Joining..." : "Join session"}
      </button>
    </Modal>
  );
}

function Modal({ children, onClose, title, subtitle }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md panel-neon rounded-2xl p-6"
      >
        <h2 className="font-display text-xl font-bold mb-0.5">{title}</h2>
        <p className="text-sm text-muted-foreground font-body mb-6">{subtitle}</p>
        {children}
      </motion.div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="text-center py-24">
      <Terminal size={40} className="mx-auto mb-4 text-muted-foreground/30" />
      <h3 className="font-display text-xl font-semibold mb-2">No sessions yet</h3>
      <p className="text-sm text-muted-foreground mb-6 font-body">Create your first session and share the invite code</p>
      <button onClick={onCreate} className="btn-solid-neon font-display font-semibold px-6 py-3 rounded-xl text-sm">
        Create session
      </button>
    </div>
  );
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="text-neon-green animate-spin" size={28} />
    </div>
  );
}
