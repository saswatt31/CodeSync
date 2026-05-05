require("dotenv").config(); // Don't use override: true so Vitest-provided env vars take precedence
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/sessions");
const executeRoutes = require("./routes/execute");
const aiRoutes = require("./routes/ai");
const { authenticateSocket } = require("./middleware/auth");
const { setupSocket } = require("./socket/index");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
  transports: ["websocket", "polling"],
});
io.use(authenticateSocket);
setupSocket(io);
app.set("io", io);

// Middleware (ORDER MATTERS: CORS and JSON first)
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// Global rate limiter — applies to ALL /api/* routes (C-3)
// Skip in test environment to prevent exhausting the in-memory store during test runs
if (process.env.NODE_ENV !== "test") {
  app.use("/api", apiLimiter);
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/execute", executeRoutes);
app.use("/api/ai", aiRoutes);
app.get("/api/health", (_, res) => res.json({ status: "ok", ts: Date.now() }));

// Start only if not imported (for testing)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 CodeSync server running on port ${PORT}`);
  });
}

module.exports = { app, server };
