import { describe, expect, it } from 'vitest'
import {
  type MockAnswer,
  AI_TEST_SET,
  MAX_FOLLOW_UPS,
  SPECIALTIES,
  runMockTriage,
} from '../src/index.ts'

describe('AI_TEST_SET (SOW 100+ case benchmark)', () => {
  it('contains at least 100 test cases covering every specialty and emergencies', () => {
    expect(AI_TEST_SET.length).toBeGreaterThanOrEqual(100)
    const specIds = new Set(SPECIALTIES.map((s) => s.id))
    const covered = new Set<string>()
    let emergencies = 0
    for (const tc of AI_TEST_SET) {
      if (tc.expectedEmergency) {
        emergencies++
        expect(tc.expectedSpecialtyId).toBeNull()
      } else {
        expect(specIds.has(tc.expectedSpecialtyId!), tc.id).toBe(true)
        covered.add(tc.expectedSpecialtyId!)
      }
    }
    expect(covered.size).toBe(SPECIALTIES.length)
    expect(emergencies).toBeGreaterThanOrEqual(10)
  })

  it('meets the >=80% specialty accuracy and 100% emergency recall targets', () => {
    let spTotal = 0
    let spCorrect = 0
    let emTotal = 0
    let emCaught = 0

    for (const tc of AI_TEST_SET) {
      const answers: MockAnswer[] = []
      let outcome = runMockTriage({ problem: tc.problem, lang: tc.lang, answers })
      while (outcome.status === 'needs_answer' && answers.length < MAX_FOLLOW_UPS) {
        const reply =
          outcome.quickReplies[1] ??
          outcome.quickReplies[0] ??
          (tc.lang === 'bn' ? 'মাঝারি' : 'Moderate')
        answers.push({ kind: outcome.kind, question: outcome.question, answer: reply })
        outcome = runMockTriage({ problem: tc.problem, lang: tc.lang, answers })
      }
      if (tc.expectedEmergency) {
        emTotal++
        if (outcome.status === 'emergency') emCaught++
      } else {
        spTotal++
        if (outcome.status === 'complete' && outcome.specialtyId === tc.expectedSpecialtyId) {
          spCorrect++
        }
      }
    }

    expect(emCaught).toBe(emTotal)
    expect(spCorrect / spTotal).toBeGreaterThanOrEqual(0.8)
  })
})
