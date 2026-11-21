
import { sendSms } from "../services/sms.service.js";
import { Router, Request } from "express";
import { randomUUID } from "crypto";

const router = Router();

type Patient = {
  id: string;
  phone: string;
  name: string | null;
  age: number | null;
  sex: string | null;
  phoneVerifiedAt: string;
};

type OTPRecord = {
  code: string;
  expiresAt: number;
};

const patients = new Map<string, Patient>();
const otpRecords = new Map<string, OTPRecord>();
const sessions = new Map<string, string>();

// Development OTP: 123456
const DEVELOPMENT_OTP = "123456";

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s-]/g, "");

  if (normalized.startsWith("+880")) {
    normalized = "0" + normalized.slice(4);
  } else if (normalized.startsWith("880")) {
    normalized = "0" + normalized.slice(3);
  }

  return normalized;
}

function getPatient(req: Request): Patient | undefined {
  const sessionId = req.cookies?.sid;

  if (!sessionId) return undefined;

  const phone = sessions.get(sessionId);

  if (!phone) return undefined;

  return patients.get(phone);
}

// 1. Request OTP
router.post("/otp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (typeof phone !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "A valid phone number is required."
        }
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION",
          message: "Invalid Bangladeshi phone number."
        }
      });
    }

    otpRecords.set(normalizedPhone, {
      code: DEVELOPMENT_OTP,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    await sendSms(
      normalizedPhone,
      `Your Innovexa verification code is ${DEVELOPMENT_OTP}. It expires in 5 minutes.`,
      "otp"
    );

    console.log(
      `Development OTP for ${normalizedPhone}: ${DEVELOPMENT_OTP}`
    );

    return res.status(200).json({
      expiresInSeconds: 300
    });
  } catch (error) {
    console.error("OTP sending error:", error);

    return res.status(500).json({
      error: {
        code: "SMS_FAILED",
        message: "Unable to process OTP request."
      }
    });
  }
});

// 2. Verify OTP
router.post("/verify", (req, res) => {
  const { phone, code } = req.body;

  if (typeof phone !== "string" || typeof code !== "string") {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Phone number and OTP are required."
      }
    });
  }

  const normalizedPhone = normalizePhone(phone);
  const otpRecord = otpRecords.get(normalizedPhone);

  if (!otpRecord || otpRecord.expiresAt < Date.now()) {
    return res.status(422).json({
      error: {
        code: "OTP_EXPIRED",
        message: "OTP has expired. Please request a new one."
      }
    });
  }

  if (otpRecord.code !== code) {
    return res.status(422).json({
      error: {
        code: "OTP_INVALID",
        message: "Incorrect OTP."
      }
    });
  }

  otpRecords.delete(normalizedPhone);

  let patient = patients.get(normalizedPhone);
  const needsProfile = !patient;

  if (!patient) {
    patient = {
      id: randomUUID(),
      phone: normalizedPhone,
      name: null,
      age: null,
      sex: null,
      phoneVerifiedAt: new Date().toISOString()
    };

    patients.set(normalizedPhone, patient);
  }

  const sessionId = randomUUID();

  sessions.set(sessionId, normalizedPhone);

  res.cookie("sid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(200).json({
    patient,
    needsProfile
  });
});

// 3. Complete patient profile
router.post("/profile", (req, res) => {
  const patient = getPatient(req);

  if (!patient) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Please verify your phone number first."
      }
    });
  }

  if (patient.name !== null) {
    return res.status(409).json({
      error: {
        code: "ALREADY_REGISTERED",
        message: "Patient profile already exists."
      }
    });
  }

  const { name, age, sex } = req.body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120 ||
    !["male", "female", "other"].includes(sex)
  ) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Please provide a valid name, age and sex."
      }
    });
  }

  patient.name = name.trim();
  patient.age = age;
  patient.sex = sex;

  return res.status(200).json(patient);
});

// 4. Get logged-in patient
router.get("/me", (req, res) => {
  const patient = getPatient(req);

  if (!patient) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Please log in first."
      }
    });
  }

  return res.status(200).json(patient);
});

// 5. Logout
router.post("/logout", (req, res) => {
  const sessionId = req.cookies?.sid;

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.clearCookie("sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.status(204).send();
});

export default router;
