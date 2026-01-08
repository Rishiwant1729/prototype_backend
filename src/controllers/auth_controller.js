const authService = require("../services/auth_service");

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const result = await authService.signup(name, email, password);
    return res.json(result);
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



exports.status = async (req, res) => {
  try {
    const [rows] = await require("../db").execute(
      "SELECT COUNT(*) AS count FROM admins"
    );

    res.json({
      admin_exists: rows[0].count > 0
    });
  } catch (err) {
    console.error("Auth status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
