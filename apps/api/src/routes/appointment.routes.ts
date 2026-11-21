
import { Router } from "express";
import { randomUUID } from "crypto";

import { doctors } from "../services/doctor.service.js";
import { sendSms } from "../services/sms.service.js";

const router = Router();

type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  start: string;
  end: string;
  status: "held" | "booked" | "cancelled";
  holdExpiresAt: string | null;
  createdAt: string;
};

const appointments = new Map<string, Appointment>();

const DEMO_PATIENT_ID = "demo_patient";
const DEMO_PATIENT_PHONE = process.env.DEMO_PATIENT_PHONE || "01712345678";
const HOLD_DURATION_MS = 5 * 60 * 1000;

function removeExpiredHolds() {
  const now = Date.now();

  for (const [id, appointment] of appointments.entries()) {
    if (
      appointment.status === "held" &&
      appointment.holdExpiresAt &&
      new Date(appointment.holdExpiresAt).getTime() <= now
    ) {
      appointments.delete(id);
    }
  }
}

function isValidSlot(date: string, start: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const dateObject = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(dateObject.getTime()) ||
    dateObject.toISOString().slice(0, 10) !== date
  ) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);

  if (date < today) {
    return false;
  }

  const weekday = dateObject.getUTCDay();

  if (![0, 2, 4].includes(weekday)) {
    return false;
  }

  if (!/^([0-1]\d):([0-5]\d)$/.test(start)) {
    return false;
  }

  const [hour, minute] = start.split(":").map(Number);

  return hour === 17 && minute >= 0 && minute <= 45 && minute % 15 === 0;
}

// POST /api/v1/appointments/holds
router.post("/holds", (req, res) => {
  removeExpiredHolds();

  const { doctorId, date, start } = req.body;

  if (
    typeof doctorId !== "string" ||
    typeof date !== "string" ||
    typeof start !== "string"
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Doctor, date and start time are required."
      }
    });
  }

  const doctor = doctors.find(
    item => item.id === doctorId && item.active
  );

  if (!doctor) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Doctor not found."
      }
    });
  }

  if (!isValidSlot(date, start)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Invalid appointment date or time slot."
      }
    });
  }

  const existingBooking = Array.from(appointments.values()).find(
    appointment =>
      appointment.patientId === DEMO_PATIENT_ID &&
      appointment.doctorId === doctorId &&
      appointment.date >= new Date().toISOString().slice(0, 10) &&
      appointment.status === "booked"
  );

  if (existingBooking) {
    return res.status(409).json({
      error: {
        code: "ALREADY_BOOKED",
        message: "You already have an upcoming appointment with this doctor."
      }
    });
  }

  const slotTaken = Array.from(appointments.values()).some(
    appointment =>
      appointment.doctorId === doctorId &&
      appointment.date === date &&
      appointment.start === start &&
      appointment.status !== "cancelled"
  );

  if (slotTaken) {
    return res.status(409).json({
      error: {
        code: "SLOT_TAKEN",
        message: "This appointment slot is already taken."
      }
    });
  }

  const [hour, minute] = start.split(":").map(Number);
  const totalMinutes = hour * 60 + minute + 15;

  const end = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;

  const now = Date.now();

  const appointment: Appointment = {
    id: randomUUID(),
    patientId: DEMO_PATIENT_ID,
    doctorId,
    date,
    start,
    end,
    status: "held",
    holdExpiresAt: new Date(now + HOLD_DURATION_MS).toISOString(),
    createdAt: new Date(now).toISOString()
  };

  appointments.set(appointment.id, appointment);

  return res.status(201).json({
    message: "Appointment slot held successfully.",
    appointment
  });
});

// GET /api/v1/appointments/:id
router.get("/:id", (req, res) => {
  removeExpiredHolds();

  const appointment = appointments.get(String(req.params.id));

  if (!appointment) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Appointment not found."
      }
    });
  }

  return res.status(200).json(appointment);
});

// POST /api/v1/appointments/:id/confirm
router.post("/:id/confirm", async (req, res) => {
  removeExpiredHolds();

  const appointment = appointments.get(String(req.params.id));

  if (!appointment) {
    return res.status(410).json({
      error: {
        code: "HOLD_EXPIRED",
        message: "Appointment hold has expired."
      }
    });
  }

  if (appointment.status !== "held") {
    return res.status(409).json({
      error: {
        code: "VALIDATION",
        message: "Appointment is not awaiting confirmation."
      }
    });
  }

  appointment.status = "booked";
  appointment.holdExpiresAt = null;

  const doctor = doctors.find(item => item.id === appointment.doctorId);

  try {
    await sendSms(
      DEMO_PATIENT_PHONE,
      `Your appointment at Lumina Specialized Hospital is confirmed. Doctor: ${doctor?.name_en ?? appointment.doctorId}. Date: ${appointment.date}. Time: ${appointment.start}.`,
      "appointment"
    );
  } catch (error) {
    console.error("Appointment confirmation SMS failed:", error);
  }

  return res.status(200).json({
    message: "Appointment confirmed successfully.",
    appointment
  });
});

// DELETE /api/v1/appointments/:id/hold
router.delete("/:id/hold", (req, res) => {
  const id = String(req.params.id);
  const appointment = appointments.get(id);

  if (!appointment || appointment.status !== "held") {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Active appointment hold not found."
      }
    });
  }

  appointments.delete(id);

  return res.status(204).send();
});

// GET /api/v1/appointments?scope=upcoming|past
router.get("/", (req, res) => {
  removeExpiredHolds();

  const scope = req.query.scope;

  if (scope !== "upcoming" && scope !== "past") {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Scope must be upcoming or past."
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = Array.from(appointments.values()).filter(appointment => {
    if (appointment.patientId !== DEMO_PATIENT_ID) {
      return false;
    }

    if (appointment.status === "cancelled") {
      return false;
    }

    return scope === "upcoming"
      ? appointment.date >= today
      : appointment.date < today;
  });

  return res.status(200).json(result);
});

// POST /api/v1/appointments/:id/cancel
router.post("/:id/cancel", async (req, res) => {
  const appointment = appointments.get(String(req.params.id));

  if (!appointment) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Appointment not found."
      }
    });
  }

  if (appointment.status !== "booked") {
    return res.status(409).json({
      error: {
        code: "VALIDATION",
        message: "Only booked appointments can be cancelled."
      }
    });
  }

  appointment.status = "cancelled";

  try {
    await sendSms(
      DEMO_PATIENT_PHONE,
      `Your appointment at Lumina Specialized Hospital on ${appointment.date} at ${appointment.start} has been cancelled.`,
      "cancellation"
    );
  } catch (error) {
    console.error("Appointment cancellation SMS failed:", error);
  }

  return res.status(200).json({
    message: "Appointment cancelled successfully.",
    appointment
  });
});

export default router;
