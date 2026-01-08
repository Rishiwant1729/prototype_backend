const prisma = require("../db/prisma");
const { v4: uuidv4 } = require("uuid");

exports.getAvailableEquipment = async (facility) => {
  const equipment = await prisma.facilityEquipment.findMany({
    where: {
      facility_id: facility,
      available_quantity: { gt: 0 }
    },
    include: {
      equipment: true
    }
  });

  return equipment.map((e) => ({
    equipment_id: e.equipment_id,
    equipment_name: e.equipment.name,
    equipment_type: e.equipment.category,
    available_quantity: e.available_quantity
  }));
};

exports.issueEquipment = async (uid, facility, assistant_id, items) => {
  try {
    // Use Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Resolve UID → student
      const rfidMapping = await tx.rfidMapping.findFirst({
        where: {
          uid,
          status: "active"
        },
        include: {
          student: true
        }
      });

      if (!rfidMapping) {
        throw new Error("Unknown or inactive card");
      }

      const student = rfidMapping.student;

      // 2️⃣ Validate inventory
      for (const item of items) {
        const facilityEquip = await tx.facilityEquipment.findUnique({
          where: {
            facility_id_equipment_id: {
              facility_id: facility,
              equipment_id: item.equipment_id
            }
          }
        });

        if (!facilityEquip) {
          throw new Error("Equipment not available in this facility");
        }

        if (facilityEquip.available_quantity < item.qty) {
          throw new Error(
            `Not enough stock for equipment_id ${item.equipment_id}`
          );
        }
      }

      // 3️⃣ Create issue
      const issue_id = uuidv4();

      await tx.equipmentIssue.create({
        data: {
          issue_id,
          uid,
          student_id: student.student_id,
          student_name: student.student_name,
          status: "ISSUED",
          issued_at: new Date(),
          assistant_id: String(assistant_id)
        }
      });

      // 4️⃣ Insert items + decrement stock
      for (const item of items) {
        await tx.equipmentIssueItem.create({
          data: {
            item_id: uuidv4(),
            issue_id,
            equipment_type: item.equipment_type,
            issued_qty: item.qty,
            returned_qty: 0,
            status: "ISSUED"
          }
        });

        await tx.facilityEquipment.update({
          where: {
            facility_id_equipment_id: {
              facility_id: facility,
              equipment_id: item.equipment_id
            }
          },
          data: {
            available_quantity: {
              decrement: item.qty
            }
          }
        });
      }

      return {
        action: "ISSUED",
        issue_id,
        student: student.student_name,
        student_id: student.student_id
      };
    });

    return result;
  } catch (err) {
    return { action: "REJECTED", reason: err.message };
  }
};

exports.returnEquipment = async (issue_id, assistant_id, items) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the issue
      const issue = await tx.equipmentIssue.findUnique({
        where: { issue_id },
        include: { items: true }
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      let allReturned = true;

      for (const item of items) {
        const issueItem = await tx.equipmentIssueItem.findFirst({
          where: {
            issue_id,
            equipment_type: item.equipment_type
          }
        });

        if (!issueItem) {
          throw new Error(`Item ${item.equipment_type} not found in issue`);
        }

        const newReturnedQty = (issueItem.returned_qty || 0) + item.qty;

        if (newReturnedQty > issueItem.issued_qty) {
          throw new Error(`Cannot return more than issued for ${item.equipment_type}`);
        }

        const itemStatus = newReturnedQty === issueItem.issued_qty ? "RETURNED" : "PARTIAL_RETURN";

        await tx.equipmentIssueItem.update({
          where: { item_id: issueItem.item_id },
          data: {
            returned_qty: newReturnedQty,
            status: itemStatus
          }
        });

        if (newReturnedQty < issueItem.issued_qty) {
          allReturned = false;
        }
      }

      // Update issue status
      const issueStatus = allReturned ? "RETURNED" : "PARTIAL_RETURN";
      
      await tx.equipmentIssue.update({
        where: { issue_id },
        data: {
          status: issueStatus,
          returned_at: allReturned ? new Date() : null
        }
      });

      return {
        action: issueStatus,
        issue_id
      };
    });

    return result;
  } catch (err) {
    return { action: "REJECTED", reason: err.message };
  }
};

exports.getStudentHistory = async (student_id) => {
  const issues = await prisma.equipmentIssue.findMany({
    where: { student_id },
    include: {
      items: true
    },
    orderBy: {
      issued_at: "desc"
    }
  });

  return issues;
};
