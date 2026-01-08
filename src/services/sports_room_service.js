const prisma = require("../db/prisma");
const { v4: uuidv4 } = require("uuid");

const SPORTS_ROOM_FACILITY = "SPORTS_ROOM";

/**
 * Process a SPORTS_ROOM scan - determines ISSUE or RETURN mode
 * This is COMPLETELY SEPARATE from facility ENTRY/EXIT logic
 */
exports.processSportsRoomScan = async (uid) => {
  // Step 1: Resolve UID → student
  const rfidMapping = await prisma.rfidMapping.findFirst({
    where: {
      uid,
      status: "active"
    },
    include: {
      student: true
    }
  });

  // Unknown card
  if (!rfidMapping) {
    return {
      mode: "REJECTED",
      reason: "Unknown card",
      uid
    };
  }

  const student = rfidMapping.student;

  // Step 2: Check for pending equipment issues
  const pendingIssue = await prisma.equipmentIssue.findFirst({
    where: {
      student_id: student.student_id,
      status: {
        in: ["ISSUED", "PARTIAL_RETURN"]
      }
    },
    include: {
      items: true
    },
    orderBy: {
      issued_at: "desc"
    }
  });

  // CASE 1: Student HAS pending equipment → RETURN MODE
  if (pendingIssue) {
    const items = pendingIssue.items.map((item) => ({
      item_id: item.item_id,
      equipment_type: item.equipment_type,
      issued_qty: item.issued_qty,
      returned_qty: item.returned_qty || 0,
      pending_qty: item.issued_qty - (item.returned_qty || 0),
      status: item.status
    }));

    return {
      mode: "RETURN",
      student: {
        student_id: student.student_id,
        student_name: student.student_name
      },
      issue_id: pendingIssue.issue_id,
      issued_at: pendingIssue.issued_at,
      items
    };
  }

  // CASE 2: Student has NO pending equipment → ISSUE MODE
  const availableEquipment = await prisma.facilityEquipment.findMany({
    where: {
      facility_id: SPORTS_ROOM_FACILITY,
      available_quantity: { gt: 0 }
    },
    include: {
      equipment: true
    }
  });

  const equipmentList = availableEquipment.map((e) => ({
    equipment_id: e.equipment_id,
    equipment_name: e.equipment.name,
    equipment_type: e.equipment.category || e.equipment.name,
    available_quantity: e.available_quantity,
    total_quantity: e.total_quantity
  }));

  return {
    mode: "ISSUE",
    student: {
      student_id: student.student_id,
      student_name: student.student_name
    },
    available_equipment: equipmentList
  };
};

/**
 * Issue equipment to a student
 */
exports.issueEquipment = async (student_id, assistant_id, items) => {
  try {
    // First check if student has pending returns
    const pendingIssue = await prisma.equipmentIssue.findFirst({
      where: {
        student_id,
        status: {
          in: ["ISSUED", "PARTIAL_RETURN"]
        }
      }
    });

    if (pendingIssue) {
      return {
        mode: "BLOCKED",
        reason: "Pending returns exist. Student must return equipment first.",
        issue_id: pendingIssue.issue_id
      };
    }

    // Get student details
    const student = await prisma.student.findUnique({
      where: { student_id }
    });

    if (!student) {
      return {
        mode: "REJECTED",
        reason: "Student not found"
      };
    }

    // Get student's RFID
    const rfidMapping = await prisma.rfidMapping.findFirst({
      where: {
        student_id,
        status: "active"
      }
    });

    if (!rfidMapping) {
      return {
        mode: "REJECTED",
        reason: "No active RFID card for student"
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate inventory for all items
      for (const item of items) {
        // Ensure equipment_id is an integer
        const equipmentId = parseInt(item.equipment_id, 10);
        
        if (isNaN(equipmentId)) {
          throw new Error(`Invalid equipment_id: ${item.equipment_id}`);
        }

        const facilityEquip = await tx.facilityEquipment.findUnique({
          where: {
            facility_id_equipment_id: {
              facility_id: SPORTS_ROOM_FACILITY,
              equipment_id: equipmentId
            }
          },
          include: {
            equipment: true
          }
        });

        if (!facilityEquip) {
          throw new Error(`Equipment ID ${equipmentId} not available in Sports Room`);
        }

        if (facilityEquip.available_quantity < item.qty) {
          throw new Error(
            `Not enough ${facilityEquip.equipment.name}. Available: ${facilityEquip.available_quantity}, Requested: ${item.qty}`
          );
        }
      }

      // Create issue record
      const issue_id = uuidv4();

      await tx.equipmentIssue.create({
        data: {
          issue_id,
          uid: rfidMapping.uid,
          student_id: student.student_id,
          student_name: student.student_name,
          status: "ISSUED",
          issued_at: new Date(),
          assistant_id: String(assistant_id)
        }
      });

      // Create issue items and decrement stock
      const issuedItems = [];

      for (const item of items) {
        // Ensure equipment_id is an integer
        const equipmentId = parseInt(item.equipment_id, 10);

        const facilityEquip = await tx.facilityEquipment.findUnique({
          where: {
            facility_id_equipment_id: {
              facility_id: SPORTS_ROOM_FACILITY,
              equipment_id: equipmentId
            }
          },
          include: {
            equipment: true
          }
        });

        await tx.equipmentIssueItem.create({
          data: {
            item_id: uuidv4(),
            issue_id,
            equipment_type: facilityEquip.equipment.category || facilityEquip.equipment.name,
            issued_qty: item.qty,
            returned_qty: 0,
            status: "ISSUED"
          }
        });

        await tx.facilityEquipment.update({
          where: {
            facility_id_equipment_id: {
              facility_id: SPORTS_ROOM_FACILITY,
              equipment_id: equipmentId
            }
          },
          data: {
            available_quantity: {
              decrement: item.qty
            }
          }
        });

        issuedItems.push({
          equipment_id: equipmentId,
          equipment_name: facilityEquip.equipment.name,
          equipment_type: facilityEquip.equipment.category || facilityEquip.equipment.name,
          qty: item.qty
        });
      }

      return {
        mode: "SUCCESS",
        action: "ISSUED",
        issue_id,
        student: {
          student_id: student.student_id,
          student_name: student.student_name
        },
        items: issuedItems
      };
    });

    return result;
  } catch (err) {
    return {
      mode: "ERROR",
      reason: err.message
    };
  }
};

