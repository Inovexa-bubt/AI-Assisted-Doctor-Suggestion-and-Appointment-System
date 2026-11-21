
import { Router } from "express";

import {
  getAllLeaveDays,
  getDoctorLeaveDays,
  addLeave,
  deleteLeave
} from "../services/leave.service.js";

import { findDoctor } from "../services/doctor.service.js";
import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

const validDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date;
};

// GET /api/v1/admin/leave-days
// Get all leave days or filter by doctor
router.get("/", requireStaff(["admin"]), (req, res) => {
  const doctorId = req.query.doctorId;

  const leaves =
    typeof doctorId === "string" && doctorId.trim()
      ? getDoctorLeaveDays(doctorId)
      : getAllLeaveDays();

  return res.status(200).json(leaves);
});

// POST /api/v1/admin/leave-days
// Add a doctor's leave day
router.post("/", requireStaff(["admin"]), (req, res) => {
  const { doctorId, date, reason } = req.body;

  if (
    typeof doctorId !== "string" ||
    typeof date !== "string" ||
    !validDate(date) ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Doctor, valid date and leave reason are required."
      }
    });
  }

  const doctor = findDoctor(doctorId);

  if (!doctor || !doctor.active) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Active doctor not found."
      }
    });
  }

  const leave = addLeave({
    doctorId,
    date,
    reason: reason.trim()
  });

  if (!leave) {
    return res.status(409).json({
      error: {
        code: "LEAVE_EXISTS",
        message: "Leave is already registered for this doctor on this date."
      }
    });
  }

  return res.status(201).json({
    message: "Doctor leave added successfully.",
    leave
  });
});

// DELETE /api/v1/admin/leave-days/:id
// Delete a leave day
router.delete("/:id", requireStaff(["admin"]), (req, res) => {
  const deleted = deleteLeave(String(req.params.id));

  if (!deleted) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Leave record not found."
      }
    });
  }

  return res.status(200).json({
    message: "Doctor leave deleted successfully."
  });
});

export default router;
