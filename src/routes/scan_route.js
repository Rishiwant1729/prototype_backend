const express = require("express");
const router = express.Router();
const scanController = require("../controllers/scan_controller");

router.post("/scan", scanController.handleScan);

module.exports = router;
