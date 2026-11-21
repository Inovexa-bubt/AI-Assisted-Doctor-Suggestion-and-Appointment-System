
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { doctors } from "../services/doctor.service.js";

const router = Router();

type TriageSession = {
  id: string;
  lang: "en" | "bn";
  problem: string;
  answers: {
    question: string;
    answer: string;
  }[];
  status: "needs_answer" | "complete" | "emergency";
  specialtyId?: string;
  urgency?: string;
  explanation?: string;
  tags: string[];
  question?: string;
  quickReplies?: string[];
};

// Temporary in-memory storage.
// Later, sessions will be stored in PostgreSQL.
const sessions = new Map<string, TriageSession>();

const specialties = [
  "cardiology",
  "neurology",
  "gastroenterology",
  "dermatology",
  "orthopedics"
];

// Basic emergency phrase detection
const emergencyPhrases = [
  "chest pain",
  "difficulty breathing",
  "cannot breathe",
  "unconscious",
  "severe bleeding",
  "stroke",
  "heart attack",
  "অজ্ঞান",
  "শ্বাস নিতে কষ্ট",
  "বুকে তীব্র ব্যথা"
];

// Basic symptom-to-specialty mapping.
// This is a demonstration rule engine, NOT an AI diagnosis.
function suggestSpecialty(problem: string): string {
  const text = problem.toLowerCase();

  if (
    text.includes("heart") ||
    text.includes("chest") ||
    text.includes("blood pressure") ||
    text.includes("হৃদ") ||
    text.includes("বুক")
  ) {
    return "cardiology";
  }

  if (
    text.includes("headache") ||
    text.includes("migraine") ||
    text.includes("seizure") ||
    text.includes("brain") ||
    text.includes("মাথা")
  ) {
    return "neurology";
  }

  if (
    text.includes("stomach") ||
    text.includes("gastric") ||
    text.includes("digestion") ||
    text.includes("পেট")
  ) {
    return "gastroenterology";
  }

  if (
    text.includes("skin") ||
    text.includes("rash") ||
    text.includes("acne") ||
    text.includes("ত্বক")
  ) {
    return "dermatology";
  }

  if (
    text.includes("bone") ||
    text.includes("joint") ||
    text.includes("knee") ||
    text.includes("হাড়")
  ) {
    return "orthopedics";
  }

  return "general_medicine";
}

// POST /api/v1/triage
// Create a new triage session.
router.post("/", (req, res) => {
  const { problem, lang } = req.body;

  if (
    typeof problem !== "string" ||
    problem.trim().length < 3 ||
    !["en", "bn"].includes(lang)
  ) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Provide a valid problem and language (en or bn)."
      }
    });
    return;
  }

  const emergencyMatches = emergencyPhrases.filter((phrase) =>
    problem.toLowerCase().includes(phrase.toLowerCase())
  );

  const session: TriageSession = {
    id: randomUUID(),
    lang,
    problem: problem.trim(),
    answers: [],
    status: "needs_answer",
    tags: []
  };

  // Emergency response
  if (emergencyMatches.length > 0) {
    session.status = "emergency";

    sessions.set(session.id, session);

    res.status(201).json({
      session: {
        ...session,
        emergencyMatches
      },
      suggestions: []
    });
    return;
  }

  // Generate follow-up question
  session.question =
    lang === "bn"
      ? "আপনার সমস্যাটি কতদিন ধরে হচ্ছে?"
      : "How long have you been experiencing this problem?";

  session.quickReplies =
    lang === "bn"
      ? ["১ দিনের কম", "১-৭ দিন", "১-৪ সপ্তাহ", "১ মাসের বেশি"]
      : ["Less than a day", "1-7 days", "1-4 weeks", "More than a month"];

  sessions.set(session.id, session);

  res.status(201).json({
    session,
    suggestions: []
  });
});

// POST /api/v1/triage/:id/answers
// Submit an answer and receive doctor suggestions.
router.post("/:id/answers", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Triage session not found."
      }
    });
    return;
  }

  const { answer } = req.body;

  if (typeof answer !== "string" || !answer.trim()) {
    res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Please provide an answer."
      }
    });
    return;
  }

  if (session.status !== "needs_answer") {
    res.status(409).json({
      error: {
        code: "VALIDATION",
        message: "This triage session is already complete."
      }
    });
    return;
  }

  // Save patient's answer
  session.answers.push({
    question: session.question || "",
    answer: answer.trim()
  });

  // Identify possible specialty
  const specialtyId = suggestSpecialty(session.problem);

  session.status = "complete";

  session.specialtyId = specialties.includes(specialtyId)
    ? specialtyId
    : undefined;

  session.urgency = "routine";

  session.explanation = session.specialtyId
    ? `Based on the symptoms described, ${session.specialtyId} may be an appropriate specialty to consult.`
    : "We could not confidently select a specialty. Please consult a general physician.";

  session.tags = session.specialtyId
    ? [session.specialtyId]
    : [];

  // Find doctors belonging to the suggested specialty
  const suggestions = doctors
    .filter(
      (doctor) =>
        doctor.active &&
        doctor.specialtyId === session.specialtyId
    )
    .map((doctor) => ({
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

  res.status(200).json({
    session,
    suggestions
  });
});

export default router;
