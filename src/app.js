const path = require("path");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env")
});
const express = require("express");
const scanRoutes = require("./routes/scan_route");
const equipmentRoutes = require("./routes/equipment_route");
const studentRoutes = require("./routes/student_route");
const analyticsRoutes = require("./routes/analytics_route");
const authRoutes = require("./routes/auth_route");








const app = express();
app.use(express.json());

app.use("/api", scanRoutes);
app.use("/api", equipmentRoutes);
app.use("/api", studentRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", authRoutes);


module.exports = app;
