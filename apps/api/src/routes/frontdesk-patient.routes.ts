
import { Router } from "express";

import {
  searchPatients,
  findPatient,
  findPatientByPhone,
  addPatient
} from "../services/patient.service.js";

import { requireStaff } from "../middleware/staff-auth.middleware.js";

const router = Router();

const normalizePhone = (phone: string): string => {
  let normalized = phone.replace(/[\s-]/g, "");

  if (normalized.startsWith("+880")) {
    normalized = "0" + normalized.slice(4);
  } else if (normalized.startsWith("880")) {
    normalized = "0" + normalized.slice(3);
  }

  return normalized;
};

const validPhone = (phone: string): boolean => {
  return /^01[3-9]\d{8}$/.test(phone);
};

// GET /api/v1/frontdesk/patients?q=...
// Search patients
router.get("/patients", requireStaff(["admin", "front_desk"]), (req, res) => {
  const query = req.query.q;

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "A patient name or phone number is required."
      }
    });
  }

  return res.status(200).json(searchPatients(query));
});

// GET /api/v1/frontdesk/patients/:id
// Get patient details
router.get("/patients/:id", requireStaff(["admin", "front_desk"]), (req, res) => {
  const patient = findPatient(String(req.params.id));

  if (!patient) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Patient not found."
      }
    });
  }

  return res.status(200).json(patient);
});

// POST /api/v1/frontdesk/patients
// Register a new patient
router.post("/patients", requireStaff(["admin", "front_desk"]), (req, res) => {
  const { name, phone, age, sex } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    typeof phone !== "string" ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > 120 ||
    !["male", "female", "other"].includes(sex)
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Valid name, phone, age and sex are required."
      }
    });
  }

  const normalizedPhone = normalizePhone(phone);

  if (!validPhone(normalizedPhone)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Enter a valid Bangladeshi mobile number."
      }
    });
  }

  if (findPatientByPhone(normalizedPhone)) {
    return res.status(409).json({
      error: {
        code: "PHONE_EXISTS",
        message: "A patient with this phone number already exists."
      }
    });
  }

  const patient = addPatient({
    name: name.trim(),
    phone: normalizedPhone,
    age,
    sex,
    registeredBy: "front_desk"
  });

  return res.status(201).json({
    message: "Patient registered successfully.",
    patient
  });
});

export default router;
