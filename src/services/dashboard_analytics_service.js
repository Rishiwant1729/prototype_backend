const prisma = require("../db/prisma");

/**
 * Dashboard Analytics Service
 * Provides comprehensive analytics for the management dashboard
 */

// ============================================
// KPI CARDS - Real-time metrics
// ============================================

/**
 * Get current occupancy per facility
 */
exports.getCurrentOccupancy = async () => {
  const activeSessionsRaw = await prisma.facilitySession.groupBy({
    by: ["facility_id"],
    where: {
      exit_time: null
    },
    _count: {
      session_id: true
    }
  });

  // Get all facilities for complete picture
  const facilities = await prisma.facility_config.findMany({
    select: {
      facility_id: true,
      facility_name: true
    }
  });

  const occupancy = facilities.map((f) => {
    const active = activeSessionsRaw.find((a) => a.facility_id === f.facility_id);
    return {
      facility_id: f.facility_id,
      facility_name: f.facility_name,
      current_count: active?._count?.session_id || 0
    };
  });

  const totalOccupancy = occupancy.reduce((sum, f) => sum + f.current_count, 0);

  return {
    facilities: occupancy,
    total: totalOccupancy
  };
};

/**
 * Get today's unique visitors per facility
 */
exports.getTodayVisitors = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await prisma.facilitySession.findMany({
    where: {
      entry_time: {
        gte: today,
        lt: tomorrow
      }
    },
    select: {
      facility_id: true,
      student_id: true
    }
  });

  // Count unique visitors per facility
  const facilityVisitors = {};
  const allVisitors = new Set();

  sessions.forEach((s) => {
    if (!facilityVisitors[s.facility_id]) {
      facilityVisitors[s.facility_id] = new Set();
    }
    facilityVisitors[s.facility_id].add(s.student_id);
    allVisitors.add(s.student_id);
  });

  const result = Object.entries(facilityVisitors).map(([facility_id, visitors]) => ({
    facility_id,
    unique_visitors: visitors.size
  }));

  return {
    facilities: result,
    total_unique: allVisitors.size
  };
};

/**
 * Get active issued equipment count
 */
exports.getActiveEquipmentIssues = async () => {
  const activeIssues = await prisma.equipmentIssue.findMany({
    where: {
      status: {
        in: ["ISSUED", "PARTIAL_RETURN"]
      }
    },
    include: {
      items: true,
      student: true
    }
  });

  const totalItems = activeIssues.reduce((sum, issue) => {
    return sum + issue.items.reduce((itemSum, item) => {
      return itemSum + (item.issued_qty - (item.returned_qty || 0));
    }, 0);
  }, 0);

  return {
    active_issues: activeIssues.length,
    total_pending_items: totalItems,
    issues: activeIssues.map((issue) => ({
      issue_id: issue.issue_id,
      student_id: issue.student_id,
      student_name: issue.student_name,
      issued_at: issue.issued_at,
      status: issue.status,
      items: issue.items.map((item) => ({
        equipment_type: item.equipment_type,
        issued_qty: item.issued_qty,
        returned_qty: item.returned_qty || 0,
        pending_qty: item.issued_qty - (item.returned_qty || 0)
      }))
    }))
  };
};

/**
 * Get average visit duration per facility
 */
