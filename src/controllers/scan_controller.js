const scanService = require("../services/scan_service");

exports.handleScan = async (req, res) => {
  try {
    const { uid, facility } = req.body || {};
    const sanitizedFacility = facility?.toUpperCase();


    if (!uid || !facility) {
      return res.status(400).json({
        error: "UID and facility are required"
      });
    }

    const result = await scanService.processScan(uid, sanitizedFacility);

    return res.json(result);
  } catch (err) {
    console.error("Scan error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
};
