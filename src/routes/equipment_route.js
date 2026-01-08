const express = require("express");
const router = express.Router();

const equipmentController = require("../controllers/equipment_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");
console.log("equipmentController:", equipmentController);
// Issue equipment
router.post(
  "/issue",
  authenticateAdmin,
  equipmentController.issueEquipment
);

// Return equipment
router.post(
  "/return",
  authenticateAdmin,
  equipmentController.returnEquipment
);

// Student equipment history
router.get(
  "/history/:student_id",
  authenticateAdmin,
  equipmentController.getStudentHistory
);

module.exports = router;
