const router = require("express").Router();
const axios = require("axios");
const { protect } = require("../middleware/auth");
const { executeLimiter } = require("../middleware/rateLimiter");

// Judge0 Language IDs (CE Edition)
const JUDGE0_LANGUAGES = {
  javascript: 93, // Node.js 18.15.0 (or 63 for Node 12)
  python:     71, // Python 3.8.1
  typescript: 74, // TypeScript 3.7.4
  java:       62, // Java (OpenJDK 13.0.1)
  cpp:        54, // C++ (GCC 9.2.0)
  go:         60, // Go (1.13.5)
  rust:       73, // Rust (1.40.0)
  c:          50, // C (GCC 9.2.0)
};

router.post("/run", protect, executeLimiter, async (req, res) => {
  try {
    const { code, language, stdin = "" } = req.body;
    if (!code || !language)
      return res.status(400).json({ error: "code and language required" });

    // M-4: languageId resolves from the map; warn explicitly for unknown languages
    // rather than silently falling back to Node 12 (ID 63).
    const languageId = JUDGE0_LANGUAGES[language];
    if (!languageId) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const options = {
      method: 'POST',
      url: `${process.env.JUDGE0_API_URL}/submissions`,
      params: { base64_encoded: 'false', wait: 'true', fields: '*' },
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        'X-RapidAPI-Host': new URL(process.env.JUDGE0_API_URL).hostname
      },
      data: {
        language_id: languageId,
        source_code: code,
        stdin: stdin
      }
    };

    const response = await axios.request(options);
    const data = response.data;

    const result = {
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      compile_output: data.compile_output || "",
      status: data.status?.description || "Unknown",
      time: data.time,
      memory: data.memory,
      exit_code: data.exit_code,
    };

    // Broadcast to room via socket
    try {
      const io = req.app.get("io");
      const { sessionId } = req.body;
      if (sessionId && io) {
        io.to(sessionId).emit("execution_result", {
          result,
          username: req.user?.username || "Someone",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (socketErr) {
      console.error("Socket broadcast failed:", socketErr);
    }

    res.json(result);
  } catch (err) {
    console.error("Execution Error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.message || err.message || "Execution failed" 
    });
  }
});

module.exports = router;