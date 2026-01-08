const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard_analytics_controller");
const { authenticateAdmin, authorizeRoles, ROLES } = require("../middleware/auth_middleware");

/**
 * Dashboard Analytics Routes
 * Routes are protected with role-based access control
 * 
 * Role Access:
 * - MANAGEMENT: Full access to all analytics, exports, and reports
 * - OPERATOR: Sport room view (equipment issues/returns) + recent events
 * - GUARD: Occupancy-only view for assigned facility
 * - AUDITOR: Raw event logs and alerts
 */

// ============================================
// KPI ENDPOINTS (accessible by all roles)
// ============================================

// Get current occupancy per facility (all roles)
router.get(
  "/dashboard/occupancy",
  authenticateAdmin,
  dashboardController.getCurrentOccupancy
);

// Get today's unique visitors (MANAGEMENT, AUDITOR)
router.get(
  "/dashboard/visitors/today",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.AUDITOR),
  dashboardController.getTodayVisitors
);

// Get active equipment issues (MANAGEMENT, OPERATOR)
router.get(
  "/dashboard/equipment/active",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.OPERATOR),
  dashboardController.getActiveEquipmentIssues
);

// Get average visit duration (MANAGEMENT, AUDITOR)
router.get(
  "/dashboard/duration",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.AUDITOR),
  dashboardController.getAverageVisitDuration
);

// Get scan counts for date range (MANAGEMENT, AUDITOR)
router.get(
  "/dashboard/scans",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.AUDITOR),
  dashboardController.getScanCounts
);

// ============================================
// TIME SERIES ENDPOINTS (MANAGEMENT only)
// ============================================

// Get occupancy time series for charts
router.get(
  "/dashboard/timeseries/occupancy",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT),
  dashboardController.getOccupancyTimeSeries
);

// Get hourly distribution (peak hours)
router.get(
  "/dashboard/timeseries/hourly",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT),
  dashboardController.getHourlyDistribution
);

// Get heatmap data (day vs hour)
router.get(
  "/dashboard/heatmap",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT),
  dashboardController.getHeatmapData
);

// ============================================
// EVENTS & TABLES (all except GUARD)
// ============================================

// Get recent events (combined entry/exit and equipment)
router.get(
  "/dashboard/events/recent",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.OPERATOR, ROLES.AUDITOR),
  dashboardController.getRecentEvents
);

// ============================================
// ALERTS (MANAGEMENT, OPERATOR, AUDITOR)
// ============================================

// Get unmatched entries (potential issues)
router.get(
  "/dashboard/alerts/unmatched",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.AUDITOR),
  dashboardController.getUnmatchedEntries
);

// Get overdue equipment returns
router.get(
  "/dashboard/alerts/overdue",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.OPERATOR, ROLES.AUDITOR),
  dashboardController.getOverdueReturns
);

// Get all alerts combined
router.get(
  "/dashboard/alerts",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT, ROLES.OPERATOR, ROLES.AUDITOR),
  dashboardController.getAlerts
);

// ============================================
// EXPORTS & REPORTS (MANAGEMENT only)
// ============================================

// Get export data for CSV/PDF
router.get(
  "/dashboard/export",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT),
  dashboardController.getExportData
);

// Get daily summary report
router.get(
  "/dashboard/summary/daily",
  authenticateAdmin,
  authorizeRoles(ROLES.MANAGEMENT),
  dashboardController.getDailySummary
);

// ============================================
// COMBINED OVERVIEW (all roles, filtered by role)
// ============================================

// Get complete dashboard overview
router.get(
  "/dashboard/overview",
  authenticateAdmin,
  dashboardController.getDashboardOverview
);

module.exports = router;
