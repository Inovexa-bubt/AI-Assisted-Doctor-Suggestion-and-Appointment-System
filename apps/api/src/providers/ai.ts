import {
  type Lang,
  type MockAnswer,
  type PreVisitSummary,
  type QuestionKind,
  type Severity,
  type Specialty,
  type Urgency,
  MAX_FOLLOW_UPS,
  SYMPTOMS,
  checkEmergency,
  runMockTriage,
  scoreSymptoms,
} from '@inovexa/shared'
import type { AppConfig } from '../config.ts'

export interface TriageTurn {
  question: string
  answer: string
  kind?: QuestionKind
}

export interface AiTriageInput {
  problem: string
  lang: Lang
  answers: TriageTurn[]
  specialties: Specialty[]
}

export type AiTriageOutcome =
  | { status: 'emergency'; emergencyMatches: string[]; tags: string[] }
  | {
      status: 'needs_answer'
      question: string
      quickReplies: string[]
      kind?: QuestionKind
      tags: string[]
    }
  | {
      status: 'complete'
      specialtyId: string
      urgency: Exclude<Urgency, 'emergency'>
      explanation: string
      tags: string[]
      summary: PreVisitSummary
    }

export interface AiTriageProvider {
  readonly name: string
  evaluate(input: AiTriageInput): Promise<AiTriageOutcome>
}

interface RawLlmResponse {
  action?: 'ask' | 'suggest' | 'emergency'
  question?: string
  quickReplies?: string[]
  specialtyId?: string
  urgency?: Urgency
  explanation?: string
  tags?: string[]
  summary?: {
    symptoms?: string
    duration?: string
    severity?: string
  }
}

const VALID_SYMPTOM_IDS = new Set(SYMPTOMS.map((s) => s.id))
const VALID_SEVERITIES = new Set<Severity | 'unknown'>(['mild', 'moderate', 'severe', 'unknown'])

function buildSystemPrompt(specialties: Specialty[], lang: Lang, canAskMore: boolean): string {
  const specList = specialties
    .map((s) => `- ${s.id}: ${s.name.en} (${s.name.bn}) — ${s.description.en}`)
    .join('\n')
  const langName = lang === 'bn' ? 'Bangla (বাংলা)' : 'English'
  return [
    'You are the appointment triage assistant for Lumina Specialized Hospital in Dhaka, Bangladesh.',
    'You ONLY suggest which medical specialty to see. You NEVER diagnose, prescribe, or give treatment advice.',
    'You MUST pick specialtyId strictly from this hospital list:',
    specList,
    '',
    `Respond strictly in valid JSON (no markdown fences). Write question, quickReplies, and explanation in ${langName}.`,
    canAskMore
      ? 'If the specialty, duration, or severity is still unclear, you may ask ONE short follow-up question using action="ask".'
      : 'You have reached the follow-up limit. You MUST return action="suggest" now.',
    'If the patient describes a life-threatening emergency (chest pain, breathing difficulty, heavy bleeding, stroke signs, unconsciousness, seizure, poisoning, suicidal crisis), return action="emergency".',
    '',
    'JSON schema:',
    '{',
    '  "action": "ask" | "suggest" | "emergency",',
    '  "question": "string (when action=ask)",',
    '  "quickReplies": ["up to 4 short options (when action=ask)"],',
    '  "specialtyId": "one id from the list (when action=suggest)",',
    '  "urgency": "routine" | "within_48h" (when action=suggest),',
    '  "explanation": "1-2 clear sentences explaining why this specialty fits (when action=suggest)",',
    '  "tags": ["optional symptom ids"],',
    '  "summary": { "symptoms": "short English summary", "duration": "duration or Not stated", "severity": "mild"|"moderate"|"severe"|"unknown" }',
    '}',
  ].join('\n')
}

function buildUserPrompt(problem: string, answers: TriageTurn[]): string {
  // Privacy: ONLY problem text and follow-up Q&A are sent. Never name, phone, or patient ID.
  const lines = [`Patient problem: ${problem}`]
  for (const a of answers) {
    lines.push(`Assistant asked: ${a.question}`)
    lines.push(`Patient answered: ${a.answer}`)
  }
  return lines.join('\n')
}

function extractJson(text: string): RawLlmResponse {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('LLM did not return JSON')
  return JSON.parse(cleaned.slice(start, end + 1)) as RawLlmResponse
}

