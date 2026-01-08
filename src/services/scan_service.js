const prisma = require("../db/prisma");
const { emitScanEvent } = require("../websocket/ws_emitter");
const sportsRoomService = require("./sports_room_service");

const DEBOUNCE_SECONDS = 3;
const TRANSITION_MINUTES = 3;

// Facilities that use ENTRY/EXIT logic (NOT SPORTS_ROOM)
const FACILITY_FACILITIES = ["GYM", "COURT", "SWIMMING", "BADMINTON"];

/**
 * Main scan processor - routes to appropriate handler
 */
exports.processScan = async (uid, facility) => {
  // ========================================
  // SPORTS_ROOM: Completely separate flow
  // ========================================
  if (facility === "SPORTS_ROOM") {
    return await processSportsRoomScan(uid);
  }

  // ========================================
  // FACILITY FLOW: GYM, COURT, SWIMMING, etc.
  // ========================================
  return await processFacilityScan(uid, facility);
};

/**
 * FLOW A: Normal Facility (GYM / COURT / SWIMMING / BADMINTON)
 * Uses facility_sessions table
 * NO equipment logic here
 */
async function processFacilityScan(uid, facility) {
  // 1️⃣ Resolve UID → student
  const rfidMapping = await prisma.rfidMapping.findFirst({
    where: {
      uid,
      status: "active"
    },
    include: {
      student: true
    }
  });

  // ❌ Unknown card
  if (!rfidMapping) {
    const result = {
      facility,
      action: "REJECTED",
      reason: "Unknown card",
      uid
    };

    emitScanEvent(result);
    return result;
  }

  const student = rfidMapping.student;

  // 2️⃣ Debounce check
  const lastScan = await prisma.facilitySession.findFirst({
    where: {
      student_id: student.student_id,
      facility_id: facility
    },
    orderBy: {
      entry_time: "desc"
    }
  });

  if (lastScan) {
    const diffSeconds =
      (Date.now() - new Date(lastScan.entry_time).getTime()) / 1000;

    if (diffSeconds < DEBOUNCE_SECONDS) {
      const result = {
        facility,
        action: "IGNORED",
        reason: "Double tap",
        student: {
          student_id: student.student_id,
          student_name: student.student_name
        }
      };

      emitScanEvent(result);
      return result;
    }
  }

  // 3️⃣ Active session in another facility (global single-facility rule)
  const activeSession = await prisma.facilitySession.findFirst({
    where: {
      student_id: student.student_id,
      exit_time: null
    }
  });

  if (activeSession && activeSession.facility_id !== facility) {
    const diffMinutes =
      (Date.now() - new Date(activeSession.entry_time).getTime()) / 60000;

    // Transition window check
    if (diffMinutes < TRANSITION_MINUTES) {
      const result = {
        facility,
        action: "IGNORED",
        reason: "Facility switch too soon",
        student: {
          student_id: student.student_id,
          student_name: student.student_name
        }
      };

      emitScanEvent(result);
      return result;
    }

    // IMPLICIT_EXIT from previous facility
    const durationMinutes = Math.floor(
      (Date.now() - new Date(activeSession.entry_time).getTime()) / 60000
    );

    await prisma.facilitySession.update({
      where: { session_id: activeSession.session_id },
      data: {
        exit_time: new Date(),
        exit_reason: "IMPLICIT_EXIT",
        duration_minutes: durationMinutes
      }
    });

    // Emit implicit exit event
    emitScanEvent({
      facility: activeSession.facility_id,
      action: "IMPLICIT_EXIT",
      student: {
        student_id: student.student_id,
        student_name: student.student_name
      },
      duration_minutes: durationMinutes
    });
  }

  // 4️⃣ Check for open session in THIS facility → EXIT
  const openSession = await prisma.facilitySession.findFirst({
    where: {
      student_id: student.student_id,
      facility_id: facility,
      exit_time: null
    }
  });

  if (openSession) {
    const durationMinutes = Math.floor(
      (Date.now() - new Date(openSession.entry_time).getTime()) / 60000
    );

    await prisma.facilitySession.update({
      where: { session_id: openSession.session_id },
      data: {
        exit_time: new Date(),
        exit_reason: "NORMAL_SCAN",
        duration_minutes: durationMinutes
      }
    });

    const result = {
      facility,
      action: "EXIT",
      student: {
        student_id: student.student_id,
        student_name: student.student_name
      },
      duration_minutes: durationMinutes
    };

    emitScanEvent(result);
    return result;
  }

  // 5️⃣ No open session → ENTRY
  await prisma.facilitySession.create({
    data: {
      uid,
      student_id: student.student_id,
      facility_id: facility,
      entry_time: new Date()
    }
  });

  const result = {
    facility,
    action: "ENTRY",
    student: {
      student_id: student.student_id,
      student_name: student.student_name
    }
  };

  // ❌ NO equipment fetching here - this is FACILITY flow
  emitScanEvent(result);
  return result;
}

/**
 * FLOW B: SPORTS_ROOM (Equipment Desk)
 * Uses equipment_issues table
 * NO facility_sessions here
 */
async function processSportsRoomScan(uid) {
  const result = await sportsRoomService.processSportsRoomScan(uid);

  // Add facility to result for frontend routing
  result.facility = "SPORTS_ROOM";

  emitScanEvent(result);
  return result;
}
