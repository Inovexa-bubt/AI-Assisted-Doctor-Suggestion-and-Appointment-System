
import { Router } from "express";

import {
  getActiveSpecialties,
  getAllSpecialties,
  addSpecialty,
  updateSpecialty,
  deactivateSpecialty
} from "../services/specialty.service.js";

import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

// 1. Public: Get active specialties
router.get("/", (_req, res) => {
  const result = getActiveSpecialties().map(
    ({ sortOrder, active, ...specialty }) => specialty
  );

  return res.status(200).json(result);
});

// 2. Admin: Get all specialties (including inactive)
router.get("/admin/all", requireStaff(["admin"]), (_req, res) => {
  return res.status(200).json(getAllSpecialties());
});

// 3. Admin: Add a new specialty
router.post("/", requireStaff(["admin"]), (req, res) => {
  const {
    id,
    name_en,
    name_bn,
    description_en,
    description_bn,
    sortOrder
  } = req.body;

  if (
    typeof id !== "string" ||
    typeof name_en !== "string" ||
    typeof name_bn !== "string" ||
    typeof description_en !== "string" ||
    typeof description_bn !== "string" ||
    !id.trim() ||
    !name_en.trim() ||
    !name_bn.trim() ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 1
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Valid specialty information is required."
      }
    });
  }

  const specialty = addSpecialty({
    id: id.trim().toLowerCase(),
    name_en: name_en.trim(),
    name_bn: name_bn.trim(),
    description_en: description_en.trim(),
    description_bn: description_bn.trim(),
    sortOrder
  });

  if (!specialty) {
    return res.status(409).json({
      error: {
        code: "SPECIALTY_EXISTS",
        message: "A specialty with this ID already exists."
      }
    });
  }

  return res.status(201).json(specialty);
});

// 4. Admin: Update a specialty
router.patch("/:id", requireStaff(["admin"]), (req, res) => {
  const {
    name_en,
    name_bn,
    description_en,
    description_bn,
    sortOrder,
    active
  } = req.body;

  const updates: Record<string, string | number | boolean> = {};

  if (name_en !== undefined) {
    if (typeof name_en !== "string" || !name_en.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid English name."
        }
      });
    }
    updates.name_en = name_en.trim();
  }

  if (name_bn !== undefined) {
    if (typeof name_bn !== "string" || !name_bn.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid Bangla name."
        }
      });
    }
    updates.name_bn = name_bn.trim();
  }

  if (description_en !== undefined) {
    if (typeof description_en !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid English description."
        }
      });
    }
    updates.description_en = description_en.trim();
  }

  if (description_bn !== undefined) {
    if (typeof description_bn !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid Bangla description."
        }
      });
    }
    updates.description_bn = description_bn.trim();
  }

  if (sortOrder !== undefined) {
    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid sort order."
        }
      });
    }
    updates.sortOrder = sortOrder;
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

  const specialtyId = String(req.params.id);

  const specialty = updateSpecialty(
    specialtyId,
    updates
  );

  if (!specialty) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Specialty not found."
      }
    });
  }

  return res.status(200).json(specialty);
});

// 5. Admin: Deactivate a specialty
router.delete("/:id", requireStaff(["admin"]), (req, res) => {
  const specialtyId = String(req.params.id);
  const specialty = deactivateSpecialty(specialtyId);

  if (!specialty) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Specialty not found."
      }
    });
  }

  return res.status(200).json({
    message: "Specialty deactivated successfully.",
    specialty
  });
});

export default router;
