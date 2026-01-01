const db = require("../db");

const DEBOUNCE_SECONDS = 3;
const TRANSITION_MINUTES = 3;

exports.processScan = async (uid, facility) => {
  // 1️⃣ Resolve UID → student
  const [students] = await db.execute(
    `SELECT s.student_id, s.student_name
     FROM rfid_mapping r
     JOIN students s ON r.student_id = s.student_id
     WHERE r.uid = ? AND r.status = 'active'`,
    [uid]
  );

  if (students.length === 0) {
    return { action: "REJECTED", reason: "Unknown card" };
  }

  const student = students[0];

  // 2️⃣ Debounce check (same facility)
  const [lastScan] = await db.execute(
    `SELECT entry_time
     FROM facility_sessions
     WHERE student_id = ? AND facility_id = ?
     ORDER BY entry_time DESC
     LIMIT 1`,
    [student.student_id, facility]
  );

  if (lastScan.length > 0) {
    const diffSeconds =
      (Date.now() - new Date(lastScan[0].entry_time).getTime()) / 1000;

    if (diffSeconds < DEBOUNCE_SECONDS) {
      return {
        student: student.student_name,
        facility,
        action: "IGNORED",
        reason: "Double tap"
      };
    }
  }

  // 2.5️⃣ GLOBAL single-facility rule (IMPORTANT FIX)
  const [activeSession] = await db.execute(
    `SELECT session_id, facility_id, entry_time
     FROM facility_sessions
     WHERE student_id = ?
       AND exit_time IS NULL
     LIMIT 1`,
    [student.student_id]
  );

  if (
    activeSession.length > 0 &&
    activeSession[0].facility_id !== facility
  ) {
    const entryTime = new Date(activeSession[0].entry_time);
    const diffMinutes =
      (Date.now() - entryTime.getTime()) / 60000;

    // Too soon → ignore scan
    if (diffMinutes < TRANSITION_MINUTES) {
      return {
        student: student.student_name,
        action: "IGNORED",
        reason: "Facility switch too soon"
      };
    }

    // Legit facility switch → auto-exit previous
    await db.execute(
      `UPDATE facility_sessions
       SET exit_time = NOW(),
           exit_reason = 'IMPLICIT_EXIT',
           duration_minutes = TIMESTAMPDIFF(MINUTE, entry_time, NOW())
       WHERE session_id = ?`,
      [activeSession[0].session_id]
    );
  }

  // 3️⃣ Same facility OPEN session → EXIT
  const [openSession] = await db.execute(
    `SELECT session_id, entry_time
     FROM facility_sessions
     WHERE student_id = ? AND facility_id = ?
       AND exit_time IS NULL`,
    [student.student_id, facility]
  );

  if (openSession.length > 0) {
    await db.execute(
      `UPDATE facility_sessions
       SET exit_time = NOW(),
           exit_reason = 'NORMAL_SCAN',
           duration_minutes = TIMESTAMPDIFF(MINUTE, entry_time, NOW())
       WHERE session_id = ?`,
      [openSession[0].session_id]
    );

    return {
      student: student.student_name,
      facility,
      action: "EXIT"
    };
  }

  // 4️⃣ Late exit (grace window)
  const [lastSession] = await db.execute(
    `SELECT fs.session_id, fs.entry_time, fs.exit_time, fs.exit_reason,
            fc.grace_window_minutes
     FROM facility_sessions fs
     JOIN facility_config fc ON fs.facility_id = fc.facility_id
     WHERE fs.student_id = ? AND fs.facility_id = ?
     ORDER BY fs.entry_time DESC
     LIMIT 1`,
    [student.student_id, facility]
  );

  if (
    lastSession.length > 0 &&
    lastSession[0].exit_reason === "AUTO_TIMEOUT"
  ) {
    const diffMinutes =
      (Date.now() - new Date(lastSession[0].exit_time).getTime()) / 60000;

    if (diffMinutes <= lastSession[0].grace_window_minutes) {
      await db.execute(
        `UPDATE facility_sessions
         SET exit_time = NOW(),
             exit_reason = 'AUTO_TIMEOUT_LATE_SCAN',
             duration_minutes = TIMESTAMPDIFF(MINUTE, entry_time, NOW())
         WHERE session_id = ?`,
        [lastSession[0].session_id]
      );

      return {
        student: student.student_name,
        facility,
        action: "LATE_EXIT"
      };
    }
  }

  // 5️⃣ ENTRY
  await db.execute(
    `INSERT INTO facility_sessions
     (session_id, uid, student_id, facility_id, entry_time)
     VALUES (UUID(), ?, ?, ?, NOW())`,
    [uid, student.student_id, facility]
  );

  return {
    student: student.student_name,
    facility,
    action: "ENTRY"
  };
};
