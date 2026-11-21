
import { Router } from "express";

import {
  getDashboardAnalytics,
  getAppointmentAnalytics,
  getDoctorAnalytics,
  getPatientAnalytics
} from "../services/analytics.service.js";

import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

// GET /api/v1/admin/analytics
// Complete dashboard analytics
router.get("/", requireStaff(["admin"]), (req, res) => {
  const date = req.query.date;

  if (date !== undefined) {
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
      new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "A valid date is required."
        }
      });
    }
  }

  return res.status(200).json(getDashboardAnalytics(date as string | undefined));
});

// GET /api/v1/admin/analytics/appointments
router.get("/appointments", requireStaff(["admin"]), (req, res) => {
  const date = req.query.date;

  if (date !== undefined && typeof date !== "string") {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Invalid date."
      }
    });
  }

  return res.status(200).json(
    getAppointmentAnalytics(date as string | undefined)
  );
});

// GET /api/v1/admin/analytics/doctors
router.get("/doctors", requireStaff(["admin"]), (_req, res) => {
  return res.status(200).json(getDoctorAnalytics());
});

// GET /api/v1/admin/analytics/patients
router.get("/patients", requireStaff(["admin"]), (_req, res) => {
  return res.status(200).json(getPatientAnalytics());
});

export default router;
