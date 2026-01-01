const db = require("../db");

exports.getFacilityPeakUsage = async () => {
  // 1️⃣ Hour-wise usage per facility
  const [rows] = await db.execute(
    `SELECT
        facility_id,
        HOUR(entry_time) AS hour,
        COUNT(*) AS entries
     FROM facility_sessions
     GROUP BY facility_id, hour
     ORDER BY facility_id, hour`
  );

  if (rows.length === 0) {
    return [];
  }

  // 2️⃣ Organize data by facility
  const facilityMap = {};

  for (const row of rows) {
    if (!facilityMap[row.facility_id]) {
      facilityMap[row.facility_id] = [];
    }

    facilityMap[row.facility_id].push({
      hour: row.hour,
      entries: row.entries
    });
  }

  // 3️⃣ Compute peak hour per facility
  const result = [];

  for (const facility in facilityMap) {
    const hourlyData = facilityMap[facility];

    let peakHour = null;
    let peakEntries = 0;

    for (const h of hourlyData) {
      if (h.entries > peakEntries) {
        peakEntries = h.entries;
        peakHour = h.hour;
      }
    }

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
  // 1️⃣ Summary: total missing per equipment
  const [summaryRows] = await db.execute(
    `SELECT
        equipment_type,
        SUM(issued_qty - returned_qty) AS total_missing
     FROM equipment_issue_items
     WHERE issued_qty > returned_qty
     GROUP BY equipment_type
     HAVING total_missing > 0
     ORDER BY total_missing DESC`
  );

  // 2️⃣ Details: who has what missing
  const [detailRows] = await db.execute(
    `SELECT
        ei.equipment_type,
        i.student_id,
        i.student_name,
        i.issue_id,
        i.issued_at,
        (ei.issued_qty - ei.returned_qty) AS missing_qty
     FROM equipment_issue_items ei
     JOIN equipment_issues i
       ON ei.issue_id = i.issue_id
     WHERE ei.issued_qty > ei.returned_qty
       AND i.status IN ('ISSUED', 'PARTIAL_RETURN')
     ORDER BY i.issued_at ASC`
  );

  return {
    summary: summaryRows,
    details: detailRows
  };
};



exports.getFacilityTrends = async (facility, granularity) => {
  let groupExpr;
  let labelExpr;

  switch (granularity) {
    case "daily":
      groupExpr = "DATE(entry_time)";
      labelExpr = "DATE(entry_time)";
      break;

    case "weekly":
      groupExpr = "YEARWEEK(entry_time)";
      labelExpr = "YEARWEEK(entry_time)";
      break;

    case "monthly":
      groupExpr = "DATE_FORMAT(entry_time, '%Y-%m')";
      labelExpr = "DATE_FORMAT(entry_time, '%Y-%m')";
      break;
  }

  const [rows] = await db.execute(
    `
    SELECT
      ${labelExpr} AS period,
      COUNT(*) AS entries
    FROM facility_sessions
    WHERE facility_id = ?
    GROUP BY ${groupExpr}
    ORDER BY ${groupExpr}
    `,
    [facility]
  );

  return {
    facility,
    granularity,
    data: rows
  };
};
