
import { Router } from "express";

import {
  getAllSchedules,
  getDoctorSchedules,
  addSchedule,
  updateSchedule,
  deleteSchedule
} from "../services/schedule.service.js";

import { findDoctor } from "../services/doctor.service.js";
import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/;

// 1. GET /api/v1/admin/schedules
// Admin: Get all doctor schedules
router.get("/", requireStaff(["admin"]), (req, res) => {
  const doctorId = req.query.doctorId;

  const result =
    typeof doctorId === "string" && doctorId.trim()
      ? getDoctorSchedules(doctorId)
      : getAllSchedules();

  return res.status(200).json(result);
});

// 2. POST /api/v1/admin/schedules
// Admin: Add a schedule
router.post("/", requireStaff(["admin"]), (req, res) => {
  const {
    doctorId,
    weekday,
    start,
    end,
    slotMinutes,
    maxPatients,
    room
  } = req.body;

  if (
    typeof doctorId !== "string" ||
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    typeof start !== "string" ||
    typeof end !== "string" ||
    !validTime.test(start) ||
    !validTime.test(end) ||
    start >= end ||
    !Number.isInteger(slotMinutes) ||
    slotMinutes < 5 ||
    slotMinutes > 120 ||
    !Number.isInteger(maxPatients) ||
    maxPatients < 1 ||
    typeof room !== "string" ||
    !room.trim()
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Valid schedule information is required."
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

  const duration =
    (Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5))) -
    (Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)));

  if (duration % slotMinutes !== 0 || duration / slotMinutes < maxPatients) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Session duration must fit the configured patient slots."
      }
    });
  }

  const schedule = addSchedule({
    doctorId,
    weekday,
    start,
    end,
    slotMinutes,
    maxPatients,
    room: room.trim()
  });

  if (!schedule) {
    return res.status(409).json({
      error: {
        code: "SCHEDULE_EXISTS",
        message: "A schedule already exists for this doctor, day and start time."
      }
    });
  }

  return res.status(201).json({
    message: "Schedule created successfully.",
    schedule
  });
});

// 3. PATCH /api/v1/admin/schedules/:id
// Admin: Update a schedule
router.patch("/:id", requireStaff(["admin"]), (req, res) => {
  const {
    weekday,
    start,
    end,
    slotMinutes,
    maxPatients,
    room
  } = req.body;

  const updates: Record<string, string | number> = {};

  if (weekday !== undefined) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Weekday must be between 0 and 6."
        }
      });
    }
    updates.weekday = weekday;
  }

  if (start !== undefined) {
    if (typeof start !== "string" || !validTime.test(start)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid start time."
        }
      });
    }
    updates.start = start;
  }

  if (end !== undefined) {
    if (typeof end !== "string" || !validTime.test(end)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid end time."
        }
      });
    }
    updates.end = end;
  }

  if (slotMinutes !== undefined) {
    if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 120) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid slot duration."
        }
      });
    }
    updates.slotMinutes = slotMinutes;
  }

  if (maxPatients !== undefined) {
    if (!Number.isInteger(maxPatients) || maxPatients < 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Maximum patients must be at least 1."
        }
      });
    }
    updates.maxPatients = maxPatients;
  }

  if (room !== undefined) {
    if (typeof room !== "string" || !room.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Room is required."
        }
      });
    }
    updates.room = room.trim();
  }

  const id = String(req.params.id);

  const schedule = updateSchedule(id, updates);

  if (!schedule) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Schedule not found."
      }
    });
  }

  const finalStart = schedule.start;
  const finalEnd = schedule.end;

  const duration =
    (Number(finalEnd.slice(0, 2)) * 60 + Number(finalEnd.slice(3, 5))) -
    (Number(finalStart.slice(0, 2)) * 60 + Number(finalStart.slice(3, 5)));

  if (
    duration <= 0 ||
    duration % schedule.slotMinutes !== 0 ||
    duration / schedule.slotMinutes < schedule.maxPatients
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Updated session duration does not fit the configured slots."
      }
    });
  }

  return res.status(200).json({
    message: "Schedule updated successfully.",
    schedule
  });
});

// 4. DELETE /api/v1/admin/schedules/:id
// Admin: Delete a schedule
router.delete("/:id", requireStaff(["admin"]), (req, res) => {
  const deleted = deleteSchedule(String(req.params.id));

  if (!deleted) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Schedule not found."
      }
    });
  }

  return res.status(200).json({
    message: "Schedule deleted successfully."
  });
});

export default router;
