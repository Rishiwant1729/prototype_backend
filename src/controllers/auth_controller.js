const authService = require("../services/auth_service");
const prisma = require("../db/prisma");

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const result = await authService.signup(name, email, password);
    if (result?.action === "DB_ERROR") {
      return res.status(503).json(result);
    }
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
    if (result?.action === "DB_ERROR") {
      return res.status(503).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



exports.status = async (req, res) => {
  try {
    const count = await prisma.admin.count();
    res.json({ admin_exists: count > 0 });
  } catch (err) {
    const msg = String(err?.message || "");
    const looksLikeDb =
      msg.includes("Authentication failed against database server") ||
      err?.name === "PrismaClientInitializationError";
    if (looksLikeDb) {
      return res.status(503).json({
        error: "Database unavailable",
        reason: "Database connection failed. Check DATABASE_URL / MySQL credentials."
      });
    }
    console.error("Auth status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