/**
 * Return equipment (supports partial returns)
 */
exports.returnEquipment = async (issue_id, assistant_id, returns) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the issue with items
      const issue = await tx.equipmentIssue.findUnique({
        where: { issue_id },
        include: { items: true }
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      if (issue.status === "RETURNED") {
        throw new Error("All equipment already returned");
      }

      let allReturned = true;
      const returnedItems = [];

      for (const ret of returns) {
        // Find by item_id first, then by equipment_type
        let issueItem;
        if (ret.item_id) {
          issueItem = await tx.equipmentIssueItem.findUnique({
            where: { item_id: ret.item_id }
          });
        } else {
          issueItem = await tx.equipmentIssueItem.findFirst({
            where: {
              issue_id,
              equipment_type: ret.equipment_type
            }
          });
        }

        if (!issueItem) {
          throw new Error(`Item ${ret.equipment_type || ret.item_id} not found in this issue`);
        }

        const currentReturned = issueItem.returned_qty || 0;
        const pendingQty = issueItem.issued_qty - currentReturned;

        // Validate return quantity
        if (ret.qty > pendingQty) {
          throw new Error(
            `Cannot return ${ret.qty} ${ret.equipment_type}. Only ${pendingQty} pending.`
          );
        }

        if (ret.qty < 0) {
          throw new Error("Return quantity cannot be negative");
        }

        if (ret.qty === 0) {
          continue; // Skip items with 0 return quantity
        }

        const newReturnedQty = currentReturned + ret.qty;
        const itemStatus = newReturnedQty === issueItem.issued_qty ? "RETURNED" : "PARTIAL_RETURN";

        await tx.equipmentIssueItem.update({
          where: { item_id: issueItem.item_id },
          data: {
            returned_qty: newReturnedQty,
            status: itemStatus
          }
        });

        // Increment stock back
        // Find the equipment by type/category
        const equipment = await tx.equipment.findFirst({
          where: {
            OR: [
              { category: issueItem.equipment_type },
              { name: issueItem.equipment_type }
            ]
          }
        });

        if (equipment) {
          await tx.facilityEquipment.update({
            where: {
              facility_id_equipment_id: {
                facility_id: SPORTS_ROOM_FACILITY,
                equipment_id: equipment.equipment_id
              }
            },
            data: {
              available_quantity: {
                increment: ret.qty
              }
            }
          });
        }

        if (newReturnedQty < issueItem.issued_qty) {
          allReturned = false;
        }

        returnedItems.push({
          equipment_type: ret.equipment_type,
          returned_qty: ret.qty,
          total_returned: newReturnedQty,
          issued_qty: issueItem.issued_qty,
          missing_qty: issueItem.issued_qty - newReturnedQty
        });
      }

      // Check if ALL items in the issue are fully returned
      const updatedItems = await tx.equipmentIssueItem.findMany({
        where: { issue_id }
      });

      const allItemsReturned = updatedItems.every(
        (item) => (item.returned_qty || 0) === item.issued_qty
      );

      const issueStatus = allItemsReturned ? "RETURNED" : "PARTIAL_RETURN";

      await tx.equipmentIssue.update({
        where: { issue_id },
        data: {
          status: issueStatus,
          returned_at: allItemsReturned ? new Date() : null
        }
      });

      return {
        mode: "SUCCESS",
        action: issueStatus,
        issue_id,
        items: returnedItems,
        fully_returned: allItemsReturned
      };
    });

    return result;
  } catch (err) {
    return {
      mode: "ERROR",
      reason: err.message
    };
  }
};

/**
 * Get missing equipment report
 */
exports.getMissingEquipment = async () => {
  const issues = await prisma.equipmentIssue.findMany({
    where: {
      status: {
        in: ["ISSUED", "PARTIAL_RETURN"]
      }
    },
    include: {
      items: true,
      student: true
    },
    orderBy: {
      issued_at: "asc"
    }
  });

  const missingItems = [];

  for (const issue of issues) {
    for (const item of issue.items) {
      const missing = item.issued_qty - (item.returned_qty || 0);
      if (missing > 0) {
        missingItems.push({
          student_id: issue.student_id,
          student_name: issue.student_name,
          issue_id: issue.issue_id,
          issued_at: issue.issued_at,
          equipment_type: item.equipment_type,
          issued_qty: item.issued_qty,
          returned_qty: item.returned_qty || 0,
          missing_qty: missing
        });
      }
    }
  }

  return missingItems;
};
