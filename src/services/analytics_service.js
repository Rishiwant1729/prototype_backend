const prisma = require("../db/prisma");

exports.getFacilityPeakUsage = async () => {
  // Get all sessions with entry time
  const sessions = await prisma.facilitySession.findMany({
    select: {
      facility_id: true,
      entry_time: true
    }
  });

  if (sessions.length === 0) {
    return [];
  }

  // Organize data by facility and hour
  const facilityMap = {};

  for (const session of sessions) {
    const hour = new Date(session.entry_time).getHours();
    const facility = session.facility_id;

    if (!facilityMap[facility]) {
      facilityMap[facility] = {};
    }

    if (!facilityMap[facility][hour]) {
      facilityMap[facility][hour] = 0;
    }

    facilityMap[facility][hour]++;
  }

  // Compute peak hour per facility
  const result = [];

  for (const facility in facilityMap) {
    const hourlyData = [];
    let peakHour = null;
    let peakEntries = 0;

    for (const hour in facilityMap[facility]) {
      const entries = facilityMap[facility][hour];
      hourlyData.push({ hour: parseInt(hour), entries });

      if (entries > peakEntries) {
        peakEntries = entries;
        peakHour = parseInt(hour);
      }
    }

    // Sort hourly data by hour
    hourlyData.sort((a, b) => a.hour - b.hour);

    result.push({
      facility,
      peak_hour: peakHour,
      peak_entries: peakEntries,
      hourly_distribution: hourlyData
    });
  }

  return result;
};

exports.getMissingEquipment = async () => {
  // Get all issue items - we'll filter in JS since Prisma doesn't support field comparison
  const items = await prisma.equipmentIssueItem.findMany({
    include: {
      issue: true
    }
  });

  // Filter items where issued > returned
  const missingItems = items.filter((item) => item.issued_qty > item.returned_qty);

  // Summary: total missing per equipment type
  const summaryMap = {};
  for (const item of missingItems) {
    const type = item.equipment_type;
    const missing = item.issued_qty - item.returned_qty;

    if (!summaryMap[type]) {
      summaryMap[type] = 0;
    }
    summaryMap[type] += missing;
  }

  const summary = Object.entries(summaryMap)
    .map(([equipment_type, total_missing]) => ({
      equipment_type,
      total_missing
    }))
    .sort((a, b) => b.total_missing - a.total_missing);

  // Details
  const details = missingItems
    .filter((item) => 
      item.issue.status === "ISSUED" || item.issue.status === "PARTIAL_RETURN"
    )
    .map((item) => ({
      equipment_type: item.equipment_type,
      student_id: item.issue.student_id,
      student_name: item.issue.student_name,
      issue_id: item.issue.issue_id,
      issued_at: item.issue.issued_at,
      missing_qty: item.issued_qty - item.returned_qty
    }))
    .sort((a, b) => new Date(a.issued_at) - new Date(b.issued_at));

  return {
    summary,
    details
  };
};

exports.getFacilityTrends = async (facility, granularity) => {
  const sessions = await prisma.facilitySession.findMany({
    where: { facility_id: facility },
    select: { entry_time: true },
    orderBy: { entry_time: "asc" }
  });

  const periodMap = {};

  for (const session of sessions) {
    const date = new Date(session.entry_time);
    let period;

    switch (granularity) {
      case "daily":
        period = date.toISOString().split("T")[0]; // YYYY-MM-DD
        break;

      case "weekly":
        // Get ISO week
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
      periodMap[period] = 0;
    }
    periodMap[period]++;
  }

  const data = Object.entries(periodMap)
    .map(([period, entries]) => ({ period, entries }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    facility,
    granularity,
    data
  };
};