exports.getAverageVisitDuration = async (startDate, endDate) => {
  const whereClause = {
    exit_time: { not: null },
    duration_minutes: { not: null }
  };

  if (startDate && endDate) {
    whereClause.entry_time = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const sessions = await prisma.facilitySession.groupBy({
    by: ["facility_id"],
    where: whereClause,
    _avg: {
      duration_minutes: true
    },
    _count: {
      session_id: true
    }
  });

  return sessions.map((s) => ({
    facility_id: s.facility_id,
    avg_duration_minutes: Math.round(s._avg.duration_minutes || 0),
    total_sessions: s._count.session_id
  }));
};

/**
 * Get scan counts for a date range
 */
exports.getScanCounts = async (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Entry counts
  const entryCounts = await prisma.facilitySession.count({
    where: {
      entry_time: {
        gte: start,
        lte: end
      }
    }
  });

  // Exit counts
  const exitCounts = await prisma.facilitySession.count({
    where: {
      exit_time: {
        gte: start,
        lte: end,
        not: null
      }
    }
  });

  // Equipment issues
  const issueCounts = await prisma.equipmentIssue.count({
    where: {
      issued_at: {
        gte: start,
        lte: end
      }
    }
  });

  // Equipment returns
  const returnCounts = await prisma.equipmentIssue.count({
    where: {
      returned_at: {
        gte: start,
        lte: end,
        not: null
      }
    }
  });

  return {
    entries: entryCounts,
    exits: exitCounts,
    equipment_issues: issueCounts,
    equipment_returns: returnCounts,
    total_events: entryCounts + exitCounts + issueCounts + returnCounts
  };
};

// ============================================
// TIME SERIES DATA
// ============================================

/**
 * Get occupancy over time for charts
 */
exports.getOccupancyTimeSeries = async (facility, startDate, endDate, granularity = "hourly") => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const whereClause = {
    entry_time: {
      gte: start,
      lte: end
    }
  };

  if (facility && facility !== "ALL") {
    whereClause.facility_id = facility;
  }

  const sessions = await prisma.facilitySession.findMany({
    where: whereClause,
    select: {
      facility_id: true,
      entry_time: true,
      exit_time: true
    },
    orderBy: {
      entry_time: "asc"
    }
  });

  // Group by time period
  const periodMap = {};

  sessions.forEach((session) => {
    const date = new Date(session.entry_time);
    let period;

    switch (granularity) {
      case "hourly":
        period = `${date.toISOString().split("T")[0]} ${date.getHours().toString().padStart(2, "0")}:00`;
        break;
      case "daily":
        period = date.toISOString().split("T")[0];
        break;
      case "weekly":
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        period = `${date.getFullYear()}-W${week.toString().padStart(2, "0")}`;
        break;
      case "monthly":
        period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        break;
      default:
        period = date.toISOString().split("T")[0];
    }

    if (!periodMap[period]) {
      periodMap[period] = { entries: 0, exits: 0 };
    }
    periodMap[period].entries++;

    if (session.exit_time) {
      const exitDate = new Date(session.exit_time);
      let exitPeriod;
      switch (granularity) {
        case "hourly":
          exitPeriod = `${exitDate.toISOString().split("T")[0]} ${exitDate.getHours().toString().padStart(2, "0")}:00`;
          break;
        case "daily":
          exitPeriod = exitDate.toISOString().split("T")[0];
          break;
        default:
          exitPeriod = period;
      }
      if (!periodMap[exitPeriod]) {
        periodMap[exitPeriod] = { entries: 0, exits: 0 };
      }
      periodMap[exitPeriod].exits++;
    }
  });

  const data = Object.entries(periodMap)
    .map(([period, counts]) => ({
      period,
      entries: counts.entries,
      exits: counts.exits,
      net: counts.entries - counts.exits
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    facility: facility || "ALL",
    granularity,
    data
  };
};

/**
 * Get hourly distribution (for peak hours chart)
 */
exports.getHourlyDistribution = async (facility, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const whereClause = {
    entry_time: {
      gte: start,
      lte: end
    }
  };

  if (facility && facility !== "ALL") {
    whereClause.facility_id = facility;
  }

  const sessions = await prisma.facilitySession.findMany({
    where: whereClause,
    select: {
      entry_time: true
    }
  });

  // Count by hour
  const hourCounts = Array(24).fill(0);

  sessions.forEach((session) => {
    const hour = new Date(session.entry_time).getHours();
    hourCounts[hour]++;
  });

  return hourCounts.map((count, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    count
  }));
};

/**
 * Get heatmap data (day vs hour)
 */
exports.getHeatmapData = async (facility, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const whereClause = {
    entry_time: {
      gte: start,
      lte: end
    }
  };

  if (facility && facility !== "ALL") {
    whereClause.facility_id = facility;
  }

  const sessions = await prisma.facilitySession.findMany({
    where: whereClause,
    select: {
      entry_time: true
    }
  });

  // Create 7x24 matrix (days x hours)
  const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  sessions.forEach((session) => {
    const date = new Date(session.entry_time);
    const day = date.getDay(); // 0-6
    const hour = date.getHours(); // 0-23
    heatmap[day][hour]++;
  });

  // Convert to flat array for easier frontend consumption
  const data = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        day,
        dayName: dayNames[day],
        hour,
        count: heatmap[day][hour]
      });
    }
  }

  return {
    matrix: heatmap,
    flat: data,
    days: dayNames
  };
};

