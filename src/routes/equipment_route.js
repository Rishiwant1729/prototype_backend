const express = require("express");
const router = express.Router();
const equipmentController = require("../controllers/equipment_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");

// PROTECTED ROUTES
router.post("/equipment/issue", authenticateAdmin, equipmentController.issueEquipment);
router.post("/equipment/return", authenticateAdmin, equipmentController.returnEquipment);
router.get("/equipment/pending", authenticateAdmin, equipmentController.getPendingIssues);
router.get(
  "/equipment/student/:student_id",
  authenticateAdmin,
  equipmentController.getStudentHistory
);

module.exports = router;
