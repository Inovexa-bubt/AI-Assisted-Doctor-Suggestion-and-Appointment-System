// Keyword-based stand-in for the LLM, used by the Milestone 1 mock API and in tests. It follows
// the same flow as the real assistant: emergency check, up to three follow-up questions, then a
// specialty from the client's list, an urgency level, an explanation in the patient's language
// and a pre-visit summary for the doctor.

import { MAX_FOLLOW_UPS } from './constants.ts'
import { checkEmergency } from './emergency.ts'
import { toAsciiDigits } from './phone.ts'
import { SPECIALTY_BY_ID, SYMPTOMS, SYMPTOM_BY_ID } from './specialty-guide.ts'
import { findKeywords, normalizeText } from './text-match.ts'
import type { Lang, PreVisitSummary, Severity, TriageAnswer, Urgency } from './types.ts'

export type QuestionKind = 'detail' | 'duration' | 'severity'

export interface MockAnswer extends TriageAnswer {
  kind: QuestionKind
}

const SYMPTOM_ENTRIES = SYMPTOMS.flatMap((s) =>
  s.keywords.map((keyword) => ({ keyword, value: s.id })),
)

export interface SpecialtyScore {
  specialtyId: string
  score: number
  firstIndex: number
}

/** Symptoms found in the text and specialties ranked by how many of their symptoms matched. */
export function scoreSymptoms(text: string): { tags: string[]; ranked: SpecialtyScore[] } {
  const tags: string[] = []
  const scores = new Map<string, SpecialtyScore>()
  for (const m of findKeywords(text, SYMPTOM_ENTRIES)) {
    if (tags.includes(m.value)) continue
    tags.push(m.value)
    const symptom = SYMPTOM_BY_ID.get(m.value)!
    const entry = scores.get(symptom.specialtyId) ?? {
      specialtyId: symptom.specialtyId,
      score: 0,
      firstIndex: m.index,
    }
    entry.score += symptom.weight ?? 1
    scores.set(symptom.specialtyId, entry)
  }
  const ranked = [...scores.values()].sort(
    (a, b) => b.score - a.score || a.firstIndex - b.firstIndex,
  )
  return { tags, ranked }
}

const nfc = (s: string) => s.normalize('NFC')

