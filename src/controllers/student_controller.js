const studentService = require("../services/student_service");

exports.searchStudents = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: "Search query must be at least 2 characters"
      });
    }

    const result = await studentService.searchStudents(q.trim());
    return res.json(result);
  } catch (err) {
    console.error("Student search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
