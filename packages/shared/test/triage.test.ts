import { describe, expect, it } from 'vitest'
import {
  type MockAnswer,
  MAX_FOLLOW_UPS,
  SAMPLE_PROBLEMS,
  SPECIALTIES,
  SYMPTOMS,
  checkEmergency,
  extractDuration,
  extractSeverity,
  followUpQuestion,
  runMockTriage,
  scoreSymptoms,
} from '../src/index.ts'

describe('checkEmergency', () => {
  it.each([
    'I have chest pain since morning',
    'CHEST PAIN',
    "My father can't breathe properly",
    'My father can’t breathe properly',
    'heavy bleeding after delivery',
    'she fainted twice today',
    'হঠাৎ বুকে ব্যথা শুরু হয়েছে',
    'শ্বাস নিতে কষ্ট হচ্ছে',
    'বাবা অজ্ঞান হয়ে গেছেন',
    'buke betha korche',
  ])('flags "%s"', (text) => {
    expect(checkEmergency(text).length).toBeGreaterThan(0)
  })

  it('still flags a negated phrase, on purpose', () => {
    expect(checkEmergency('no chest pain, only a cough')).toEqual(['chest pain'])
  })

  it.each([
    'I have a cough and a runny nose',
    'মাথাব্যথা আর জ্বর',
    'I was diagnosed with diabetes last year',
    'বুক ধড়ফড় করে',
    'heartburn after meals',
  ])('does not flag "%s"', (text) => {
    expect(checkEmergency(text)).toEqual([])
  })
})

describe('specialty guide', () => {
  it('only uses specialties that exist', () => {
    const ids = new Set(SPECIALTIES.map((s) => s.id))
    for (const symptom of SYMPTOMS) expect(ids.has(symptom.specialtyId), symptom.id).toBe(true)
    for (const id of Object.keys(SAMPLE_PROBLEMS)) expect(ids.has(id), id).toBe(true)
  })

  it('matches English keywords as whole words', () => {
    expect(scoreSymptoms('I was diagnosed with diabetes').tags).toEqual(['diabetes'])
    expect(scoreSymptoms('I hear ringing').tags).toEqual([])
    expect(scoreSymptoms('vomiting since morning').tags).toEqual(['vomiting'])
  })

  it('prefers the longest overlapping keyword', () => {
    expect(scoreSymptoms('heartburn after meals').tags).toEqual(['acidity'])
  })

  it('does not treat the Bangla particle নাকি as a nose problem', () => {
    expect(scoreSymptoms('জ্বর নাকি ঠান্ডা বুঝতে পারছি না').tags).toEqual(['fever'])
  })
})

describe('extractors', () => {
  it.each([
    ['for three days', 'three days'],
    ['since yesterday', 'since yesterday'],
    ['A few days', 'a few days'],
    ['1–2 weeks', '2 weeks'],
    ['More than a month', 'a month'],
    ['তিন দিন ধরে জ্বর', 'তিন দিন'],
    ['২ সপ্তাহ', '2 সপ্তাহ'],
    ['কয়েক দিন', 'কয়েক দিন'],
    ['এক মাসের বেশি', 'এক মাস'],
    ['আজ থেকে', 'আজ থেকে'],
  ])('finds the duration in "%s"', (text, expected) => {
    expect(extractDuration(text)?.normalize('NFC')).toBe(expected.normalize('NFC'))
  })

  it('finds severity in either language', () => {
    expect(extractSeverity('Severe')).toBe('severe')
    expect(extractSeverity('খুব বেশি')).toBe('severe')
    expect(extractSeverity('মাঝারি')).toBe('moderate')
    expect(extractSeverity('it is mild')).toBe('mild')
    expect(extractSeverity('no idea')).toBeNull()
  })

  it('understands every quick reply it offers', () => {
    for (const lang of ['en', 'bn'] as const) {
      for (const reply of followUpQuestion('duration', lang).quickReplies) {
        expect(extractDuration(reply), reply).not.toBeNull()
      }
      for (const reply of followUpQuestion('severity', lang).quickReplies) {
        expect(extractSeverity(reply), reply).not.toBeNull()
      }
    }
  })
})

/** Answers each follow-up with the given replies until the conversation finishes. */
function converse(problem: string, lang: 'en' | 'bn', replies: string[]) {
  const answers: MockAnswer[] = []
  const questions: string[] = []
  for (;;) {
    const outcome = runMockTriage({ problem, lang, answers })
    if (outcome.status !== 'needs_answer') return { outcome, questions }
    questions.push(outcome.kind)
    answers.push({ kind: outcome.kind, question: outcome.question, answer: replies.shift() ?? '' })
  }
}

describe('runMockTriage', () => {
  it('sends every sample problem to its specialty without an emergency', () => {
    for (const [specialtyId, problems] of Object.entries(SAMPLE_PROBLEMS)) {
      for (const [lang, problem] of problems) {
        const { outcome } = converse(problem, lang, ['A few days', 'Moderate'])
        expect(outcome.status, problem).toBe('complete')
        if (outcome.status === 'complete') expect(outcome.specialtyId, problem).toBe(specialtyId)
      }
    }
  })

  it('stops at the emergency check, even in a follow-up answer', () => {
    const first = runMockTriage({ problem: 'chest pain and sweating', lang: 'en', answers: [] })
    expect(first).toMatchObject({ status: 'emergency', emergencyMatches: ['chest pain'] })
    const later = runMockTriage({
      problem: 'I feel unwell',
      lang: 'en',
      answers: [{ kind: 'detail', question: 'More?', answer: 'now I cannot breathe' }],
    })
    expect(later.status).toBe('emergency')
  })

  it('asks for duration and severity it cannot find, then finishes', () => {
    const { outcome, questions } = converse('Stomach pain after meals', 'en', [
      'A few days',
      'Severe',
    ])
    expect(questions).toEqual(['duration', 'severity'])
    expect(outcome).toMatchObject({
      status: 'complete',
      specialtyId: 'gastroenterology',
      urgency: 'within_48h',
      summary: { symptoms: 'stomach pain', duration: 'a few days', severity: 'severe' },
    })
  })

  it('asks no more than three questions and falls back to Medicine', () => {
    const { outcome, questions } = converse('I just feel off', 'en', [
      'not sure',
      'not sure',
      'not sure',
    ])
    expect(questions).toEqual(['detail', 'duration', 'severity'])
    expect(questions.length).toBeLessThanOrEqual(MAX_FOLLOW_UPS)
    expect(outcome).toMatchObject({
      status: 'complete',
      specialtyId: 'medicine',
      urgency: 'routine',
    })
  })

  it('explains the choice in the patient’s language', () => {
    const bn = converse('খাওয়ার পর পেট ব্যথা', 'bn', ['কয়েক দিন', 'হালকা']).outcome
    expect(bn.status === 'complete' && bn.explanation).toContain('পরিপাকতন্ত্র ও লিভার')
    const child = converse('My child has fever and cough', 'en', ['Since today', 'Mild']).outcome
    expect(child).toMatchObject({ status: 'complete', specialtyId: 'pediatrics' })
    expect(child.status === 'complete' && child.explanation).toBe(
      'You described fever and cough in a child. Paediatrics doctors treat children, so that is the right place to start.',
    )
  })
})