// ============================================
// RECENT EVENTS & TABLES
// ============================================

/**
 * Get recent scan events (combined entry/exit and equipment)
 */
exports.getRecentEvents = async (limit = 50, facility = null) => {
  // Get recent facility sessions
  const sessionWhereClause = {};
  if (facility && facility !== "ALL" && facility !== "SPORTS_ROOM") {
    sessionWhereClause.facility_id = facility;
  }

  const recentSessions = await prisma.facilitySession.findMany({
    where: facility === "SPORTS_ROOM" ? { facility_id: "__NONE__" } : sessionWhereClause,
    include: {
      student: true
    },
    orderBy: {
      entry_time: "desc"
    },
    take: limit
  });

  // Get recent equipment issues/returns
  const recentIssues = await prisma.equipmentIssue.findMany({
    include: {
      student: true,
      items: true
    },
    orderBy: {
      issued_at: "desc"
    },
    take: limit
  });

  // Combine and format events
  const events = [];

  // Add entry/exit events
  recentSessions.forEach((session) => {
    events.push({
      type: "ENTRY",
      timestamp: session.entry_time,
      facility_id: session.facility_id,
      student_id: session.student_id,
      student_name: session.student?.student_name || "Unknown",
      program: session.student?.program || null,
      details: null
    });

    if (session.exit_time) {
      events.push({
        type: "EXIT",
        timestamp: session.exit_time,
        facility_id: session.facility_id,
        student_id: session.student_id,
        student_name: session.student?.student_name || "Unknown",
        program: session.student?.program || null,
        details: {
          duration_minutes: session.duration_minutes
        }
      });
    }
  });

  // Add equipment events
  recentIssues.forEach((issue) => {
    events.push({
      type: "EQUIPMENT_ISSUE",
      timestamp: issue.issued_at,
      facility_id: "SPORTS_ROOM",
      student_id: issue.student_id,
      student_name: issue.student_name,
      program: issue.student?.program || null,
      details: {
        issue_id: issue.issue_id,
        items: issue.items.map((i) => ({
          equipment_type: i.equipment_type,
          qty: i.issued_qty
        })),
        assistant_id: issue.assistant_id
      }
    });

    if (issue.returned_at) {
      events.push({
        type: "EQUIPMENT_RETURN",
        timestamp: issue.returned_at,
        facility_id: "SPORTS_ROOM",
        student_id: issue.student_id,
        student_name: issue.student_name,
        program: issue.student?.program || null,
        details: {
          issue_id: issue.issue_id,
          items: issue.items.map((i) => ({
            equipment_type: i.equipment_type,
            returned_qty: i.returned_qty
          })),
          fully_returned: issue.status === "RETURNED"
        }
      });
    }
  });

  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Apply facility filter for SPORTS_ROOM
  let filteredEvents = events;
  if (facility === "SPORTS_ROOM") {
    filteredEvents = events.filter((e) => 
      e.type === "EQUIPMENT_ISSUE" || e.type === "EQUIPMENT_RETURN"
    );
  }

  return filteredEvents.slice(0, limit);
};

// ============================================
// ALERTS & FLAGS
// ============================================

/**
 * Get unmatched entries (entries without exits, older than X hours)
 */
exports.getUnmatchedEntries = async (olderThanHours = 4) => {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - olderThanHours);

  const unmatched = await prisma.facilitySession.findMany({
    where: {
      exit_time: null,
      entry_time: {
        lt: cutoff
      }
    },
    include: {
      student: true
    },
    orderBy: {
      entry_time: "asc"
    }
  });

  return unmatched.map((session) => ({
    session_id: session.session_id,
    facility_id: session.facility_id,
    student_id: session.student_id,
    student_name: session.student?.student_name || "Unknown",
    entry_time: session.entry_time,
    hours_ago: Math.round((Date.now() - new Date(session.entry_time).getTime()) / (1000 * 60 * 60))
  }));
};

/**
 * Get overdue equipment returns
 */
