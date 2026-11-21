import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { AI_TEST_SET, MAX_FOLLOW_UPS, SPECIALTIES } from '@inovexa/shared'
import { type AiProviderKind, loadConfig } from '../config.ts'
import { type TriageTurn, createAiProvider } from '../providers/ai.ts'

const TARGET_SPECIALTY_ACCURACY = 0.8

function parseArgs(argv: string[]) {
  let provider: AiProviderKind | undefined
  let reportPath: string | undefined
  for (const arg of argv) {
    if (arg.startsWith('--provider=')) {
      const val = arg.slice('--provider='.length)
      if (val === 'mock' || val === 'gemini' || val === 'openai') provider = val
    } else if (arg.startsWith('--report=')) {
      reportPath = arg.slice('--report='.length)
    }
  }
  return { provider, reportPath }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const baseCfg = loadConfig()
  const cfg = args.provider ? { ...baseCfg, aiProvider: args.provider } : baseCfg
  const ai = createAiProvider(cfg)

  let specialtyTotal = 0
  let specialtyCorrect = 0
  let falseEmergencies = 0
  let emergencyTotal = 0
  let emergencyDetected = 0

  const perSpecialty = new Map<string, { total: number; correct: number }>()
  const perLang = new Map<string, { total: number; correct: number }>()
  const misses: Array<{ id: string; problem: string; expected: string; actual: string }> = []

  for (const tc of AI_TEST_SET) {
    const answers: TriageTurn[] = []
    let turns = 0
    let finalOutcome = await ai.evaluate({
      problem: tc.problem,
      lang: tc.lang,
      answers,
      specialties: SPECIALTIES,
    })

    while (finalOutcome.status === 'needs_answer' && turns < MAX_FOLLOW_UPS) {
      const canned =
        tc.followUps?.[turns] ??
        finalOutcome.quickReplies[1] ??
        finalOutcome.quickReplies[0] ??
        (tc.lang === 'bn' ? 'মাঝারি, কয়েক দিন ধরে' : 'Moderate, a few days')
      answers.push({
        question: finalOutcome.question,
        answer: canned,
        ...(finalOutcome.kind ? { kind: finalOutcome.kind } : {}),
      })
      turns++
      finalOutcome = await ai.evaluate({
        problem: tc.problem,
        lang: tc.lang,
        answers,
        specialties: SPECIALTIES,
      })
    }

    if (tc.expectedEmergency) {
      emergencyTotal++
      if (finalOutcome.status === 'emergency') {
        emergencyDetected++
      } else {
        misses.push({
          id: tc.id,
          problem: tc.problem,
          expected: 'EMERGENCY',
          actual:
            finalOutcome.status === 'complete' ? finalOutcome.specialtyId : finalOutcome.status,
        })
      }
      continue
    }

    specialtyTotal++
    const expected = tc.expectedSpecialtyId!
    const spBucket = perSpecialty.get(expected) ?? { total: 0, correct: 0 }
    spBucket.total++
    const langBucket = perLang.get(tc.lang) ?? { total: 0, correct: 0 }
    langBucket.total++

    if (finalOutcome.status === 'emergency') {
      falseEmergencies++
      misses.push({
        id: tc.id,
        problem: tc.problem,
        expected,
        actual: 'EMERGENCY (false positive)',
      })
    } else if (finalOutcome.status === 'complete' && finalOutcome.specialtyId === expected) {
      specialtyCorrect++
      spBucket.correct++
      langBucket.correct++
    } else {
      misses.push({
        id: tc.id,
        problem: tc.problem,
        expected,
        actual: finalOutcome.status === 'complete' ? finalOutcome.specialtyId : finalOutcome.status,
      })
    }
    perSpecialty.set(expected, spBucket)
    perLang.set(tc.lang, langBucket)
  }

  const specialtyAcc = specialtyTotal ? specialtyCorrect / specialtyTotal : 0
  const emergencyRecall = emergencyTotal ? emergencyDetected / emergencyTotal : 1
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  const lines: string[] = [
    `# AI Triage Evaluation Report`,
    '',
    `- **Provider:** \`${ai.name}\``,
    `- **Total test cases:** ${AI_TEST_SET.length} (${specialtyTotal} specialty + ${emergencyTotal} emergency)`,
    `- **Specialty accuracy:** **${specialtyCorrect}/${specialtyTotal} (${pct(specialtyAcc)})** — SOW target: ≥ ${pct(TARGET_SPECIALTY_ACCURACY)}`,
    `- **Emergency recall:** **${emergencyDetected}/${emergencyTotal} (${pct(emergencyRecall)})** — target: 100.0%`,
    `- **False-positive emergencies:** ${falseEmergencies}`,
    '',
    '## By Specialty',
    '',
    '| Specialty | Correct | Total | Accuracy |',
    '| --- | ---: | ---: | ---: |',
    ...SPECIALTIES.map((s) => {
      const b = perSpecialty.get(s.id) ?? { total: 0, correct: 0 }
      return `| \`${s.id}\` (${s.name.en}) | ${b.correct} | ${b.total} | ${b.total ? pct(b.correct / b.total) : '—'} |`
    }),
    '',
    '## By Language',
    '',
    '| Language | Correct | Total | Accuracy |',
    '| --- | ---: | ---: | ---: |',
    ...[...perLang.entries()].map(
      ([lang, b]) => `| \`${lang}\` | ${b.correct} | ${b.total} | ${pct(b.correct / b.total)} |`,
    ),
  ]

  if (misses.length > 0) {
    lines.push(
      '',
      '## Misclassified Cases',
      '',
      '| ID | Expected | Actual | Problem |',
      '| --- | --- | --- | --- |',
    )
    for (const m of misses) {
      lines.push(`| ${m.id} | \`${m.expected}\` | \`${m.actual}\` | ${m.problem} |`)
    }
  }

  const report = lines.join('\n')
  console.log(report)

  if (args.reportPath) {
    const abs = path.resolve(process.cwd(), args.reportPath)
    writeFileSync(abs, `${report}\n`, 'utf8')
    console.log(`\nReport written to ${abs}`)
  }

  const passed = specialtyAcc >= TARGET_SPECIALTY_ACCURACY && emergencyRecall === 1
  if (!passed) {
    console.error('\nFAILED: AI evaluation did not meet SOW accuracy / safety thresholds.')
    process.exit(1)
  }
}

void main()
