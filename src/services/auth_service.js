require("dotenv").config();
const prisma = require("../db/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

exports.signup = async (name, email, password) => {
  // Allow only ONE admin
  const existingAdmin = await prisma.admin.findFirst();

  if (existingAdmin) {
    return {
      action: "REJECTED",
      reason: "Admin already exists"
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.create({
    data: {
      name,
      email,
      password_hash: passwordHash
    }
  });

  return { action: "ADMIN_CREATED" };
};

exports.login = async (email, password) => {
  const admin = await prisma.admin.findUnique({
    where: { email }
  });

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