exports.getOverdueReturns = async (olderThanHours = 24) => {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - olderThanHours);

  const overdue = await prisma.equipmentIssue.findMany({
    where: {
      status: {
        in: ["ISSUED", "PARTIAL_RETURN"]
      },
      issued_at: {
        lt: cutoff
      }
    },
    include: {
      student: true,
      items: true
    },
    orderBy: {
      issued_at: "asc"
    }
  });

  return overdue.map((issue) => ({
    issue_id: issue.issue_id,
    student_id: issue.student_id,
    student_name: issue.student_name,
    issued_at: issue.issued_at,
    hours_ago: Math.round((Date.now() - new Date(issue.issued_at).getTime()) / (1000 * 60 * 60)),
    items: issue.items.map((i) => ({
      equipment_type: i.equipment_type,
      pending_qty: i.issued_qty - (i.returned_qty || 0)
    })).filter((i) => i.pending_qty > 0)
  }));
};

// ============================================
// EXPORTS & REPORTS
// ============================================

/**
 * Generate data for CSV/PDF export
 */
exports.getExportData = async (facility, startDate, endDate, type = "events") => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (type === "events") {
    const whereClause = {
      entry_time: {
        gte: start,
        lte: end
      }
    };

    if (facility && facility !== "ALL") {
      whereClause.facility_id = facility;
    }

    const sessions = await prisma.facilitySession.findMany({
      where: whereClause,
      include: {
        student: true
      },
      orderBy: {
        entry_time: "desc"
      }
    });

    return sessions.map((s) => ({
      date: s.entry_time.toISOString().split("T")[0],
      time: s.entry_time.toISOString().split("T")[1].slice(0, 8),
      facility: s.facility_id,
      student_id: s.student_id,
      student_name: s.student?.student_name || "Unknown",
      program: s.student?.program || "",
      entry_time: s.entry_time.toISOString(),
      exit_time: s.exit_time?.toISOString() || "",
      duration_minutes: s.duration_minutes || ""
    }));
  }

  if (type === "equipment") {
    const issues = await prisma.equipmentIssue.findMany({
      where: {
        issued_at: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: true,
        student: true
      },
      orderBy: {
        issued_at: "desc"
      }
    });

    const rows = [];
    issues.forEach((issue) => {
      issue.items.forEach((item) => {
        rows.push({
          date: issue.issued_at.toISOString().split("T")[0],
          student_id: issue.student_id,
          student_name: issue.student_name,
          program: issue.student?.program || "",
          equipment_type: item.equipment_type,
          issued_qty: item.issued_qty,
          returned_qty: item.returned_qty || 0,
          pending_qty: item.issued_qty - (item.returned_qty || 0),
          status: issue.status,
          issued_at: issue.issued_at.toISOString(),
          returned_at: issue.returned_at?.toISOString() || ""
        });
      });
    });

    return rows;
  }

  return [];
};

/**
 * Get daily summary report
 */
exports.getDailySummary = async (date) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Total entries per facility
  const entries = await prisma.facilitySession.groupBy({
    by: ["facility_id"],
    where: {
      entry_time: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    _count: {
      session_id: true
    }
  });

  // Unique visitors
  const uniqueVisitors = await prisma.facilitySession.findMany({
    where: {
      entry_time: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    select: {
      student_id: true
    },
    distinct: ["student_id"]
  });

  // Equipment issued
  const equipmentIssued = await prisma.equipmentIssue.count({
    where: {
      issued_at: {
        gte: dayStart,
        lte: dayEnd
      }
    }
  });

  // Equipment returned
  const equipmentReturned = await prisma.equipmentIssue.count({
    where: {
      returned_at: {
        gte: dayStart,
        lte: dayEnd
      }
    }
  });

  // Average duration
  const avgDuration = await prisma.facilitySession.aggregate({
    where: {
      entry_time: {
        gte: dayStart,
        lte: dayEnd
      },
      duration_minutes: { not: null }
    },
    _avg: {
      duration_minutes: true
    }
  });

  return {
    date: date,
    entries_by_facility: entries.map((e) => ({
      facility_id: e.facility_id,
      count: e._count.session_id
    })),
    total_entries: entries.reduce((sum, e) => sum + e._count.session_id, 0),
    unique_visitors: uniqueVisitors.length,
    equipment_issued: equipmentIssued,
    equipment_returned: equipmentReturned,
    avg_duration_minutes: Math.round(avgDuration._avg?.duration_minutes || 0)
  };
};
