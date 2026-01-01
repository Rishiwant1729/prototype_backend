const express = require("express");
const router = express.Router();
const studentController = require("../controllers/student_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");

// PROTECTED
router.get(
  "/students/search",
  authenticateAdmin,
  studentController.searchStudents
);

module.exports = router;
