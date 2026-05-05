const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { supabase } = require("../services/supabase");
const { protect } = require("../middleware/auth");

// Allowed replay event types (C-6: prevent arbitrary injection)
const ALLOWED_EVENT_TYPES = new Set(["op", "execution", "language_change", "chat", "code_snapshot"]);

// Create session
router.post("/", protect, async (req, res) => {
  try {
    const { title, language = "javascript", description = "" } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });

    const sessionId = uuidv4();
    // M-2: Use crypto.randomBytes for unpredictable invite codes (64-bit entropy)
    const inviteCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars

    const { data, error } = await supabase.from("sessions").insert({
      id: sessionId,
      title,
      language,
      description,
      invite_code: inviteCode,
      host_id: req.user.id,
      host_username: req.user.username,
      code_content: getStarterCode(language),
      status: "active",
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Add host as participant
    await supabase.from("participants").insert({
      session_id: sessionId,
      user_id: req.user.id,
      username: req.user.username,
      role: "interviewer",
    });

    res.status(201).json({ session: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions for user
router.get("/", protect, async (req, res) => {
  try {
    const { data: hosted, error: err1 } = await supabase
      .from("sessions")
      .select("*, participants(count)")
      .eq("host_id", req.user.id);

    const { data: participated, error: err2 } = await supabase
      .from("participants")
      .select("sessions(*, participants(count))")
      .eq("user_id", req.user.id);

    if (err1 || err2) return res.status(500).json({ error: (err1 || err2).message });

    const allSessionsMap = new Map();
    hosted?.forEach((s) => allSessionsMap.set(s.id, s));
    participated?.forEach((p) => {
      if (p.sessions) allSessionsMap.set(p.sessions.id, p.sessions);
    });

    const sessions = Array.from(allSessionsMap.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single session
router.get("/:id", protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("*, participants(*)")
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Session not found" });
    res.json({ session: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join session by invite code
router.post("/join", protect, async (req, res) => {
  try {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: "Invite code required" });

    const { data: session, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("invite_code", invite_code.toUpperCase())
      .single();

    if (error || !session) return res.status(404).json({ error: "Invalid invite code" });
    if (session.status === "ended") return res.status(400).json({ error: "Session has ended" });

    // Add as participant if not already
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("user_id", req.user.id)
      .single();

    if (!existing) {
      await supabase.from("participants").insert({
        session_id: session.id,
        user_id: req.user.id,
        username: req.user.username,
        role: "candidate",
      });
    }

    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save session replay event
router.post("/:id/events", protect, async (req, res) => {
  try {
    const { type, data, timestamp } = req.body;

    // C-6: Validate event type against allowlist
    if (!type || !ALLOWED_EVENT_TYPES.has(type)) {
      return res.status(400).json({
        error: `Invalid event type. Must be one of: ${[...ALLOWED_EVENT_TYPES].join(", ")}`
      });
    }

    // C-6: Validate data is a plain object
    if (data !== undefined && (typeof data !== "object" || Array.isArray(data) || data === null)) {
      return res.status(400).json({ error: "Event data must be a JSON object" });
    }

    await supabase.from("session_events").insert({
      session_id: req.params.id,
      user_id: req.user.id,
      username: req.user.username,
      type,
      data: data || {},
      timestamp: timestamp || new Date().toISOString(),
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session replay
router.get("/:id/events", protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("session_events")
      .select("*")
      .eq("session_id", req.params.id)
      .order("timestamp", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ events: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End session
router.patch("/:id/end", protect, async (req, res) => {
  try {
    const { data: session } = await supabase
      .from("sessions")
      .select("host_id")
      .eq("id", req.params.id)
      .single();

    if (session?.host_id !== req.user.id)
      return res.status(403).json({ error: "Only host can end session" });

    await supabase
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save interviewer notes
router.post("/:id/notes", protect, async (req, res) => {
  try {
    const { notes } = req.body;
    await supabase.from("interviewer_notes").upsert({
      session_id: req.params.id,
      interviewer_id: req.user.id,
      notes,
      updated_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get interviewer notes
router.get("/:id/notes", protect, async (req, res) => {
  try {
    const { data } = await supabase
      .from("interviewer_notes")
      .select("notes, updated_at")
      .eq("session_id", req.params.id)
      .eq("interviewer_id", req.user.id)
      .single();
    res.json({ notes: data?.notes || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getStarterCode(language) {
  const starters = {
    javascript: `// Welcome to CodeSync\n// Start coding here\n\nfunction solution() {\n  \n}\n`,
    python: `# Welcome to CodeSync\n# Start coding here\n\ndef solution():\n    pass\n`,
    typescript: `// Welcome to CodeSync\n// Start coding here\n\nfunction solution(): void {\n  \n}\n`,
    java: `// Welcome to CodeSync\n\npublic class Solution {\n  public static void main(String[] args) {\n    \n  }\n}\n`,
    cpp: `// Welcome to CodeSync\n#include <iostream>\nusing namespace std;\n\nint main() {\n  \n  return 0;\n}\n`,
    go: `// Welcome to CodeSync\npackage main\n\nimport "fmt"\n\nfunc main() {\n  \n}\n`,
    rust: `// Welcome to CodeSync\n\nfn main() {\n  \n}\n`,
  };
  return starters[language] || starters.javascript;
}

module.exports = router;
