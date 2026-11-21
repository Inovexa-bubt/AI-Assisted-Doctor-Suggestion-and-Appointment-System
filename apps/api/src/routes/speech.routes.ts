
import { Router } from "express";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Unsupported audio format."));
    }
  }
});

// POST /api/v1/speech/transcribe
router.post("/transcribe", upload.single("audio"), (req, res) => {
  const file = req.file;
  const lang = req.body.lang;

  if (!file) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "An audio file is required."
      }
    });
  }

  if (lang !== "en" && lang !== "bn") {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Language must be en or bn."
      }
    });
  }

  // Audio is held in memory only and is not saved.
  // A transcription provider will be connected later.
  return res.status(501).json({
    error: {
      code: "TRANSCRIPTION_NOT_CONFIGURED",
      message: "Speech transcription provider is not configured yet."
    }
  });
});

export default router;
