const prisma = require("../db/prisma");

exports.searchStudents = async (query) => {
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { student_name: { contains: query } },
        { student_id: { contains: query } }
      ]
    },
    orderBy: {
      student_name: "asc"
    },
    take: 10
  });

  return students.map((s) => ({
    student_id: s.student_id,
    student_name: s.student_name
  }));
};
