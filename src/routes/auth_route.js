const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth_controller");
const { authenticateAdmin } = require("../middleware/auth_middleware");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/bootstrap", authController.status);
router.get("/status", authenticateAdmin, (req, res) => {
  res.json({
    loggedIn: true,
    admin: req.admin
  });
});

module.exports = router;
