const router = require("express").Router();
const { supabase } = require("../services/supabase");
const { generateToken, setTokenCookie, protect } = require("../middleware/auth");

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username)
      return res.status(400).json({ error: "All fields required" });

    // Check username taken
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (existing) return res.status(409).json({ error: "Username already taken" });

    // Create auth user via Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return res.status(400).json({ error: authError.message });

    // Create profile row
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      username,
      email,
    });

    if (profileError) return res.status(500).json({ error: profileError.message });

    const token = generateToken({ id: authData.user.id, email, username });
    setTokenCookie(res, token);

    res.status(201).json({
      user: { id: authData.user.id, email, username },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: "Invalid credentials" });

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", data.user.id)
      .single();

    const token = generateToken({
      id: data.user.id,
      email: data.user.email,
      username: profile?.username || data.user.email,
    });
    setTokenCookie(res, token);

    res.json({
      user: { id: data.user.id, email: data.user.email, username: profile?.username },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

// Me
router.get("/me", protect, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, email, created_at")
      .eq("id", req.user.id)
      .single();

    res.json({ user: profile || req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
