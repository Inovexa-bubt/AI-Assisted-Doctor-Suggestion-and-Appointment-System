import type { Lang } from '@inovexa/shared'
import { Router } from 'express'
import multer from 'multer'
import { fail } from '../errors.ts'
import type { SttProvider } from '../providers/stt.ts'

export function createSpeechRoutes(stt: SttProvider) {
  const router = Router()

  // Audio is kept in memory only and immediately discarded after transcription (SOW privacy term).
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  })

  // POST /api/v1/speech/transcribe
  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const lang: Lang = req.body?.lang === 'bn' ? 'bn' : 'en'
    const file = req.file
    if (!file && stt.name !== 'mock') {
      fail('VALIDATION', 'Audio recording is required.')
    }
    const result = await stt.transcribe({
      buffer: file?.buffer ?? Buffer.alloc(0),
      mimeType: file?.mimetype ?? 'audio/webm',
      filename: file?.originalname ?? 'speech.webm',
      lang,
    })
    res.json(result)
  })

  return router
}
