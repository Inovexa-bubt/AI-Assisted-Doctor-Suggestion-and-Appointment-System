import type { Lang } from '@inovexa/shared'
import type { AppConfig } from '../config.ts'

export interface SttInput {
  /** Audio bytes kept in memory only; never persisted. */
  buffer: Buffer
  mimeType: string
  filename: string
  lang: Lang
}

export interface SttProvider {
  readonly name: string
  transcribe(input: SttInput): Promise<{ text: string }>
}

const SAMPLE_TRANSCRIPTS: Record<Lang, string> = {
  en: 'I have had a headache and dizziness for three days',
  bn: 'তিন দিন ধরে মাথাব্যথা আর মাথা ঘোরা',
}

async function transcribeOpenAi(cfg: AppConfig, input: SttInput): Promise<{ text: string }> {
  const form = new FormData()
  form.set('model', cfg.sttOpenaiModel)
  form.set('language', input.lang)
  form.set(
    'file',
    new Blob([new Uint8Array(input.buffer)], { type: input.mimeType || 'audio/webm' }),
    input.filename || 'speech.webm',
  )
  const res = await fetch(`${cfg.openaiBaseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.openaiApiKey}` },
    body: form,
  })
  if (!res.ok) {
    throw new Error(`OpenAI STT failed (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as { text?: string }
  return { text: (data.text ?? '').trim() }
}

async function transcribeGemini(cfg: AppConfig, input: SttInput): Promise<{ text: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`
  const langLabel = input.lang === 'bn' ? 'Bangla' : 'English'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Transcribe this patient voice recording accurately in ${langLabel}. Output ONLY the spoken text, nothing else.`,
            },
            {
              inlineData: {
                mimeType: input.mimeType || 'audio/webm',
                data: input.buffer.toString('base64'),
              },
            },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`Gemini STT failed (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return { text: (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim() }
}

export function createSttProvider(cfg: AppConfig): SttProvider {
  const useOpenAi = cfg.sttProvider === 'openai' && Boolean(cfg.openaiApiKey)
  const useGemini = cfg.sttProvider === 'gemini' && Boolean(cfg.geminiApiKey)
  const name = useOpenAi
    ? `openai:${cfg.sttOpenaiModel}`
    : useGemini
      ? `gemini:${cfg.geminiModel}`
      : 'mock'

  return {
    name,
    async transcribe(input: SttInput): Promise<{ text: string }> {
      if (useOpenAi) return transcribeOpenAi(cfg, input)
      if (useGemini) return transcribeGemini(cfg, input)
      return { text: SAMPLE_TRANSCRIPTS[input.lang] }
    },
  }
}
