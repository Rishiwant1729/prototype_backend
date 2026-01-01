const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");

// PROTECTED ROUTES
router.get(
  "/analytics/facility/peak",
  authenticateAdmin,
  analyticsController.getFacilityPeakUsage
);

router.get(
  "/analytics/facility/trends",
  authenticateAdmin,
  analyticsController.getFacilityTrends
);

router.get(
  "/analytics/equipment/missing",
  authenticateAdmin,
  analyticsController.getMissingEquipment
);

module.exports = router;
