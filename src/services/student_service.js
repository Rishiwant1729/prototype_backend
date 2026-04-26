const prisma = require("../db/prisma");

exports.searchStudents = async (query) => {
  const q = String(query || "").trim();
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);

  const or = [
    { student_name: { contains: q } },
    { student_id: { contains: q } }
  ];

  // Make name searches resilient to spacing/case/collation quirks by matching tokens too.
  tokens.forEach((t) => {
    or.push({ student_name: { contains: t } });
  });

  const students = await prisma.student.findMany({
    where: {
      OR: or
    },
    orderBy: {
      student_name: "asc"
    },
    take: 20
  });

  return students.map((s) => ({
    student_id: s.student_id,
    student_name: s.student_name
  }));
};
