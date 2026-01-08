const express = require("express");
const router = express.Router();

const sportsRoomController = require("../controllers/sports_room_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");

// Issue equipment to a student
// POST /api/sports-room/issue
router.post("/sports-room/issue", authenticateAdmin, sportsRoomController.issueEquipment);

// Return equipment
// POST /api/sports-room/return
router.post("/sports-room/return", authenticateAdmin, sportsRoomController.returnEquipment);

// Get missing equipment report
// GET /api/sports-room/missing
router.get("/sports-room/missing", authenticateAdmin, sportsRoomController.getMissingEquipment);

// Get available equipment
// GET /api/sports-room/equipment
router.get("/sports-room/equipment", authenticateAdmin, sportsRoomController.getAvailableEquipment);

module.exports = router;
