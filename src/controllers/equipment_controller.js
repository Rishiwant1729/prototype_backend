const equipmentService = require("../services/equipment_service");

// Issue equipment
exports.issueEquipment = async (req, res) => {
  try {
    const { uid, assistant_id, items } = req.body || {};

    if (!uid || !assistant_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "uid, assistant_id, and items are required"
      });
    }

    const result = await equipmentService.issueEquipment(
      uid,
      assistant_id,
      items
    );

    return res.json(result);
  } catch (err) {
    console.error("Issue equipment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Return equipment (partial or full)
exports.returnEquipment = async (req, res) => {
  try {
    const { issue_id, returns } = req.body || {};

    if (!issue_id || !Array.isArray(returns) || returns.length === 0) {
      return res.status(400).json({
        error: "issue_id and returns are required"
      });
    }

    const result = await equipmentService.returnEquipment(
      issue_id,
      returns
    );

    return res.json(result);
  } catch (err) {
    console.error("Return equipment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get pending equipment issues
exports.getPendingIssues = async (req, res) => {
  try {
    const result = await equipment_service.getPendingIssues();
    return res.json(result);
  } catch (err) {
    console.error("Get pending issues error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get student-wise equipment history
exports.getStudentHistory = async (req, res) => {
  try {
    const { student_id } = req.params;

    if (!student_id) {
      return res.status(400).json({
        error: "student_id is required"
      });
    }

    const result = await equipmentService.getStudentHistory(student_id);
    return res.json(result);
  } catch (err) {
    console.error("Student history error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
