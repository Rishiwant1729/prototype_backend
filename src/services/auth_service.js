require("dotenv").config();
const prisma = require("../db/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

function dbErrorPayload(err) {
  const msg = String(err?.message || "");
  const short =
    msg.includes("Authentication failed against database server") ||
    msg.includes("Invalid `prisma.") ||
    err?.name === "PrismaClientInitializationError"
      ? "Database connection failed. Check DATABASE_URL / MySQL credentials."
      : "Database unavailable.";
  return { action: "DB_ERROR", reason: short };
}

exports.signup = async (name, email, password) => {
  let existingAdmin;
  try {
    // Allow only ONE admin
    existingAdmin = await prisma.admin.findFirst();
  } catch (err) {
    return dbErrorPayload(err);
  }

  if (existingAdmin) {
    return {
      action: "REJECTED",
      reason: "Admin already exists"
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.admin.create({
      data: {
        name,
        email,
        password_hash: passwordHash
      }
    });
  } catch (err) {
    return dbErrorPayload(err);
  }

  return { action: "ADMIN_CREATED" };
};

exports.login = async (email, password) => {
  let admin;
  try {
    admin = await prisma.admin.findUnique({
      where: { email }
    });
  } catch (err) {
    return dbErrorPayload(err);
  }

  if (!admin) {
    return { action: "REJECTED", reason: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, admin.password_hash);

  if (!valid) {
    return { action: "REJECTED", reason: "Invalid credentials" };
  }

  const token = jwt.sign(
    {
      admin_id: admin.admin_id,
      name: admin.name,
      role: admin.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    action: "LOGIN_SUCCESS",
    token,
    role: admin.role,
    name: admin.name
  };
};
