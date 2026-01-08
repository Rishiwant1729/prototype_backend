require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;


exports.authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization header missing"
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Invalid authorization format"
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // attach admin info to request
    req.admin = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const userRole = req.admin.role || "MANAGEMENT"; // Default for legacy tokens

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Access denied",
        message: `This action requires one of these roles: ${allowedRoles.join(", ")}`
      });
    }

    next();
  };
};

/**
 * Role constants for convenience
 */
exports.ROLES = {
  MANAGEMENT: "MANAGEMENT",
  OPERATOR: "OPERATOR",
  GUARD: "GUARD",
  AUDITOR: "AUDITOR"
};
