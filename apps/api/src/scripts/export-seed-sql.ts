import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dhakaInstant, generateSampleData } from '@inovexa/shared'
import bcrypt from 'bcryptjs'
import { stableUuid } from '../db/seed.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = path.resolve(__dirname, '../../db/migrations/001_init.sql')
const OUTPUT_PATH = path.resolve(__dirname, '../../../../lumina_hospital_seed.sql')

const esc = (v: string | null | undefined): string =>
  v === null || v === undefined ? 'NULL' : `'${v.replace(/'/g, "''")}'`

const escArr = (arr: string[] | null | undefined): string => {
  if (!arr) return 'NULL'
  if (arr.length === 0) return "'{}'::text[]"
  return `ARRAY[${arr.map((s) => esc(s)).join(', ')}]::text[]`
}

function main() {
  const schema = readFileSync(MIGRATION_PATH, 'utf8').trim()
  // Deterministic snapshot date so re-exporting produces clean diffs.
  const now = dhakaInstant('2026-11-21', '18:10')
  const data = generateSampleData({ now, seed: 20261121 })

  const hashes = new Map<string, string>()
  for (const s of data.staff) {
    if (!hashes.has(s.password)) hashes.set(s.password, bcrypt.hashSync(s.password, 10))
  }

  const patients = data.patients.slice(0, 100)
  const patientSet = new Set(patients.map((p) => p.id))
  const appointments = data.appointments.filter((a) => patientSet.has(a.patientId)).slice(0, 250)
  const apptSet = new Set(appointments.map((a) => a.id))
  const usedTriage = new Set(appointments.map((a) => a.triageId).filter(Boolean))
  const triage = data.triage.filter((t) => usedTriage.has(t.id) || !t.patientId).slice(0, 120)
  const validTriage = new Set(triage.map((t) => t.id))
  const sms = data.sms.filter((m) => !m.appointmentId || apptSet.has(m.appointmentId)).slice(0, 30)

  const lines: string[] = [
    '-- Lumina Specialized Hospital — PostgreSQL 16+ Schema & Seed',
    '-- Generated from apps/api/db/migrations/001_init.sql and @inovexa/shared generateSampleData()',
    '-- Demo staff credentials: admin/admin123, frontdesk/frontdesk123, dr.<first>/doctor123',
    '',
    'BEGIN;',
    '',
    schema,
    '',
    '-- Clean existing rows for idempotent import',
    'TRUNCATE queue_state, sms_message, appointment, triage_session, leave_day, schedule_rule, staff_user, doctor, specialty, patient, otp_code, setting, user_session CASCADE;',
    '',
    '-- Specialties (14)',
  ]

  for (const s of data.specialties) {
    lines.push(
      `INSERT INTO specialty (id, name_en, name_bn, description_en, description_bn, sort_order, active) VALUES (${esc(s.id)}, ${esc(s.name.en)}, ${esc(s.name.bn)}, ${esc(s.description.en)}, ${esc(s.description.bn)}, ${s.sortOrder}, ${s.active});`,
    )
  }

  lines.push('', '-- Doctors (22) and Schedule Rules')
  for (const d of data.doctors) {
    const did = stableUuid('doctor', d.id)
    lines.push(
      `INSERT INTO doctor (id, name_en, name_bn, specialty_id, designation_en, designation_bn, qualifications, experience_years, fee, gender, active) VALUES (${esc(did)}, ${esc(d.name.en)}, ${esc(d.name.bn)}, ${esc(d.specialtyId)}, ${esc(d.designation.en)}, ${esc(d.designation.bn)}, ${esc(d.qualifications)}, ${d.experienceYears}, ${d.fee}, ${esc(d.gender)}, ${d.active});`,
    )
    for (const r of d.schedule) {
      lines.push(
        `INSERT INTO schedule_rule (id, doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room) VALUES (${esc(stableUuid('rule', r.id))}, ${esc(did)}, ${r.weekday}, ${esc(r.start)}, ${esc(r.end)}, ${r.slotMinutes}, ${r.maxPatients}, ${esc(r.room)});`,
      )
    }
  }

  lines.push('', '-- Leave Days (4)')
  for (const l of data.leaveDays) {
    lines.push(
      `INSERT INTO leave_day (id, doctor_id, date, reason) VALUES (${esc(stableUuid('leave', l.id))}, ${esc(stableUuid('doctor', l.doctorId))}, ${esc(l.date)}, ${esc(l.reason)});`,
    )
  }

  lines.push('', `-- Patients (${patients.length})`)
  for (const p of patients) {
    lines.push(
      `INSERT INTO patient (id, name, phone, age, sex, registered_by, phone_verified_at) VALUES (${esc(stableUuid('patient', p.id))}, ${esc(p.name)}, ${esc(p.phone)}, ${p.age}, ${esc(p.sex)}, ${esc(p.registeredBy)}, ${p.registeredBy === 'self' ? esc(now.toISOString()) : 'NULL'});`,
    )
  }

  lines.push('', `-- Triage Sessions (${triage.length})`)
  for (const t of triage) {
    const pid =
      t.patientId && patientSet.has(t.patientId) ? stableUuid('patient', t.patientId) : null
    const answers = JSON.stringify(t.answers.map(({ question, answer }) => ({ question, answer })))
    lines.push(
      `INSERT INTO triage_session (id, patient_id, lang, problem, answers, status, specialty_id, urgency, explanation, tags, emergency_matches, summary, created_at) VALUES (${esc(stableUuid('triage', t.id))}, ${esc(pid)}, ${esc(t.lang)}, ${esc(t.problem)}, ${esc(answers)}::jsonb, ${esc(t.status)}, ${esc(t.specialtyId ?? null)}, ${esc(t.urgency ?? null)}, ${esc(t.explanation ?? null)}, ${escArr(t.tags)}, ${escArr(t.emergencyMatches ?? null)}, ${t.summary ? `${esc(JSON.stringify(t.summary))}::jsonb` : 'NULL'}, ${esc(t.createdAt)});`,
    )
  }

  lines.push('', `-- Appointments (${appointments.length})`)
  for (const a of appointments) {
    const tid = a.triageId && validTriage.has(a.triageId) ? stableUuid('triage', a.triageId) : null
    lines.push(
      `INSERT INTO appointment (id, patient_id, doctor_id, date, start_time, end_time, serial, status, source, hold_expires_at, triage_id, rescheduled_from_id, cancel_reason, called_at, created_at) VALUES (${esc(stableUuid('appointment', a.id))}, ${esc(stableUuid('patient', a.patientId))}, ${esc(stableUuid('doctor', a.doctorId))}, ${esc(a.date)}, ${esc(a.start)}, ${esc(a.end)}, ${a.serial}, ${esc(a.status)}, ${esc(a.source)}, ${esc(a.holdExpiresAt ?? null)}, ${esc(tid)}, NULL, ${esc(a.cancelReason ?? null)}, ${esc(a.calledAt ?? null)}, ${esc(a.createdAt)});`,
    )
  }

  lines.push('', '-- Queue State')
  for (const q of data.queue) {
    const serving =
      q.nowServingId && apptSet.has(q.nowServingId)
        ? stableUuid('appointment', q.nowServingId)
        : null
    lines.push(
      `INSERT INTO queue_state (doctor_id, date, now_serving_id, updated_at) VALUES (${esc(stableUuid('doctor', q.doctorId))}, ${esc(q.date)}, ${esc(serving)}, ${esc(now.toISOString())});`,
    )
  }

  lines.push('', '-- Staff Users (24, bcrypt-hashed)')
  for (const u of data.staff) {
    lines.push(
      `INSERT INTO staff_user (id, name, username, password_hash, role, doctor_id, active) VALUES (${esc(stableUuid('staff', u.id))}, ${esc(u.name)}, ${esc(u.username)}, ${esc(hashes.get(u.password)!)}, ${esc(u.role)}, ${esc(u.doctorId ? stableUuid('doctor', u.doctorId) : null)}, ${u.active});`,
    )
  }

  lines.push('', `-- Recent SMS Messages (${sms.length})`)
  for (const m of sms) {
    const aid =
      m.appointmentId && apptSet.has(m.appointmentId)
        ? stableUuid('appointment', m.appointmentId)
        : null
    lines.push(
      `INSERT INTO sms_message (id, phone, kind, body, appointment_id, status, sent_at) VALUES (${esc(stableUuid('sms', m.id))}, ${esc(m.phone)}, ${esc(m.kind)}, ${esc(m.body)}, ${esc(aid)}, ${esc(m.status)}, ${esc(m.createdAt)});`,
    )
  }

  lines.push(
    '',
    '-- Settings',
    `INSERT INTO setting (key, value) VALUES ('reminder', ${esc(JSON.stringify(data.settings.reminder))}::jsonb);`,
    `INSERT INTO setting (key, value) VALUES ('booking', ${esc(JSON.stringify(data.settings.booking))}::jsonb);`,
    '',
    'COMMIT;',
    '',
  )

  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8')
  console.log(`Wrote PostgreSQL 16+ compatible seed SQL to ${OUTPUT_PATH}`)
}

main()
