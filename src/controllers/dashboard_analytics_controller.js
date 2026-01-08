const dashboardService = require("../services/dashboard_analytics_service");

/**
 * Dashboard Analytics Controller
 * Handles all requests for the management dashboard
 */

// ============================================
// KPI ENDPOINTS
// ============================================

exports.getCurrentOccupancy = async (req, res) => {
  try {
    const result = await dashboardService.getCurrentOccupancy();
    return res.json(result);
  } catch (err) {
    console.error("Current occupancy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTodayVisitors = async (req, res) => {
  try {
    const result = await dashboardService.getTodayVisitors();
    return res.json(result);
  } catch (err) {
    console.error("Today visitors error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getActiveEquipmentIssues = async (req, res) => {
  try {
    const result = await dashboardService.getActiveEquipmentIssues();
    return res.json(result);
  } catch (err) {
    console.error("Active equipment issues error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAverageVisitDuration = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await dashboardService.getAverageVisitDuration(startDate, endDate);
    return res.json(result);
  } catch (err) {
    console.error("Average visit duration error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getScanCounts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const result = await dashboardService.getScanCounts(startDate, endDate);
    return res.json(result);
  } catch (err) {
    console.error("Scan counts error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// TIME SERIES ENDPOINTS
// ============================================

exports.getOccupancyTimeSeries = async (req, res) => {
  try {
    const { facility, startDate, endDate, granularity } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const result = await dashboardService.getOccupancyTimeSeries(
      facility,
      startDate,
      endDate,
      granularity || "hourly"
    );
    return res.json(result);
  } catch (err) {
    console.error("Occupancy time series error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getHourlyDistribution = async (req, res) => {
  try {
    const { facility, startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const result = await dashboardService.getHourlyDistribution(
      facility,
      startDate,
      endDate
    );
    return res.json(result);
  } catch (err) {
    console.error("Hourly distribution error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getHeatmapData = async (req, res) => {
  try {
    const { facility, startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const result = await dashboardService.getHeatmapData(
      facility,
      startDate,
      endDate
    );
    return res.json(result);
  } catch (err) {
    console.error("Heatmap data error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// EVENTS & TABLES
// ============================================

exports.getRecentEvents = async (req, res) => {
  try {
    const { limit, facility } = req.query;
    const result = await dashboardService.getRecentEvents(
      limit ? parseInt(limit) : 50,
      facility
    );
    return res.json(result);
  } catch (err) {
    console.error("Recent events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// ALERTS
// ============================================

exports.getUnmatchedEntries = async (req, res) => {
  try {
    const { olderThanHours } = req.query;
    const result = await dashboardService.getUnmatchedEntries(
      olderThanHours ? parseInt(olderThanHours) : 4
    );
    return res.json(result);
  } catch (err) {
    console.error("Unmatched entries error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOverdueReturns = async (req, res) => {
  try {
    const { olderThanHours } = req.query;
    const result = await dashboardService.getOverdueReturns(
      olderThanHours ? parseInt(olderThanHours) : 24
    );
    return res.json(result);
  } catch (err) {
    console.error("Overdue returns error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const unmatchedEntries = await dashboardService.getUnmatchedEntries(4);
    const overdueReturns = await dashboardService.getOverdueReturns(24);
    
    return res.json({
      unmatched_entries: unmatchedEntries,
      overdue_returns: overdueReturns,
      total_alerts: unmatchedEntries.length + overdueReturns.length
    });
  } catch (err) {
    console.error("Alerts error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// EXPORTS & REPORTS
// ============================================

exports.getExportData = async (req, res) => {
  try {
    const { facility, startDate, endDate, type } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const result = await dashboardService.getExportData(
      facility,
      startDate,
      endDate,
      type || "events"
    );
    return res.json(result);
  } catch (err) {
    console.error("Export data error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: "date is required" });
    }
    
    const result = await dashboardService.getDailySummary(date);
    return res.json(result);
  } catch (err) {
    console.error("Daily summary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// COMBINED DASHBOARD DATA
// ============================================

exports.getDashboardOverview = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    // Get all KPI data in parallel
    const [
      occupancy,
      visitors,
      activeEquipment,
      alerts
    ] = await Promise.all([
      dashboardService.getCurrentOccupancy(),
      dashboardService.getTodayVisitors(),
      dashboardService.getActiveEquipmentIssues(),
      Promise.all([
        dashboardService.getUnmatchedEntries(4),
        dashboardService.getOverdueReturns(24)
      ]).then(([unmatched, overdue]) => ({
        unmatched_entries: unmatched.length,
        overdue_returns: overdue.length,
        total: unmatched.length + overdue.length
      }))
    ]);
    
    return res.json({
      timestamp: new Date().toISOString(),
      occupancy,
      visitors,
      active_equipment: activeEquipment,
      alerts
    });
  } catch (err) {
    console.error("Dashboard overview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
