
import { Router } from "express";

import {
  getDailyAppointments,
  findFrontdeskAppointment,
  updateAppointmentStatus
} from "../services/frontdesk.service.js";

import { requireStaff, StaffRequest } from "../middleware/staff-auth.middleware.js";

const router = Router();

// GET /api/v1/doctor/day?date=YYYY-MM-DD
// Doctor views their own daily appointments
router.get("/day", requireStaff(["doctor"]), (req: StaffRequest, res) => {
  const doctorId = req.staff?.doctorId;
  const date = req.query.date;

  if (!doctorId) {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "This staff account is not linked to a doctor."
      }
    });
  }

  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A valid date is required."
      }
    });
  }

  const appointments = getDailyAppointments(doctorId, date);

  return res.status(200).json({
    doctorId,
    date,
    totalAppointments: appointments.length,
    appointments
  });
});

// PATCH /api/v1/doctor/appointments/:id/status
// Doctor updates their own appointment status
router.patch(
  "/appointments/:id/status",
  requireStaff(["doctor"]),
  (req: StaffRequest, res) => {
    const doctorId = req.staff?.doctorId;
    const id = String(req.params.id);
    const { status } = req.body;

    if (!doctorId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Doctor account is not linked."
        }
      });
    }

    const appointment = findFrontdeskAppointment(id);

    if (!appointment || appointment.doctorId !== doctorId) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Appointment not found."
        }
      });
    }

    const allowedTransitions: Record<string, string[]> = {
      arrived: ["in_consultation"],
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
      status as "in_consultation" | "seen"
    );

    return res.status(200).json({
      message: "Appointment status updated successfully.",
      appointment: updated
    });
  }
);

export default router;
