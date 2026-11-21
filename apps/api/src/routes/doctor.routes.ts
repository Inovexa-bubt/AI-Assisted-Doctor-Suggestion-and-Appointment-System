
import { Router } from "express";

import {
  doctors,
  getActiveDoctors,
  findDoctor
} from "../services/doctor.service.js";

const router = Router();

// GET /api/v1/doctors
router.get("/", (req, res) => {
  const { specialtyId, q } = req.query;

  let result = getActiveDoctors();

  if (typeof specialtyId === "string" && specialtyId) {
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

  const response = result.map(doctor => ({
    id: doctor.id,
    name: {
      en: doctor.name_en,
      bn: doctor.name_bn
    },
    specialtyId: doctor.specialtyId,
    designation: {
      en: doctor.designation_en,
      bn: doctor.designation_bn
    },
    qualifications: doctor.qualifications,
    experienceYears: doctor.experienceYears,
    fee: doctor.fee,
    gender: doctor.gender,
    nextSlot: null
  }));

  return res.status(200).json(response);
});

// GET /api/v1/doctors/:id/availability
router.get("/:id/availability", (req, res) => {
  const doctor = findDoctor(String(req.params.id));

  if (!doctor || !doctor.active) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  const from = req.query.from;
  const days = Number(req.query.days || 14);

  if (
    typeof from !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 14
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Provide a valid from date and days between 1 and 14."
      }
    });
  }

  const startDate = new Date(`${from}T00:00:00.000Z`);

  if (
    Number.isNaN(startDate.getTime()) ||
    startDate.toISOString().slice(0, 10) !== from
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Invalid date."
      }
    });
  }

  const availability = [];

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(startDate.getUTCDate() + i);

    const date = currentDate.toISOString().slice(0, 10);
    const weekday = currentDate.getUTCDay();

    // Temporary sample schedule: Sunday, Tuesday, Thursday
    const hasSession = [0, 2, 4].includes(weekday);

    const slots = [];

    if (hasSession) {
      for (let hour = 17; hour < 19; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const start =
            `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

          const endMinute = minute + 15;
          const endHour = hour + Math.floor(endMinute / 60);

          const end =
            `${String(endHour).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;

          slots.push({
            start,
            end,
            serial: slots.length + 1,
            available: true
          });
        }
      }
    }

    availability.push({
      date,
      onLeave: false,
      sessions: hasSession
        ? [
            {
              start: "17:00",
              end: "19:00",
              closed: false,
              slots
            }
          ]
        : []
    });
  }

  return res.status(200).json(availability);
});

// GET /api/v1/doctors/:id
router.get("/:id", (req, res) => {
  const doctor = findDoctor(String(req.params.id));

  if (!doctor || !doctor.active) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  return res.status(200).json({
    id: doctor.id,
    name: {
      en: doctor.name_en,
      bn: doctor.name_bn
    },
    specialtyId: doctor.specialtyId,
    designation: {
      en: doctor.designation_en,
      bn: doctor.designation_bn
    },
    qualifications: doctor.qualifications,
    experienceYears: doctor.experienceYears,
    fee: doctor.fee,
    gender: doctor.gender,
    active: doctor.active
  });
});

export default router;