function normalizeLlmOutcome(
  raw: RawLlmResponse,
  input: AiTriageInput,
  fallbackTags: string[],
): AiTriageOutcome {
  const validSpecIds = new Set(input.specialties.map((s) => s.id))
  const canAskMore = input.answers.length < MAX_FOLLOW_UPS
  const tags = Array.from(
    new Set([
      ...fallbackTags,
      ...(Array.isArray(raw.tags) ? raw.tags.filter((t) => VALID_SYMPTOM_IDS.has(t)) : []),
    ]),
  )

  if (raw.action === 'emergency' || raw.urgency === 'emergency') {
    return { status: 'emergency', emergencyMatches: [], tags }
  }

  if (
    raw.action === 'ask' &&
    canAskMore &&
    typeof raw.question === 'string' &&
    raw.question.trim()
  ) {
    return {
      status: 'needs_answer',
      question: raw.question.trim(),
      quickReplies: Array.isArray(raw.quickReplies)
        ? raw.quickReplies.filter((r) => typeof r === 'string' && r.trim()).slice(0, 4)
        : [],
      tags,
    }
  }

  const specialtyId =
    raw.specialtyId && validSpecIds.has(raw.specialtyId)
      ? raw.specialtyId
      : validSpecIds.has('medicine')
        ? 'medicine'
        : (input.specialties[0]?.id ?? 'medicine')

  const urgency: Exclude<Urgency, 'emergency'> =
    raw.urgency === 'within_48h' ? 'within_48h' : 'routine'

  const rawSeverity = String(raw.summary?.severity ?? 'unknown').toLowerCase()
  const severity: Severity | 'unknown' = VALID_SEVERITIES.has(rawSeverity as Severity | 'unknown')
    ? (rawSeverity as Severity | 'unknown')
    : 'unknown'

  const note = [input.problem, ...input.answers.map((a) => a.answer)].join(' / ')
  const spec = input.specialties.find((s) => s.id === specialtyId)
  const fallbackExplanation =
    input.lang === 'bn'
      ? `আপনার সমস্যার জন্য ${spec?.name.bn ?? 'মেডিসিন'} বিভাগের ডাক্তার দেখানো ভালো।`
      : `A ${spec?.name.en ?? 'Medicine'} doctor is the best place to start for this problem.`

  return {
    status: 'complete',
    specialtyId,
    urgency,
    explanation:
      typeof raw.explanation === 'string' && raw.explanation.trim()
        ? raw.explanation.trim()
        : fallbackExplanation,
    tags,
    summary: {
      symptoms:
        typeof raw.summary?.symptoms === 'string' && raw.summary.symptoms.trim()
          ? raw.summary.symptoms.trim()
          : input.problem.slice(0, 120),
      duration:
        typeof raw.summary?.duration === 'string' && raw.summary.duration.trim()
          ? raw.summary.duration.trim()
          : 'Not stated',
      severity,
      note,
    },
  }
}

function runMock(input: AiTriageInput): AiTriageOutcome {
  const mockAnswers: MockAnswer[] = input.answers.map((a) => ({
    question: a.question,
    answer: a.answer,
    kind: a.kind ?? 'detail',
  }))
  const outcome = runMockTriage({
    problem: input.problem,
    lang: input.lang,
    answers: mockAnswers,
  })
  if (outcome.status === 'complete') {
    const validIds = new Set(input.specialties.map((s) => s.id))
    const specialtyId = validIds.has(outcome.specialtyId)
      ? outcome.specialtyId
      : validIds.has('medicine')
        ? 'medicine'
        : (input.specialties[0]?.id ?? 'medicine')
    return {
      ...outcome,
      specialtyId,
      urgency: outcome.urgency === 'within_48h' ? 'within_48h' : 'routine',
    }
  }
  return outcome
}

async function callGemini(
  cfg: AppConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<RawLlmResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`Gemini API failed (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return extractJson(text)
}

async function callOpenAi(
  cfg: AppConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<RawLlmResponse> {
  const res = await fetch(`${cfg.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: cfg.openaiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI API failed (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  return extractJson(text)
}

export function createAiProvider(cfg: AppConfig): AiTriageProvider {
  const useGemini = cfg.aiProvider === 'gemini' && Boolean(cfg.geminiApiKey)
  const useOpenAi = cfg.aiProvider === 'openai' && Boolean(cfg.openaiApiKey)
  const name = useGemini
    ? `gemini:${cfg.geminiModel}`
    : useOpenAi
      ? `openai:${cfg.openaiModel}`
      : 'mock'

  return {
    name,
    async evaluate(input: AiTriageInput): Promise<AiTriageOutcome> {
      // SOW safety guardrail: fixed emergency keyword check ALWAYS runs BEFORE any AI call.
      const combined = [input.problem, ...input.answers.map((a) => a.answer)].join('\n')
      const emergencyMatches = checkEmergency(combined)
      const { tags } = scoreSymptoms(combined)
      if (emergencyMatches.length > 0) {
        return { status: 'emergency', emergencyMatches, tags }
      }

      if (!useGemini && !useOpenAi) {
        return runMock(input)
      }

      const systemPrompt = buildSystemPrompt(
        input.specialties,
        input.lang,
        input.answers.length < MAX_FOLLOW_UPS,
      )
      const userPrompt = buildUserPrompt(input.problem, input.answers)

      try {
        const raw = useGemini
          ? await callGemini(cfg, systemPrompt, userPrompt)
          : await callOpenAi(cfg, systemPrompt, userPrompt)
        return normalizeLlmOutcome(raw, input, tags)
      } catch (err) {
        // Safe degradation: if external LLM fails transiently, fall back to deterministic triage.
        console.error(`[ai] ${name} error, falling back to mock triage:`, err)
        return runMock(input)
      }
    },
  }
}
