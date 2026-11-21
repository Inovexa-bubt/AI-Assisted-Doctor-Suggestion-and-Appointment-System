
import { Router } from "express";
import { randomUUID } from "crypto";

import {
  getAllDoctors,
  findDoctor,
  addDoctor,
  updateDoctor,
  deactivateDoctor
} from "../services/doctor.service.js";

import { findSpecialty } from "../services/specialty.service.js";
import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

const validGenders = ["male", "female", "other"];

// 1. GET /api/v1/admin/doctors
// Admin: View all doctors, including inactive doctors
router.get("/", requireStaff(["admin"]), (req, res) => {
  let result = getAllDoctors();

  const specialtyId = req.query.specialtyId;
  const q = req.query.q;

  if (typeof specialtyId === "string" && specialtyId.trim()) {
    result = result.filter(
      doctor => doctor.specialtyId === specialtyId
    );
  }

  if (typeof q === "string" && q.trim()) {
    const search = q.trim().toLowerCase();

    result = result.filter(
      doctor =>
        doctor.name_en.toLowerCase().includes(search) ||
        doctor.name_bn.includes(q.trim()) ||
        doctor.designation_en.toLowerCase().includes(search)
    );
  }

  return res.status(200).json(result);
});

// 2. POST /api/v1/admin/doctors
// Admin: Add a new doctor
router.post("/", requireStaff(["admin"]), (req, res) => {
  const {
    name_en,
    name_bn,
    specialtyId,
    designation_en,
    designation_bn,
    qualifications,
    experienceYears,
    fee,
    gender
  } = req.body;

  if (
    typeof name_en !== "string" ||
    typeof name_bn !== "string" ||
    typeof specialtyId !== "string" ||
    typeof designation_en !== "string" ||
    typeof designation_bn !== "string" ||
    typeof qualifications !== "string" ||
    !name_en.trim() ||
    !name_bn.trim() ||
    !designation_en.trim() ||
    !designation_bn.trim() ||
    !qualifications.trim() ||
    !Number.isInteger(experienceYears) ||
    experienceYears < 0 ||
    typeof fee !== "number" ||
    !Number.isFinite(fee) ||
    fee < 0 ||
    !validGenders.includes(gender)
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Valid doctor information is required."
      }
    });
  }

  const specialty = findSpecialty(specialtyId);

  if (!specialty || !specialty.active) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A valid active specialty is required."
      }
    });
  }

  const doctor = addDoctor({
    id: `d_${randomUUID()}`,
    name_en: name_en.trim(),
    name_bn: name_bn.trim(),
    specialtyId,
    designation_en: designation_en.trim(),
    designation_bn: designation_bn.trim(),
    qualifications: qualifications.trim(),
    experienceYears,
    fee,
    gender
  });

  if (!doctor) {
    return res.status(409).json({
      error: {
        code: "DOCTOR_EXISTS",
        message: "Doctor could not be added."
      }
    });
  }

  return res.status(201).json({
    message: "Doctor added successfully.",
    doctor
  });
});

// 3. GET /api/v1/admin/doctors/:id
// Admin: View a doctor's complete information
router.get("/:id", requireStaff(["admin"]), (req, res) => {
  const doctor = findDoctor(String(req.params.id));

  if (!doctor) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  return res.status(200).json(doctor);
});

// 4. PATCH /api/v1/admin/doctors/:id
// Admin: Update doctor information
router.patch("/:id", requireStaff(["admin"]), (req, res) => {
  const {
    name_en,
    name_bn,
    specialtyId,
    designation_en,
    designation_bn,
    qualifications,
    experienceYears,
    fee,
    gender,
    active
  } = req.body;

  const updates: Record<string, string | number | boolean> = {};

  const stringFields = [
    "name_en",
    "name_bn",
    "designation_en",
    "designation_bn",
    "qualifications"
  ] as const;

  for (const field of stringFields) {
    const value = req.body[field];

    if (value !== undefined) {
      if (typeof value !== "string" || !value.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: `Invalid ${field}.`
          }
        });
      }

      updates[field] = value.trim();
    }
  }

  if (specialtyId !== undefined) {
    if (typeof specialtyId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid specialty ID."
        }
      });
    }

    const specialty = findSpecialty(specialtyId);

    if (!specialty || !specialty.active) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "A valid active specialty is required."
        }
      });
    }

    updates.specialtyId = specialtyId;
  }

  if (experienceYears !== undefined) {
    if (!Number.isInteger(experienceYears) || experienceYears < 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Experience years must be a non-negative integer."
        }
      });
    }

    updates.experienceYears = experienceYears;
  }

  if (fee !== undefined) {
    if (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Fee must be a non-negative number."
        }
      });
    }

    updates.fee = fee;
  }

  if (gender !== undefined) {
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid gender."
        }
      });
    }

    updates.gender = gender;
  }

  if (active !== undefined) {
    if (typeof active !== "boolean") {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Active must be true or false."
        }
      });
    }

    updates.active = active;
  }

  const doctor = updateDoctor(String(req.params.id), updates);

  if (!doctor) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  return res.status(200).json({
    message: "Doctor updated successfully.",
    doctor
  });
});

// 5. DELETE /api/v1/admin/doctors/:id
// Admin: Deactivate a doctor
router.delete("/:id", requireStaff(["admin"]), (req, res) => {
  const doctor = deactivateDoctor(String(req.params.id));

  if (!doctor) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  return res.status(200).json({
    message: "Doctor deactivated successfully.",
    doctor
  });
});

export default router;
