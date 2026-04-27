const path = require("path");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env")
});

const cors = require("cors");
const express = require("express");
const scanRoutes = require("./routes/scan_route");
const equipmentRoutes = require("./routes/equipment_route");
const studentRoutes = require("./routes/student_route");
const analyticsRoutes = require("./routes/analytics_route");
const authRoutes = require("./routes/auth_route");
const sportsRoomRoutes = require("./routes/sports_room_route");
const dashboardAnalyticsRoutes = require("./routes/dashboard_analytics_route");

const app = express();

function isVercelPreviewOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function getAllowedOrigins() {
  // Comma-separated list, e.g.
  // CORS_ORIGINS="https://my-frontend.vercel.app,http://localhost:5173"
  const fromEnv = process.env.CORS_ORIGINS;
  const envOrigins = fromEnv
    ? fromEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Reasonable defaults for local dev + the currently deployed Vercel URL.
  const defaults = [
    "https://prototype-frontend-brown.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];

  return Array.from(new Set([...defaults, ...envOrigins]));
}

const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin(origin, cb) {
    // Allow non-browser requests (no Origin header), like curl/healthchecks.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (isVercelPreviewOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

// Handle preflight explicitly (avoids odd proxy/edge behaviors).
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});


app.use("/api", scanRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", studentRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", authRoutes);
app.use("/api", sportsRoomRoutes);
app.use("/api", dashboardAnalyticsRoutes);


module.exports = app;
