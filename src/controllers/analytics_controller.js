const analyticsService = require("../services/analytics_service");

exports.getFacilityPeakUsage = async (req, res) => {
  try {
    const result = await analyticsService.getFacilityPeakUsage();
    return res.json(result);
  } catch (err) {
    console.error("Facility peak analytics error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



exports.getMissingEquipment = async (req, res) => {
  try {
    const result = await analyticsService.getMissingEquipment();
    return res.json(result);
  } catch (err) {
    console.error("Missing equipment analytics error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



exports.getFacilityTrends = async (req, res) => {
  try {
    const { facility, granularity } = req.query;

    if (!facility || !granularity) {
      return res.status(400).json({
        error: "facility and granularity are required"
      });
    }

    if (!["daily", "weekly", "monthly"].includes(granularity)) {
      return res.status(400).json({
        error: "granularity must be daily, weekly, or monthly"
      });
    }

    const result = await analyticsService.getFacilityTrends(
      facility.toUpperCase(),
      granularity
    );

    return res.json(result);
  } catch (err) {
    console.error("Facility trends analytics error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
