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

// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "http://10.7.9.130:5173"
//     ],
//     credentials: true
//   })
// );


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174"
    ],
    credentials: true
  })
);
app.use(express.json());


app.use("/api", scanRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", studentRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", authRoutes);
app.use("/api", sportsRoomRoutes);
app.use("/api", dashboardAnalyticsRoutes);


module.exports = app;
