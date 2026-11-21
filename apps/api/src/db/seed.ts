import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSampleData } from '@inovexa/shared'
import bcrypt from 'bcryptjs'
import { loadConfig } from '../config.ts'
import { type Db, createDb } from './client.ts'
import { runMigrations } from './migrate.ts'

/** Deterministic UUID from a sample-data string ID (e.g. 'd01' -> stable valid UUID v4-formatted). */
export function stableUuid(namespace: string, key: string): string {
  const hex = createHash('sha256').update(`lumina:${namespace}:${key}`).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

export interface SeedOptions {
  now?: Date
  seed?: number
  /** Skip seeding if specialties already exist (default: false when invoked explicitly). */
  onlyIfEmpty?: boolean
  /** Limit generated appointment/triage volume for fast unit/integration tests. */
  compact?: boolean
}

export async function seedDatabase(
  db: Db,
  options: SeedOptions = {},
): Promise<{ seeded: boolean }> {
  await runMigrations(db)
  if (options.onlyIfEmpty) {
    const existing = await db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM specialty',
    )
    if (Number(existing.rows[0]?.count ?? 0) > 0) return { seeded: false }
  }

  const data = generateSampleData({ now: options.now, seed: options.seed })

  // Pre-hash the 3 unique demo passwords once so seeding 24 staff users is instant.
  const passwordHashes = new Map<string, string>()
  for (const s of data.staff) {
    if (!passwordHashes.has(s.password)) {
      passwordHashes.set(s.password, bcrypt.hashSync(s.password, 10))
    }
  }

  const doctorUuid = (id: string) => stableUuid('doctor', id)
  const ruleUuid = (id: string) => stableUuid('rule', id)
  const leaveUuid = (id: string) => stableUuid('leave', id)
  const patientUuid = (id: string) => stableUuid('patient', id)
  const triageUuid = (id: string) => stableUuid('triage', id)
  const apptUuid = (id: string) => stableUuid('appointment', id)
  const staffUuid = (id: string) => stableUuid('staff', id)
  const smsUuid = (id: string) => stableUuid('sms', id)

  const patients = options.compact ? data.patients.slice(0, 30) : data.patients
  const patientSet = new Set(patients.map((p) => p.id))
  const appointments = options.compact
    ? data.appointments.filter((a) => patientSet.has(a.patientId)).slice(0, 60)
    : data.appointments
  const apptSet = new Set(appointments.map((a) => a.id))
  const triageUsed = new Set(appointments.map((a) => a.triageId).filter(Boolean))
  const triage = options.compact
    ? data.triage.filter((t) => triageUsed.has(t.id) || !t.patientId).slice(0, 40)
    : data.triage
  const sms = options.compact
    ? data.sms.filter((m) => !m.appointmentId || apptSet.has(m.appointmentId)).slice(0, 15)
    : data.sms

  await db.transaction(async (tx) => {
    await tx.query(
      'TRUNCATE queue_state, sms_message, appointment, triage_session, leave_day, schedule_rule, staff_user, doctor, specialty, patient, otp_code, setting, user_session CASCADE',
    )

    for (const s of data.specialties) {
      await tx.query(
        `INSERT INTO specialty (id, name_en, name_bn, description_en, description_bn, sort_order, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [s.id, s.name.en, s.name.bn, s.description.en, s.description.bn, s.sortOrder, s.active],
      )
    }

    for (const d of data.doctors) {
      const did = doctorUuid(d.id)
      await tx.query(
        `INSERT INTO doctor (id, name_en, name_bn, specialty_id, designation_en, designation_bn, qualifications, experience_years, fee, gender, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          did,
          d.name.en,
          d.name.bn,
          d.specialtyId,
          d.designation.en,
          d.designation.bn,
          d.qualifications,
          d.experienceYears,
          d.fee,
          d.gender,
          d.active,
        ],
      )
      for (const r of d.schedule) {
        await tx.query(
          `INSERT INTO schedule_rule (id, doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ruleUuid(r.id), did, r.weekday, r.start, r.end, r.slotMinutes, r.maxPatients, r.room],
        )
      }
    }

    for (const l of data.leaveDays) {
      await tx.query(
        `INSERT INTO leave_day (id, doctor_id, date, reason) VALUES ($1, $2, $3, $4)`,
        [leaveUuid(l.id), doctorUuid(l.doctorId), l.date, l.reason],
      )
    }

    const chunkedInsert = async <T>(
      items: T[],
      cols: number,
      build: (item: T) => unknown[],
      prefix: string,
      casts: string[] = [],
      chunkSize = 200,
    ) => {
      for (let i = 0; i < items.length; i += chunkSize) {
        const slice = items.slice(i, i + chunkSize)
        const params: unknown[] = []
        const tuples: string[] = []
        for (const item of slice) {
          const vals = build(item)
          const placeholders = vals.map((_, idx) => {
            const p = `$${params.length + idx + 1}`
            return casts[idx] ? `${p}${casts[idx]}` : p
          })
          params.push(...vals)
          tuples.push(`(${placeholders.join(', ')})`)
        }
        if (tuples.length > 0 && cols > 0) {
          await tx.query(`${prefix} VALUES ${tuples.join(', ')}`, params)
        }
      }
    }

    const nowIso = (options.now ?? new Date()).toISOString()
    await chunkedInsert(
      patients,
      7,
      (p) => [
        patientUuid(p.id),
        p.name,
        p.phone,
        p.age,
        p.sex,
        p.registeredBy,
        p.registeredBy === 'self' ? nowIso : null,
      ],
      'INSERT INTO patient (id, name, phone, age, sex, registered_by, phone_verified_at)',
    )

    await chunkedInsert(
      triage,
      13,
      (t) => [
        triageUuid(t.id),
        t.patientId && patientSet.has(t.patientId) ? patientUuid(t.patientId) : null,
        t.lang,
        t.problem,
        JSON.stringify(t.answers.map(({ question, answer }) => ({ question, answer }))),
        t.status,
        t.specialtyId ?? null,
        t.urgency ?? null,
        t.explanation ?? null,
        t.tags,
        t.emergencyMatches ?? null,
        t.summary ? JSON.stringify(t.summary) : null,
        t.createdAt,
      ],
      'INSERT INTO triage_session (id, patient_id, lang, problem, answers, status, specialty_id, urgency, explanation, tags, emergency_matches, summary, created_at)',
      ['', '', '', '', '::jsonb', '', '', '', '', '::text[]', '::text[]', '::jsonb', ''],
    )

    const validTriageIds = new Set(triage.map((t) => t.id))
    await chunkedInsert(
      appointments,
      15,
      (a) => [
        apptUuid(a.id),
        patientUuid(a.patientId),
        doctorUuid(a.doctorId),
        a.date,
        a.start,
        a.end,
        a.serial,
        a.status,
        a.source,
        a.holdExpiresAt ?? null,
        a.triageId && validTriageIds.has(a.triageId) ? triageUuid(a.triageId) : null,
        a.rescheduledFromId && apptSet.has(a.rescheduledFromId)
          ? apptUuid(a.rescheduledFromId)
          : null,
        a.cancelReason ?? null,
        a.calledAt ?? null,
        a.createdAt,
      ],
      'INSERT INTO appointment (id, patient_id, doctor_id, date, start_time, end_time, serial, status, source, hold_expires_at, triage_id, rescheduled_from_id, cancel_reason, called_at, created_at)',
    )

    for (const q of data.queue) {
      const servingId =
        q.nowServingId && apptSet.has(q.nowServingId) ? apptUuid(q.nowServingId) : null
      await tx.query(
        `INSERT INTO queue_state (doctor_id, date, now_serving_id, updated_at)
         VALUES ($1, $2, $3, now())`,
        [doctorUuid(q.doctorId), q.date, servingId],
      )
    }

    for (const u of data.staff) {
      await tx.query(
        `INSERT INTO staff_user (id, name, username, password_hash, role, doctor_id, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          staffUuid(u.id),
          u.name,
          u.username,
          passwordHashes.get(u.password)!,
          u.role,
          u.doctorId ? doctorUuid(u.doctorId) : null,
          u.active,
        ],
      )
    }

    for (const m of sms) {
      await tx.query(
        `INSERT INTO sms_message (id, phone, kind, body, appointment_id, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          smsUuid(m.id),
          m.phone,
          m.kind,
          m.body,
          m.appointmentId && apptSet.has(m.appointmentId) ? apptUuid(m.appointmentId) : null,
          m.status,
          m.createdAt,
        ],
      )
    }

    await tx.query(`INSERT INTO setting (key, value) VALUES ('reminder', $1::jsonb)`, [
      JSON.stringify(data.settings.reminder),
    ])
    await tx.query(`INSERT INTO setting (key, value) VALUES ('booking', $1::jsonb)`, [
      JSON.stringify(data.settings.booking),
    ])
  })

  return { seeded: true }
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isCli) {
  const cfg = loadConfig()
  const db = await createDb(cfg.databaseUrl)
  try {
    await seedDatabase(db)
    console.log(`Seeded database (${db.driver}) with 3 months of sample data.`)
  } finally {
    await db.close()
  }
}
