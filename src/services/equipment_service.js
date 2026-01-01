const db = require("../db");
const { v4: uuidv4 } = require("uuid");

// Issue equipment to a student
exports.issueEquipment = async (uid, assistant_id, items) => {
  // 1️⃣ Resolve UID → student
  const [students] = await db.execute(
    `SELECT s.student_id, s.student_name
     FROM rfid_mapping r
     JOIN students s ON r.student_id = s.student_id
     WHERE r.uid = ? AND r.status = 'active'`,
    [uid]
  );

  if (students.length === 0) {
    return {
      action: "REJECTED",
      reason: "Unknown or inactive card"
    };
  }

  const student = students[0];

  // 2️⃣ Validate items
  for (const item of items) {
    if (
      !item.equipment_type ||
      typeof item.qty !== "number" ||
      item.qty <= 0
    ) {
      return {
        action: "REJECTED",
        reason: "Invalid equipment item or quantity"
      };
    }
  }

  // 3️⃣ Create equipment issue (parent)
  const issue_id = uuidv4();

  await db.execute(
    `INSERT INTO equipment_issues
     (issue_id, uid, student_id, student_name, status, issued_at, assistant_id)
     VALUES (?, ?, ?, ?, 'ISSUED', NOW(), ?)`,
    [
      issue_id,
      uid,
      student.student_id,
      student.student_name,
      assistant_id
    ]
  );

  // 4️⃣ Create equipment issue items (children)
  for (const item of items) {
    const item_id = uuidv4();

    await db.execute(
      `INSERT INTO equipment_issue_items
       (item_id, issue_id, equipment_type, issued_qty, returned_qty, status)
       VALUES (?, ?, ?, ?, 0, 'ISSUED')`,
      [
        item_id,
        issue_id,
        item.equipment_type,
        item.qty
      ]
    );
  }

  // 5️⃣ Return success response
  return {
    action: "ISSUED",
    issue_id,
    student: student.student_name,
    student_id: student.student_id,
    items
  };
};

exports.returnEquipment = async (issue_id, returns) => {
  // 1️⃣ Fetch issue
  const [issues] = await db.execute(
    `SELECT issue_id, status
     FROM equipment_issues
     WHERE issue_id = ?`,
    [issue_id]
  );

  if (issues.length === 0) {
    return {
      action: "REJECTED",
      reason: "Invalid issue_id"
    };
  }

  if (issues[0].status === "RETURNED") {
    return {
      action: "REJECTED",
      reason: "Issue already closed"
    };
  }

  // 2️⃣ Process each returned item
  for (const ret of returns) {
    if (
      !ret.equipment_type ||
      typeof ret.qty !== "number" ||
      ret.qty <= 0
    ) {
      return {
        action: "REJECTED",
        reason: "Invalid return item or quantity"
      };
    }

    // Fetch issued item
    const [items] = await db.execute(
      `SELECT item_id, issued_qty, returned_qty
       FROM equipment_issue_items
       WHERE issue_id = ?
         AND equipment_type = ?`,
      [issue_id, ret.equipment_type]
    );

    if (items.length === 0) {
      return {
        action: "REJECTED",
        reason: `Item not found: ${ret.equipment_type}`
      };
    }

    const item = items[0];
    const newReturnedQty = item.returned_qty + ret.qty;

    // ❌ Cannot return more than issued
    if (newReturnedQty > item.issued_qty) {
      return {
        action: "REJECTED",
        reason: `Return exceeds issued quantity for ${ret.equipment_type}`
      };
    }

    // Determine item status
    const newStatus =
      newReturnedQty === item.issued_qty
        ? "RETURNED"
        : "PARTIAL_RETURN";

    // Update item
    await db.execute(
      `UPDATE equipment_issue_items
       SET returned_qty = ?,
           status = ?
       WHERE item_id = ?`,
      [newReturnedQty, newStatus, item.item_id]
    );
  }

  // 3️⃣ Recalculate issue status
  const [pendingItems] = await db.execute(
    `SELECT COUNT(*) AS pending
     FROM equipment_issue_items
     WHERE issue_id = ?
       AND status != 'RETURNED'`,
    [issue_id]
  );

  if (pendingItems[0].pending === 0) {
    // All items returned
    await db.execute(
      `UPDATE equipment_issues
       SET status = 'RETURNED',
           returned_at = NOW()
       WHERE issue_id = ?`,
      [issue_id]
    );

    return {
      action: "RETURNED",
      issue_id
    };
  } else {
    // Partial return
    await db.execute(
      `UPDATE equipment_issues
       SET status = 'PARTIAL_RETURN'
       WHERE issue_id = ?`,
      [issue_id]
    );

    return {
      action: "PARTIAL_RETURN",
      issue_id
    };
  }
};


exports.getStudentHistory = async (student_id) => {
  // 1️⃣ Validate student
  const [students] = await db.execute(
    `SELECT student_id, student_name
     FROM students
     WHERE student_id = ?`,
    [student_id]
  );

  if (students.length === 0) {
    return {
      action: "REJECTED",
      reason: "Student not found"
    };
  }

  const student = students[0];

  // 2️⃣ Fetch all equipment issues for student
  const [issues] = await db.execute(
    `SELECT issue_id, status, issued_at, returned_at, assistant_id
     FROM equipment_issues
     WHERE student_id = ?
     ORDER BY issued_at DESC`,
    [student_id]
  );

  const pending = [];
  const returned = [];

  // 3️⃣ For each issue, fetch items and classify
  for (const issue of issues) {
    const [items] = await db.execute(
      `SELECT equipment_type, issued_qty, returned_qty
       FROM equipment_issue_items
       WHERE issue_id = ?`,
      [issue.issue_id]
    );

    const formattedItems = items.map(item => ({
      equipment_type: item.equipment_type,
      issued_qty: item.issued_qty,
      returned_qty: item.returned_qty,
      missing: item.issued_qty - item.returned_qty
    }));

    const issueData = {
      issue_id: issue.issue_id,
      issued_at: issue.issued_at,
      returned_at: issue.returned_at,
      assistant_id: issue.assistant_id,
      items: formattedItems
    };

    if (issue.status === "RETURNED") {
      returned.push(issueData);
    } else {
      pending.push(issueData);
    }
  }

  // 4️⃣ Final response
  return {
    student_id: student.student_id,
    student_name: student.student_name,
    pending,
    returned
  };
};
