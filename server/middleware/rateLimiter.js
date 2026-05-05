const rateLimit = require("express-rate-limit");

// In test environment, return a no-op middleware to prevent in-memory store
// exhaustion that would cause false 429s during test runs.
const noopMiddleware = (req, res, next) => next();
const isTest = process.env.NODE_ENV === "test";

const apiLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Global rate limit reached." },
});

const aiLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI review limit reached." },
});

const executeLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Execution limit reached." },
});

module.exports = { apiLimiter, aiLimiter, executeLimiter };