const EN_COUNT = String.raw`\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a few|few|several|a couple of|couple of`
const DURATION_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b(?:${EN_COUNT})\s+(?:hour|day|week|month|year)s?\b`),
  /\b(?:since|from)\s+(?:yesterday|today|this morning|last night|last week|last month|morning)\b/,
  /\b(?:today|yesterday|this morning|last night)\b/,
  new RegExp(
    nfc(
      String.raw`(?:\d+|এক|দুই|দু|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ|কয়েক|কিছু|অনেক)\s*(?:ঘণ্টা|দিন|সপ্তাহ|মাস|বছর)`,
    ),
  ),
  new RegExp(nfc(String.raw`(?:আজ|গতকাল|কাল|সকাল|রাত)\s*থেকে`)),
  new RegExp(nfc('(?:আজ|গতকাল)')),
]

/** How long the problem has lasted, as written ("3 days", "কয়েক দিন"), or null. */
export function extractDuration(text: string): string | null {
  const t = toAsciiDigits(normalizeText(text))
  for (const re of DURATION_PATTERNS) {
    const m = re.exec(t)
    if (m) return m[0]
  }
  return null
}

const SEVERITY_PATTERNS: Array<[Severity, RegExp]> = [
  [
    'severe',
    /\b(?:severe|severely|very bad|unbearable|extreme|terrible|excruciating|very painful|worst)\b/,
  ],
  ['severe', new RegExp(nfc('(?:তীব্র|প্রচণ্ড|খুব বেশি|অনেক বেশি|অসহ্য|মারাত্মক)'))],
  ['moderate', /\b(?:moderate|moderately|medium|quite bad)\b/],
  ['moderate', new RegExp(nfc('মাঝারি'))],
  ['mild', /\b(?:mild|mildly|slight|slightly|a little|not too bad)\b/],
  ['mild', new RegExp(nfc('(?:হালকা|অল্প|সামান্য)'))],
]

export function extractSeverity(text: string): Severity | null {
  const t = normalizeText(text)
  for (const [severity, re] of SEVERITY_PATTERNS) if (re.test(t)) return severity
  return null
}

const QUESTIONS: Record<
  QuestionKind,
  Record<Lang, { question: string; quickReplies: string[] }>
> = {
  detail: {
    en: {
      question: 'Could you tell me a bit more? Where is the problem, and what else do you feel?',
      quickReplies: [],
    },
    bn: {
      question: 'আরেকটু বিস্তারিত বলবেন? সমস্যাটা কোথায়, আর কী কী অনুভব করছেন?',
      quickReplies: [],
    },
  },
  duration: {
    en: {
      question: 'How long have you had this problem?',
      quickReplies: ['Since today', 'A few days', '1–2 weeks', 'More than a month'],
    },
    bn: {
      question: 'কত দিন ধরে এই সমস্যা হচ্ছে?',
      quickReplies: ['আজ থেকে', 'কয়েক দিন', '১–২ সপ্তাহ', 'এক মাসের বেশি'],
    },
  },
  severity: {
    en: {
      question: 'How bad is it: mild, moderate or severe?',
      quickReplies: ['Mild', 'Moderate', 'Severe'],
    },
    bn: {
      question: 'সমস্যাটা কতটা তীব্র: হালকা, মাঝারি, না খুব বেশি?',
      quickReplies: ['হালকা', 'মাঝারি', 'খুব বেশি'],
    },
  },
}

export function followUpQuestion(kind: QuestionKind, lang: Lang) {
  return QUESTIONS[kind][lang]
}

/** Symptoms that make a moderate problem worth seeing within 48 hours. */
const URGENT_TAGS = new Set(['fever', 'vomiting', 'diarrhea', 'jaundice', 'injury', 'pregnancy'])

function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join('')
  const and = lang === 'bn' ? ' ও ' : ' and '
  return `${items.slice(0, -1).join(', ')}${and}${items.at(-1)}`
}

function labelsFor(tags: string[], lang: Lang, specialtyId?: string): string[] {
  return tags
    .map((t) => SYMPTOM_BY_ID.get(t)!)
    .filter((s) => s.id !== 'child' && (!specialtyId || s.specialtyId === specialtyId))
    .map((s) => s.label[lang])
}

function explain(specialtyId: string, tags: string[], matched: boolean, lang: Lang): string {
  const specialty = SPECIALTY_BY_ID.get(specialtyId)!.name[lang]
  if (!matched) {
    return lang === 'bn'
      ? 'আপনার বর্ণনা থেকে নির্দিষ্ট কোনো বিভাগ পরিষ্কার নয়, তাই মেডিসিন বিভাগের ডাক্তার দেখানো ভালো। প্রয়োজনে তিনি আপনাকে বিশেষজ্ঞের কাছে পাঠাবেন।'
      : 'Your description does not point clearly to one specialty, so a Medicine doctor is the best place to start. They can refer you to a specialist if needed.'
  }
  if (specialtyId === 'pediatrics' && tags.includes('child')) {
    const list = joinList(labelsFor(tags, lang), lang)
    return lang === 'bn'
      ? `আপনি একটি শিশুর ${list ? `${list}-এর` : 'স্বাস্থ্য সমস্যার'} কথা বলেছেন। শিশুদের চিকিৎসা ${specialty} বিভাগের ডাক্তাররা করেন, তাই সেখান থেকে শুরু করাই ভালো।`
      : `You described ${list || 'a health problem'} in a child. ${specialty} doctors treat children, so that is the right place to start.`
  }
  const list = joinList(labelsFor(tags, lang, specialtyId), lang)
  return lang === 'bn'
    ? `আপনি ${list}-এর কথা বলেছেন। এ ধরনের সমস্যা ${specialty} বিভাগের ডাক্তাররা দেখেন, তাই সেখান থেকে শুরু করাই ভালো।`
    : `You mentioned ${list}. ${specialty} doctors treat these problems, so that is the right place to start.`
}

export type MockTriageOutcome =
  | { status: 'emergency'; emergencyMatches: string[]; tags: string[] }
  | {
      status: 'needs_answer'
      kind: QuestionKind
      question: string
      quickReplies: string[]
      tags: string[]
    }
  | {
      status: 'complete'
      specialtyId: string
      urgency: Urgency
      explanation: string
      tags: string[]
      summary: PreVisitSummary
    }

export function runMockTriage(input: {
  problem: string
  lang: Lang
  answers: MockAnswer[]
}): MockTriageOutcome {
  const { problem, lang, answers } = input
  const text = [problem, ...answers.map((a) => a.answer)].join('\n')

  const emergencyMatches = checkEmergency(text)
  const { tags, ranked } = scoreSymptoms(text)
  if (emergencyMatches.length > 0) return { status: 'emergency', emergencyMatches, tags }

  const duration = extractDuration(text)
  const severity = extractSeverity(text)
  const asked = new Set(answers.map((a) => a.kind))
  const best = ranked[0]
  const unclear = !best || ranked[1]?.score === best.score

  if (answers.length < MAX_FOLLOW_UPS) {
    const kind: QuestionKind | null =
      unclear && !asked.has('detail')
        ? 'detail'
        : !duration && !asked.has('duration')
          ? 'duration'
          : !severity && !asked.has('severity')
            ? 'severity'
            : null
    if (kind) return { status: 'needs_answer', kind, ...QUESTIONS[kind][lang], tags }
  }

  const specialtyId = best?.specialtyId ?? 'medicine'
  const urgency: Urgency =
    severity === 'severe' || (severity === 'moderate' && tags.some((t) => URGENT_TAGS.has(t)))
      ? 'within_48h'
      : 'routine'
  const symptoms =
    (joinList(labelsFor(tags, 'en'), 'en') || 'Not clear from the description') +
    (tags.includes('child') ? ' (child patient)' : '')
  return {
    status: 'complete',
    specialtyId,
    urgency,
    explanation: explain(specialtyId, tags, !!best, lang),
    tags,
    summary: {
      symptoms,
      duration: duration ?? 'Not stated',
      severity: severity ?? 'unknown',
      note: [problem, ...answers.map((a) => a.answer)].join(' / '),
    },
  }
}
