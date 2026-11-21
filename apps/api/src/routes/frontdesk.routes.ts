
import { Router } from "express";

import {
  getDailyAppointments,
  findFrontdeskAppointment,
  updateAppointmentStatus
} from "../services/frontdesk.service.js";

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

// GET /api/v1/frontdesk/day
// View daily appointments
router.get("/day", requireStaff(["admin", "front_desk"]), (req, res) => {
  const doctorId = req.query.doctorId;
  const date = req.query.date;

  if (
    typeof doctorId !== "string" ||
    typeof date !== "string" ||
    !validDate(date)
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A valid doctorId and date are required."
      }
    });
  }

  const doctor = findDoctor(doctorId);

  if (!doctor) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  const appointments = getDailyAppointments(doctorId, date);

  return res.status(200).json({
    doctorId,
    doctorName: doctor.name_en,
    date,
    totalAppointments: appointments.length,
    appointments
  });
});

// PATCH /api/v1/frontdesk/appointments/:id/status
// Update appointment status
router.patch(
  "/appointments/:id/status",
  requireStaff(["admin", "front_desk"]),
  (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body;

    const appointment = findFrontdeskAppointment(id);

    if (!appointment) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Appointment not found."
        }
      });
    }

    const allowedTransitions: Record<string, string[]> = {
      booked: ["arrived", "cancelled", "no_show"],
      arrived: ["in_consultation", "no_show"],
      in_consultation: ["seen"]
    };

    if (
      typeof status !== "string" ||
      !allowedTransitions[appointment.status]?.includes(status)
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "This appointment status transition is not allowed."
        }
      });
    }

    const updated = updateAppointmentStatus(
      id,
      status as "arrived" | "in_consultation" | "seen" | "no_show" | "cancelled"
    );

    return res.status(200).json({
      message: "Appointment status updated successfully.",
      appointment: updated
    });
  }
);

export default router;
