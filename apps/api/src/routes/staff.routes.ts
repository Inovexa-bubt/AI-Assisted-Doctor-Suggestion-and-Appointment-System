
import { Router } from "express";

import {
  authenticateStaff,
  createStaffSession,
  destroyStaffSession,
  getStaffBySession,
  publicStaff
} from "../services/staff-auth.service.js";

import {
  requireStaff,
  StaffRequest
} from "../middleware/staff-auth.middleware.js";

const router = Router();

// 1. Staff login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Username and password are required."
      }
    });
  }

  const staff = authenticateStaff(username.trim(), password);

  if (!staff) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid username or password."
      }
    });
  }

  const sessionId = createStaffSession(staff.id);

  res.cookie("staff_sid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(200).json(publicStaff(staff));
});

// 2. Get logged-in staff profile
router.get("/me", (req, res) => {
  const sessionId = req.cookies?.staff_sid;

  if (!sessionId) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Staff login required."
      }
    });
  }

  const staff = getStaffBySession(sessionId);

  if (!staff) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid staff session."
      }
    });
  }

  return res.status(200).json(publicStaff(staff));
});

// 3. Staff logout
router.post("/logout", (req, res) => {
  const sessionId = req.cookies?.staff_sid;

  if (sessionId) {
    destroyStaffSession(sessionId);
  }

  res.clearCookie("staff_sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(204).send();
});

// 4. Admin-only protected endpoint
router.get(
  "/admin-test",
  requireStaff(["admin"]),
  (req: StaffRequest, res) => {
    return res.status(200).json({
      message: "Admin access granted.",
      staff: req.staff
    });
  }
);

// 5. Front Desk-only protected endpoint
router.get(
  "/frontdesk-test",
  requireStaff(["front_desk"]),
  (req: StaffRequest, res) => {
    return res.status(200).json({
      message: "Front Desk access granted.",
      staff: req.staff
    });
  }
);

// 6. Doctor-only protected endpoint
router.get(
  "/doctor-test",
  requireStaff(["doctor"]),
  (req: StaffRequest, res) => {
    return res.status(200).json({
      message: "Doctor access granted.",
      staff: req.staff
    });
  }
);

export default router;
