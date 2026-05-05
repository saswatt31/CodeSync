"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Code2, Users, Cpu, Play, ChevronRight, Zap, Shield, GitBranch } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const fullText = "collaborative code interviews";

  useEffect(() => {
    // P-2: Include router in deps to satisfy exhaustive-deps rule
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTyped(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Loader />;

  const features = [
    {
      icon: <Code2 size={20} />,
      title: "Operational Transformation",
      desc: "Real-time collaborative editing that resolves conflicts at the character level — no overwriting, no conflicts.",
      color: "#00ff88",
    },
    {
      icon: <Users size={20} />,
      title: "WebRTC Video + Audio",
      desc: "Peer-to-peer video and audio built-in. No third-party meeting links needed.",
      color: "#00d4ff",
    },
    {
      icon: <Play size={20} />,
      title: "Live Code Execution",
      desc: "Run code in 10+ languages and both participants see the output instantly.",
      color: "#bf5af2",
    },
    {
      icon: <Cpu size={20} />,
      title: "AI Code Review",
      desc: "Gemini analyzes solutions for complexity, edge cases, and hire signal — triggered mid-session.",
      color: "#ff9f0a",
    },
    {
      icon: <GitBranch size={20} />,
      title: "Session Replay",
      desc: "Every keystroke recorded as an event stream. Replay the entire interview after it ends.",
      color: "#ff375f",
    },
    {
      icon: <Shield size={20} />,
      title: "Private Interviewer Notes",
      desc: "A notes panel only the interviewer sees — invisible to the candidate in real-time.",
      color: "#30d158",
    },
  ];

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neon-green flex items-center justify-center">
            <Code2 size={16} className="text-black" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">CodeSync</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
            Sign in
          </Link>
          <Link href="/auth/register" className="btn-solid-neon text-sm font-display font-semibold px-5 py-2 rounded-lg">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neon-green/30 bg-neon-green/5 text-neon-green text-xs font-mono mb-8">
            <Zap size={12} />
            Built for technical interviews
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 tracking-tight">
            The platform for{" "}
            <span className="text-gradient-neon">
              {typed}
              <span className="animate-cursor-blink">|</span>
            </span>
          </h1>

          <p className="text-muted-foreground font-body text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Real-time collaborative code editor with OT sync, WebRTC video, live execution,
            AI-powered code review, and full session replay.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="btn-solid-neon font-display font-semibold px-8 py-3.5 rounded-xl text-base flex items-center gap-2"
            >
              Start interviewing <ChevronRight size={16} />
            </Link>
            <Link href="/auth/login" className="btn-neon font-display font-semibold px-8 py-3.5 rounded-xl text-base">
              Sign in
            </Link>
          </div>
        </motion.div>

        {/* Code preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 w-full max-w-4xl"
        >
          <div className="panel-neon rounded-2xl overflow-hidden">
            {/* Fake editor header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-4 text-xs font-mono text-muted-foreground">solution.js — CodeSync Session</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="status-dot-green" />
                <span className="text-xs font-mono text-neon-green">2 connected</span>
              </div>
            </div>
            <div className="p-6 font-mono text-sm text-left leading-relaxed" style={{ minHeight: 180 }}>
              <div className="text-muted-foreground">{"// Two Sum — O(n) solution"}</div>
              <div className="mt-2">
                <span className="text-blue-400">function</span>
                <span className="text-neon-green"> twoSum</span>
                <span className="text-foreground">(nums, target) {"{"}</span>
              </div>
              <div className="ml-6">
                <span className="text-blue-400">const </span>
                <span className="text-foreground">map = </span>
                <span className="text-blue-400">new </span>
                <span className="text-neon-blue">Map</span>
                <span className="text-foreground">();</span>
              </div>
              <div className="ml-6 mt-1">
                <span className="text-blue-400">for </span>
                <span className="text-foreground">(</span>
                <span className="text-blue-400">let </span>
                <span className="text-foreground">i = 0; i {"<"} nums.length; i++) {"{"}</span>
              </div>
              <div className="ml-12 text-foreground">
                <span className="text-blue-400">if </span>
                <span>(map.has(target - nums[i]))</span>
              </div>
              <div className="ml-16 text-foreground">
                <span className="text-blue-400">return </span>
                <span>[map.get(target - nums[i]), i];</span>
              </div>
              <div className="ml-12 text-foreground">map.set(nums[i], i);</div>
              <div className="ml-6 text-foreground">{"}"}</div>
              <div className="text-foreground">{"}"}</div>
              {/* Fake cursor */}
              <div className="mt-2 flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-mono">interviewer@codesync</span>
                <span className="animate-cursor-blink text-neon-green font-bold">|</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="panel rounded-xl p-5 hover:border-neon-green/20 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${f.color}15`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-sm mb-2">{f.title}</h3>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground font-body">
        CodeSync — Built with Next.js, Socket.io, WebRTC, and Gemini AI
      </footer>
    </main>
  );
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-neon-green font-mono text-sm">
        <div className="w-5 h-5 border border-neon-green border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );
}
