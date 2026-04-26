const prisma = require("../src/db/prisma");

async function main() {
  // 1) Clear all sports-room equipment issues + items
  await prisma.equipmentIssueItem.deleteMany({});
  await prisma.equipmentIssue.deleteMany({});

  // 2) Restore SPORTS_ROOM inventory: available_quantity = total_quantity
  const rows = await prisma.facilityEquipment.findMany({
    where: { facility_id: "SPORTS_ROOM" }
  });

  for (const r of rows) {
    await prisma.facilityEquipment.update({
      where: {
        facility_id_equipment_id: {
          facility_id: r.facility_id,
          equipment_id: r.equipment_id
        }
      },
      data: { available_quantity: r.total_quantity }
    });
  }

  console.log("✅ Sports room reset complete: issues cleared, inventory restored.");
}

main()
  .catch((e) => {
    console.error("❌ Sports room reset failed:", e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

