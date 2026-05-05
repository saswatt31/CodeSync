const jwt = require("jsonwebtoken");
const { supabase } = require("../services/supabase");

const protect = async (req, res, next) => {
  try {
    let token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.token;

    // Handle stringified null/undefined from client storage
    if (token === "undefined" || token === "null") token = null;

    if (!token) {
      console.warn("Auth failed: No token found in headers or cookies");
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtErr) {
      console.error("JWT Verify Error:", jwtErr.message, "Token start:", token.substring(0, 10));
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (err) {
    console.error("Protect Middleware Error:", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("Not authenticated"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const setTokenCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    // C-8: In production with separate domains, sameSite must be "none" + secure.
    // In development (same origin), "lax" is sufficient and secure:false allows HTTP.
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

module.exports = { protect, authenticateSocket, generateToken, setTokenCookie };
