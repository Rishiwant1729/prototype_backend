const equipmentService = require("../services/equipment_service");

// Issue equipment
exports.issueEquipment = async (req, res) => {
  try {
    const { uid, facility, items } = req.body;

    if (!uid || !facility || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "uid, facility and items are required"
      });
    }

    const assistant_id = req.admin.admin_id; // 🔐 from JWT

    const result = await equipmentService.issueEquipment(
      uid,
      facility,
      assistant_id,
      items
    );

    res.json(result);
  } catch (err) {
    console.error("Issue equipment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Return equipment
exports.returnEquipment = async (req, res) => {
  try {
    const { issue_id, items } = req.body;

    if (!issue_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "issue_id and items are required"
      });
    }

    const assistant_id = req.admin.admin_id;

    const result = await equipmentService.returnEquipment(
      issue_id,
      assistant_id,
      items
    );

    res.json(result);
  } catch (err) {
    console.error("Return equipment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get student equipment history
exports.getStudentHistory = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!student_id) {
      return res.status(400).json({
        error: "student_id is required"
      });
    }

    const result = await equipmentService.getStudentHistory(student_id);

    res.json(result);
  } catch (err) {
    console.error("Get student history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
