const sportsRoomService = require("../services/sports_room_service");
const { emitScanEvent } = require("../websocket/ws_emitter");

/**
 * Issue equipment to a student
 * POST /api/sports-room/issue
 */
exports.issueEquipment = async (req, res) => {
  try {
    const { student_id, items } = req.body;

    if (!student_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        mode: "ERROR",
        reason: "student_id and items array are required"
      });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.equipment_id || !item.qty || item.qty < 1) {
        return res.status(400).json({
          mode: "ERROR",
          reason: "Each item must have equipment_id and qty > 0"
        });
      }
    }

    const assistant_id = req.admin?.admin_id || "unknown";

    const result = await sportsRoomService.issueEquipment(
      student_id,
      assistant_id,
      items
    );

    // Emit WebSocket event for real-time update
    if (result.mode === "SUCCESS") {
      emitScanEvent({
        facility: "SPORTS_ROOM",
        action: "EQUIPMENT_ISSUED",
        ...result
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Issue equipment error:", err);
    res.status(500).json({
      mode: "ERROR",
      reason: err.message || "Internal server error"
    });
  }
};

/**
 * Return equipment
 * POST /api/sports-room/return
 */
exports.returnEquipment = async (req, res) => {
  try {
    const { issue_id, returns } = req.body;

    if (!issue_id || !Array.isArray(returns) || returns.length === 0) {
      return res.status(400).json({
        mode: "ERROR",
        reason: "issue_id and returns array are required"
      });
    }

    // Normalize and validate returns structure
    const normalizedReturns = returns.map(ret => ({
      item_id: ret.item_id,
      equipment_type: ret.equipment_type,
      qty: ret.qty ?? ret.return_qty ?? 0  // Accept both qty and return_qty
    }));

    for (const ret of normalizedReturns) {
      if (!ret.equipment_type || ret.qty === undefined || ret.qty < 0) {
        return res.status(400).json({
          mode: "ERROR",
          reason: "Each return must have equipment_type and qty >= 0"
        });
      }
    }

    const assistant_id = req.admin?.admin_id || "unknown";

    const result = await sportsRoomService.returnEquipment(
      issue_id,
      assistant_id,
      normalizedReturns
    );

    // Emit WebSocket event for real-time update
    if (result.mode === "SUCCESS") {
      emitScanEvent({
        facility: "SPORTS_ROOM",
        action: result.fully_returned ? "EQUIPMENT_RETURNED" : "EQUIPMENT_PARTIAL_RETURN",
        ...result
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Return equipment error:", err);
    res.status(500).json({
      mode: "ERROR",
      reason: err.message || "Internal server error"
    });
  }
};

/**
 * Get missing equipment report
 * GET /api/sports-room/missing
 */
exports.getMissingEquipment = async (req, res) => {
  try {
    const missingItems = await sportsRoomService.getMissingEquipment();

    res.json({
      mode: "SUCCESS",
      items: missingItems,
      total_missing_items: missingItems.length
    });
  } catch (err) {
    console.error("Get missing equipment error:", err);
    res.status(500).json({
      mode: "ERROR",
      reason: "Internal server error"
    });
  }
};

/**
 * Get available equipment in Sports Room
 * GET /api/sports-room/equipment
 */
exports.getAvailableEquipment = async (req, res) => {
  try {
    const prisma = require("../db/prisma");
    
    const equipment = await prisma.facilityEquipment.findMany({
      where: {
        facility_id: "SPORTS_ROOM"
      },
      include: {
        equipment: true
      }
    });

    const list = equipment.map((e) => ({
      equipment_id: e.equipment_id,
      equipment_name: e.equipment.name,
      equipment_type: e.equipment.category || e.equipment.name,
      available_quantity: e.available_quantity,
      total_quantity: e.total_quantity
    }));

    res.json({
      mode: "SUCCESS",
      equipment: list
    });
  } catch (err) {
    console.error("Get equipment error:", err);
    res.status(500).json({
      mode: "ERROR",
      reason: "Internal server error"
    });
  }
};
