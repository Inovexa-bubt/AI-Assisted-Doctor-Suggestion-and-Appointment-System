
import { Router } from "express";

import {
  getQueue,
  callNextPatient
} from "../services/queue.service.js";

import {
  requireStaff,
  StaffRequest
} from "../middleware/staff-auth.middleware.js";

const router = Router();

// GET /api/v1/queue?doctorId=d_03&date=YYYY-MM-DD
// View queue
router.get("/", requireStaff(), (req: StaffRequest, res) => {
  const requestedDoctorId = req.query.doctorId;
  const date = req.query.date;

  let doctorId: string | undefined;

  if (req.staff?.role === "doctor") {
    doctorId = req.staff.doctorId ?? undefined;
  } else if (typeof requestedDoctorId === "string") {
    doctorId = requestedDoctorId;
  }

  if (
    !doctorId ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A valid doctorId and date are required."
      }
    });
  }

  return res.status(200).json(getQueue(doctorId, date));
});

// POST /api/v1/queue/next
// Call the next arrived patient
router.post(
  "/next",
  requireStaff(["admin", "front_desk", "doctor"]),
  (req: StaffRequest, res) => {
    const requestedDoctorId = req.body.doctorId;
    const date = req.body.date;

    let doctorId: string | undefined;

    if (req.staff?.role === "doctor") {
      doctorId = req.staff.doctorId ?? undefined;
    } else if (typeof requestedDoctorId === "string") {
      doctorId = requestedDoctorId;
    }

    if (
      !doctorId ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
      new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "A valid doctorId and date are required."
        }
      });
    }

    const appointment = callNextPatient(doctorId, date);

    if (!appointment) {
      return res.status(404).json({
        error: {
          code: "NO_PATIENT_WAITING",
          message: "There are no arrived patients waiting."
        }
      });
    }

    return res.status(200).json({
      message: "Next patient called successfully.",
      appointment
    });
  }
);

export default router;
