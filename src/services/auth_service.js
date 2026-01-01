require("dotenv").config();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
// move to .env later

exports.signup = async (name, email, password) => {
  // Allow only ONE admin
  const [existing] = await db.execute(
    `SELECT admin_id FROM admins`
  );

  if (existing.length > 0) {
    return {
      action: "REJECTED",
      reason: "Admin already exists"
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.execute(
    `INSERT INTO admins (name, email, password_hash)
     VALUES (?, ?, ?)`,
    [name, email, passwordHash]
  );

  return { action: "ADMIN_CREATED" };
};

exports.login = async (email, password) => {
  const [admins] = await db.execute(
    `SELECT admin_id, name, password_hash
     FROM admins
     WHERE email = ?`,
    [email]
  );

  if (admins.length === 0) {
    return { action: "REJECTED", reason: "Invalid credentials" };
  }

  const admin = admins[0];
  const valid = await bcrypt.compare(password, admin.password_hash);

  if (!valid) {
    return { action: "REJECTED", reason: "Invalid credentials" };
  }

  const token = jwt.sign(
  {
    admin_id: admin.admin_id,
    name: admin.name
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);


  return {
    action: "LOGIN_SUCCESS",
    token
  };
};
