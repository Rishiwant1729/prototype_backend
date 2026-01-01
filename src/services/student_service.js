const db = require("../db");

exports.searchStudents = async (query) => {
  const likeQuery = `%${query}%`;

  const [students] = await db.execute(
    `SELECT student_id, student_name
     FROM students
     WHERE student_name LIKE ?
        OR student_id LIKE ?
     ORDER BY student_name
     LIMIT 10`,
    [likeQuery, likeQuery]
  );

  return students;
};
