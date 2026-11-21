
import { Router } from "express";

import {
  getAllSettings,
  updateSetting
} from "../services/setting.service.js";

import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

// GET /api/v1/admin/settings
// Get all settings
router.get("/", requireStaff(["admin"]), (_req, res) => {
  return res.status(200).json(getAllSettings());
});

// PATCH /api/v1/admin/settings/:key
// Update a setting
router.patch("/:key", requireStaff(["admin"]), (req, res) => {
  const key = String(req.params.key);
  const { value } = req.body;

  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A valid setting value is required."
      }
    });
  }

  if (
    key === "online_booking_cutoff_minutes" ||
    key === "hold_duration_minutes"
  ) {
    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 1440) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "The setting must be a whole number between 1 and 1440."
        }
      });
    }
  }

  const setting = updateSetting(key, value.trim());

  if (!setting) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Setting not found."
      }
    });
  }

  return res.status(200).json({
    message: "Setting updated successfully.",
    setting
  });
});

export default router;
