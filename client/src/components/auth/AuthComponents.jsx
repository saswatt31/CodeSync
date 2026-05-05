"use client";
import { useState } from "react";
import Link from "next/link";
import { Code2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

// ── Shared auth layout ──────────────────────────────────────────────────────
// M-3: Extracted from register/page.jsx to break peer-file coupling.
// Both login and register import from here instead of from each other.

export function AuthLayout({ title, subtitle, children, link }) {
  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 panel border-r border-border p-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neon-green flex items-center justify-center">
            <Code2 size={16} className="text-black" />
          </div>
          <span className="font-display font-bold text-lg">CodeSync</span>
        </div>
        <div>
          <div className="font-mono text-xs text-neon-green mb-6 opacity-60">
            {"// Real-time collaborative interviews"}
          </div>
          {["OT-based sync", "WebRTC video", "AI code review", "Session replay"].map((f) => (
            <div key={f} className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green" />
              <span className="text-sm font-body text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-mono">v1.0.0 — CodeSync</p>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-1">{title}</h1>
            <p className="text-muted-foreground font-body text-sm">{subtitle}</p>
          </div>
          {children}
          <p className="mt-6 text-center text-sm font-body text-muted-foreground">
            {link.label}{" "}
            <Link href={link.href} className="text-neon-green hover:text-neon-green/80 transition-colors">
              {link.cta}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export function Field({ label, type, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-body font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-neon-green focus:ring-1 focus:ring-neon-green/30 focus:outline-none text-foreground placeholder-muted-foreground font-mono text-sm transition-colors"
      />
    </div>
  );
}

export function PasswordField({ label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-body font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full px-4 py-3 pr-10 rounded-xl bg-muted border border-border focus:border-neon-green focus:ring-1 focus:ring-neon-green/30 focus:outline-none text-foreground placeholder-muted-foreground font-mono text-sm transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-body">
      {message}
    </div>
  );
}

export function SubmitBtn({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 mt-2 rounded-xl btn-solid-neon font-display font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border border-black/30 border-t-black rounded-full animate-spin" />
          Loading...
        </span>
      ) : label}
    </button>
  );
}
