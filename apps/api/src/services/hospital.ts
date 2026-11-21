import { createHash, randomBytes, randomInt } from 'node:crypto'
import {
  type AnalyticsSummary,
  type Appointment,
  type AppointmentSource,
  type AppointmentStatus,
  type AppointmentView,
  type AvailabilityDay,
  type CancelReason,
  type DaySheet,
  type Doctor,
  type DoctorInput,
  type DoctorListItem,
  type DoctorSuggestion,
  type ErrorCode,
  type Lang,
  type LeaveDay,
  type Patient,
  type PreVisitSummary,
  type QuestionKind,
  type QueueStatus,
  type ScheduleRule,
  type Settings,
  type Sex,
  type SmsKind,
  type SmsMessage,
  type Specialty,
  type SpecialtyInput,
  type StaffRole,
  type StaffUser,
  type TriageResult,
  type TriageSession,
  type Urgency,
  type Weekday,
  DEFAULT_CLOSE_MINUTES_BEFORE,
  DEFAULT_OPEN_DAYS,
  DEFAULT_SETTINGS,
  HOLD_MINUTES,
  addDays,
  availability,
  checkSlot,
  daySlots,
  daysBetween,
  dhakaDate,
  dhakaMinutes,
  isValidDate,
  isValidTime,
  maskedOtpBody,
  nextToCall,
  normalizePhone,
  normalizeText,
  occupiesSlot,
  openSlots,
  otpBody,
  queuePosition,
  smsBody,
  toMinutes,
} from '@inovexa/shared'
import bcrypt from 'bcryptjs'
import { type Db, type Queryable, asDate, asIso, asTime } from '../db/client.ts'
import { fail, isPgUniqueViolation } from '../errors.ts'
import type { AiTriageProvider, TriageTurn } from '../providers/ai.ts'
import type { SmsProvider } from '../providers/sms.ts'
import type { QueueBroadcaster } from '../realtime.ts'

const ACTIVE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'booked',
  'arrived',
  'in_consultation',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SpecialtyRow {
  id: string
  name_en: string
  name_bn: string
  description_en: string
  description_bn: string
  sort_order: number
  active: boolean
}

interface DoctorRow {
  id: string
  name_en: string
  name_bn: string
  specialty_id: string
  designation_en: string
  designation_bn: string
  qualifications: string
  experience_years: number
  fee: number
  gender: 'female' | 'male'
  active: boolean
}

interface ScheduleRuleRow {
  id: string
  doctor_id: string
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
  max_patients: number
  room: string
}

interface LeaveDayRow {
  id: string
  doctor_id: string
  date: unknown
  reason: string
}

interface PatientRow {
  id: string
  name: string
  phone: string
  age: number
  sex: Sex
  registered_by: 'self' | 'front_desk'
}

interface AppointmentRow {
  id: string
  patient_id: string
  doctor_id: string
  date: unknown
  start_time: unknown
  end_time: unknown
  serial: number
  status: AppointmentStatus
  source: AppointmentSource
  hold_expires_at: unknown | null
  triage_id: string | null
  rescheduled_from_id: string | null
  cancel_reason: CancelReason | null
  called_at: unknown | null
  created_at: unknown
}

interface TriageRow {
  id: string
  patient_id: string | null
  lang: Lang
  problem: string
  answers: TriageTurn[] | string
  status: TriageSession['status']
  pending_question: string | null
  pending_quick_replies: string[] | string | null
  pending_kind: QuestionKind | null
  specialty_id: string | null
  urgency: Urgency | null
  explanation: string | null
  tags: string[] | null
  emergency_matches: string[] | null
  summary: PreVisitSummary | string | null
  created_at: unknown
}

interface StaffRow {
  id: string
  name: string
  username: string
  password_hash: string
  role: StaffRole
  doctor_id: string | null
  active: boolean
}

interface SmsRow {
  id: string
  phone: string
  kind: SmsKind
  body: string
  appointment_id: string | null
  status: 'queued' | 'sent' | 'failed'
  sent_at: unknown
}

function parseJson<T>(val: T | string | null | undefined, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return val
}

function toSpecialty(r: SpecialtyRow): Specialty {
  return {
    id: r.id,
    name: { en: r.name_en, bn: r.name_bn },
    description: { en: r.description_en, bn: r.description_bn },
    sortOrder: Number(r.sort_order),
    active: Boolean(r.active),
  }
}

function toScheduleRule(r: ScheduleRuleRow): ScheduleRule {
  return {
    id: r.id,
    weekday: Number(r.weekday) as Weekday,
    start: asTime(r.start_time),
    end: asTime(r.end_time),
    slotMinutes: Number(r.slot_minutes),
    maxPatients: Number(r.max_patients),
    room: r.room,
  }
}

function toPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    age: Number(r.age),
    sex: r.sex,
    registeredBy: r.registered_by,
  }
}

function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    date: asDate(r.date),
    start: asTime(r.start_time),
    end: asTime(r.end_time),
    serial: Number(r.serial),
    status: r.status,
    source: r.source,
    createdAt: asIso(r.created_at),
    ...(r.hold_expires_at ? { holdExpiresAt: asIso(r.hold_expires_at) } : {}),
    ...(r.triage_id ? { triageId: r.triage_id } : {}),
    ...(r.rescheduled_from_id ? { rescheduledFromId: r.rescheduled_from_id } : {}),
    ...(r.cancel_reason ? { cancelReason: r.cancel_reason } : {}),
    ...(r.called_at ? { calledAt: asIso(r.called_at) } : {}),
  }
}

function toStaffUser(r: StaffRow): StaffUser {
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    role: r.role,
    active: Boolean(r.active),
    ...(r.doctor_id ? { doctorId: r.doctor_id } : {}),
  }
}

function toLeaveDay(r: LeaveDayRow): LeaveDay {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    date: asDate(r.date),
    reason: r.reason ?? '',
  }
}

function toSmsMessage(r: SmsRow): SmsMessage {
  return {
    id: r.id,
    phone: r.phone,
    kind: r.kind,
    body: r.body,
    status: r.status,
    createdAt: asIso(r.sent_at),
    ...(r.appointment_id ? { appointmentId: r.appointment_id } : {}),
  }
}

function hashOtp(phone: string, code: string): string {
  return createHash('sha256').update(`lumina-otp:${phone}:${code}`).digest('hex')
}

export interface HospitalServiceOptions {
  db: Db
  ai: AiTriageProvider
  sms: SmsProvider
  queue: QueueBroadcaster
  now?: () => Date
  exposeDemoOtp?: boolean
}

export class HospitalService {
  private readonly db: Db
  private readonly ai: AiTriageProvider
  private readonly sms: SmsProvider
  private readonly queue: QueueBroadcaster
  private readonly now: () => Date
  private readonly exposeDemoOtp: boolean
  private readonly rateHits = new Map<string, number[]>()

  constructor(opts: HospitalServiceOptions) {
    this.db = opts.db
    this.ai = opts.ai
    this.sms = opts.sms
    this.queue = opts.queue
    this.now = opts.now ?? (() => new Date())
    this.exposeDemoOtp = opts.exposeDemoOtp ?? opts.sms.isSandbox
  }

  // ---------------------------------------------------------------- internal helpers

  private today(): string {
    return dhakaDate(this.now())
  }

  private assertUuid(id: string, entity = 'Record'): string {
    if (!UUID_RE.test(id)) fail('NOT_FOUND', `${entity} not found.`)
    return id
  }

  private checkRateLimit(key: string, maxRequests: number, windowMs: number) {
    const nowMs = this.now().getTime()
    const recent = (this.rateHits.get(key) ?? []).filter((t) => nowMs - t < windowMs)
    if (recent.length >= maxRequests) {
      fail('TOO_MANY_ATTEMPTS', 'Too many attempts. Please wait a few minutes and try again.')
    }
    recent.push(nowMs)
    this.rateHits.set(key, recent)
  }

  private async loadDoctors(
    q: Queryable,
    whereClause = '',
    params: unknown[] = [],
  ): Promise<Doctor[]> {
    const { rows: docRows } = await q.query<DoctorRow>(
      `SELECT id, name_en, name_bn, specialty_id, designation_en, designation_bn,
              qualifications, experience_years, fee, gender, active
       FROM doctor ${whereClause}
       ORDER BY name_en ASC`,
      params,
    )
    if (docRows.length === 0) return []
    const ids = docRows.map((d) => d.id)
    const { rows: ruleRows } = await q.query<ScheduleRuleRow>(
      `SELECT id, doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room
       FROM schedule_rule
       WHERE doctor_id = ANY($1::uuid[])
       ORDER BY weekday ASC, start_time ASC`,
      [ids],
    )
    const byDoc = new Map<string, ScheduleRule[]>()
    for (const r of ruleRows) {
      const list = byDoc.get(r.doctor_id) ?? []
      list.push(toScheduleRule(r))
      byDoc.set(r.doctor_id, list)
    }
    return docRows.map((d) => ({
      id: d.id,
      name: { en: d.name_en, bn: d.name_bn },
      specialtyId: d.specialty_id,
      designation: { en: d.designation_en, bn: d.designation_bn },
      qualifications: d.qualifications,
      experienceYears: Number(d.experience_years),
      fee: Number(d.fee),
      gender: d.gender === 'female' ? 'female' : 'male',
      active: Boolean(d.active),
      schedule: byDoc.get(d.id) ?? [],
    }))
  }

  private async doctorOr404(
    id: string,
    activeOnly = true,
    q: Queryable = this.db,
  ): Promise<Doctor> {
    this.assertUuid(id, 'Doctor')
    const list = await this.loadDoctors(q, 'WHERE id = $1', [id])
    const doctor = list[0]
    if (!doctor || (activeOnly && !doctor.active)) fail('NOT_FOUND', 'Doctor not found.')
    return doctor
  }

  private async loadSettings(q: Queryable = this.db): Promise<Settings> {
    const { rows } = await q.query<{ key: string; value: unknown }>(
      'SELECT key, value FROM setting WHERE key IN ($1, $2)',
      ['reminder', 'booking'],
    )
    const map = new Map(
      rows.map((r) => [r.key, parseJson<Record<string, unknown>>(r.value as string, {})]),
    )
    const reminder = map.get('reminder') ?? {}
    const booking = map.get('booking') ?? {}
    return {
      reminder: {
        daysBefore: reminder.daysBefore === 0 ? 0 : DEFAULT_SETTINGS.reminder.daysBefore,
        time:
          typeof reminder.time === 'string' && isValidTime(reminder.time)
            ? reminder.time
            : DEFAULT_SETTINGS.reminder.time,
      },
      booking: {
        openDays:
          typeof booking.openDays === 'number' && booking.openDays >= 1
            ? booking.openDays
            : DEFAULT_OPEN_DAYS,
        closeMinutesBefore:
          typeof booking.closeMinutesBefore === 'number' && booking.closeMinutesBefore >= 0
            ? booking.closeMinutesBefore
            : DEFAULT_CLOSE_MINUTES_BEFORE,
      },
    }
  }

  private async leaveDatesFor(doctorId: string, q: Queryable = this.db): Promise<string[]> {
    const { rows } = await q.query<{ date: unknown }>(
      'SELECT date FROM leave_day WHERE doctor_id = $1',
      [doctorId],
    )
    return rows.map((r) => asDate(r.date))
  }

  private async appointmentsForDoctor(
    doctorId: string,
    date?: string,
    q: Queryable = this.db,
  ): Promise<Appointment[]> {
    const sql =
      date !== undefined
        ? 'SELECT * FROM appointment WHERE doctor_id = $1 AND date = $2 ORDER BY serial ASC'
        : 'SELECT * FROM appointment WHERE doctor_id = $1 ORDER BY date ASC, serial ASC'
    const params = date !== undefined ? [doctorId, date] : [doctorId]
    const { rows } = await q.query<AppointmentRow>(sql, params)
    return rows.map(toAppointment)
  }

  private roomFor(doctor: Doctor, date: string, start: string): string | undefined {
    return (
      daySlots(doctor, date).find((s) => s.start === start)?.rule.room ?? doctor.schedule[0]?.room
    )
  }

  private async buildViews(
    appointments: Appointment[],
    opts: { withPatient?: boolean; q?: Queryable } = {},
  ): Promise<AppointmentView[]> {
    if (appointments.length === 0) return []
    const q = opts.q ?? this.db
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))]
    const doctors = await this.loadDoctors(q, 'WHERE id = ANY($1::uuid[])', [doctorIds])
    const doctorById = new Map(doctors.map((d) => [d.id, d]))

    const triageIds = [...new Set(appointments.map((a) => a.triageId).filter(Boolean) as string[])]
    const summaryByTriage = new Map<string, PreVisitSummary>()
    if (triageIds.length > 0) {
      const { rows } = await q.query<{ id: string; summary: PreVisitSummary | string | null }>(
        'SELECT id, summary FROM triage_session WHERE id = ANY($1::uuid[]) AND summary IS NOT NULL',
        [triageIds],
      )
      for (const r of rows) {
        const s = parseJson<PreVisitSummary | null>(r.summary, null)
        if (s) summaryByTriage.set(r.id, s)
      }
    }

    const patientById = new Map<string, Patient>()
    if (opts.withPatient) {
      const patientIds = [...new Set(appointments.map((a) => a.patientId))]
      const { rows } = await q.query<PatientRow>(
        'SELECT id, name, phone, age, sex, registered_by FROM patient WHERE id = ANY($1::uuid[])',
        [patientIds],
      )
      for (const r of rows) patientById.set(r.id, toPatient(r))
    }

    return appointments.map((a) => {
      const doctor = doctorById.get(a.doctorId)!
      const room = this.roomFor(doctor, a.date, a.start)
      const summary = a.triageId ? summaryByTriage.get(a.triageId) : undefined
      const patient = opts.withPatient ? patientById.get(a.patientId) : undefined
      return {
        ...a,
        doctor,
        ...(patient ? { patient } : {}),
        ...(summary ? { summary } : {}),
        ...(room ? { room } : {}),
      }
    })
  }

  private async sendAndLogSms(
    kind: SmsKind,
    phone: string,
    bodyToSend: string,
    opts: { bodyToStore?: string; appointmentId?: string; q?: Queryable } = {},
  ): Promise<SmsMessage> {
    const result = await this.sms.send(phone, bodyToSend)
    const q = opts.q ?? this.db
    const { rows } = await q.query<SmsRow>(
      `INSERT INTO sms_message (phone, kind, body, appointment_id, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, kind, body, appointment_id, status, sent_at`,
      [
        phone,
        kind,
        opts.bodyToStore ?? bodyToSend,
        opts.appointmentId ?? null,
        result.status,
        this.now().toISOString(),
      ],
    )
    return toSmsMessage(rows[0]!)
  }

  private async notifyAppointment(
    kind: Exclude<SmsKind, 'otp'>,
    a: Appointment,
    onLeave = false,
  ): Promise<void> {
    const [patientRes, doctor] = await Promise.all([
      this.db.query<PatientRow>('SELECT * FROM patient WHERE id = $1', [a.patientId]),
      this.doctorOr404(a.doctorId, false).catch(() => null),
    ])
    const patient = patientRes.rows[0]
    if (!patient || !doctor) return
    const body = smsBody(kind, {
      doctorName: doctor.name.en,
      date: a.date,
      start: a.start,
      serial: a.serial,
      room: this.roomFor(doctor, a.date, a.start),
      onLeave,
    })
    await this.sendAndLogSms(kind, patient.phone, body, { appointmentId: a.id })
  }

  private async currentNowServing(doctorId: string, date: string): Promise<number | null> {
    const { rows } = await this.db.query<{ serial: number }>(
      `SELECT serial FROM appointment
       WHERE doctor_id = $1 AND date = $2 AND status = 'in_consultation'
       LIMIT 1`,
      [doctorId, date],
    )
    return rows[0] ? Number(rows[0].serial) : null
  }

  private async broadcastQueue(doctorId: string, date: string): Promise<void> {
    const serving = await this.currentNowServing(doctorId, date)
    this.queue.emitQueueChanged(doctorId, date, serving)
  }

  private slotError(code: ErrorCode): never {
    return fail(code, code === 'VALIDATION' ? 'That slot is not bookable.' : undefined)
  }

  private async availabilityFor(
    doctor: Doctor,
    from: string,
    days?: number,
    online = true,
  ): Promise<AvailabilityDay[]> {
    const settings = await this.loadSettings()
    const openDays = settings.booking.openDays
    const count = days ?? openDays
    const today = this.today()
    const lastOpen = addDays(today, openDays - 1)
    const [leaveDates, appts] = await Promise.all([
      this.leaveDatesFor(doctor.id),
      this.appointmentsForDoctor(doctor.id),
    ])
    const result = availability({
      doctor,
      from,
      days: count,
      leaveDates,
      appointments: appts,
      now: this.now(),
      ...(online ? { closeMinutesBefore: settings.booking.closeMinutesBefore } : {}),
    })
    for (const day of result) {
      if (day.date > lastOpen) {
        for (const s of day.sessions) for (const slot of s.slots) slot.available = false
      }
    }
    return result
  }

  // ---------------------------------------------------------------- public

  async listSpecialties(): Promise<Specialty[]> {
    const { rows } = await this.db.query<SpecialtyRow>(
      'SELECT * FROM specialty WHERE active = true ORDER BY sort_order ASC, name_en ASC',
    )
    return rows.map(toSpecialty)
  }

  async listDoctors(query: { specialtyId?: string; q?: string }): Promise<DoctorListItem[]> {
    const search = normalizeText(query.q ?? '')
    const [doctors, specialties] = await Promise.all([
      this.loadDoctors(
        this.db,
        query.specialtyId ? 'WHERE active = true AND specialty_id = $1' : 'WHERE active = true',
        query.specialtyId ? [query.specialtyId] : [],
      ),
      this.listAllSpecialties(),
    ])
    const specById = new Map(specialties.map((s) => [s.id, s]))
    const filtered = search
      ? doctors.filter((d) => {
          const sp = specById.get(d.specialtyId)
          return [d.name.en, d.name.bn, sp?.name.en ?? '', sp?.name.bn ?? '']
            .map(normalizeText)
            .some((t) => t.includes(search))
        })
      : doctors

    const today = this.today()
    const items: DoctorListItem[] = []
    for (const d of filtered) {
      const days = await this.availabilityFor(d, today)
      items.push({ ...d, nextSlot: openSlots(days)[0] ?? null })
    }
    return items
  }

  async getDoctor(id: string): Promise<Doctor> {
    return this.doctorOr404(id, true)
  }

  async getAvailability(
    id: string,
    query: { from?: string; days?: number },
  ): Promise<AvailabilityDay[]> {
    const doctor = await this.doctorOr404(id, true)
    const settings = await this.loadSettings()
    const from = query.from && isValidDate(query.from) ? query.from : this.today()
    const days = Math.min(Math.max(query.days ?? settings.booking.openDays, 1), 31)
    return this.availabilityFor(doctor, from, days, true)
  }

  // ---------------------------------------------------------------- AI triage

  private toPublicTriage(r: TriageRow): TriageSession {
    const answers = parseJson<TriageTurn[]>(r.answers, []).map(({ question, answer }) => ({
      question,
      answer,
    }))
    const quickReplies = parseJson<string[] | null>(r.pending_quick_replies, null)
    return {
      id: r.id,
      lang: r.lang,
      problem: r.problem,
      answers,
      status: r.status,
      tags: r.tags ?? [],
      ...(r.pending_question ? { question: r.pending_question } : {}),
      ...(quickReplies ? { quickReplies } : {}),
      ...(r.specialty_id ? { specialtyId: r.specialty_id } : {}),
      ...(r.urgency ? { urgency: r.urgency } : {}),
      ...(r.explanation ? { explanation: r.explanation } : {}),
      ...(r.emergency_matches ? { emergencyMatches: r.emergency_matches } : {}),
    }
  }

  private async suggestionsFor(
    specialtyId: string,
    urgency?: Urgency,
  ): Promise<DoctorSuggestion[]> {
    const doctors = await this.loadDoctors(this.db, 'WHERE active = true AND specialty_id = $1', [
      specialtyId,
    ])
    const today = this.today()
    const suggestions: DoctorSuggestion[] = []
    for (const doctor of doctors) {
      const slots = openSlots(await this.availabilityFor(doctor, today, undefined, true)).slice(
        0,
        3,
      )
      if (slots.length > 0) suggestions.push({ doctor, slots })
    }
    const earliest = (s: DoctorSuggestion) => `${s.slots[0]!.date} ${s.slots[0]!.start}`
    return urgency === 'within_48h'
      ? suggestions.sort((a, b) => earliest(a).localeCompare(earliest(b)))
      : suggestions.sort((a, b) => b.doctor.experienceYears - a.doctor.experienceYears)
  }

  async startTriage(body: { problem?: unknown; lang?: unknown }): Promise<TriageResult> {
    const problem = typeof body.problem === 'string' ? body.problem.trim() : ''
    if (!problem) fail('VALIDATION', 'Describe the problem first.')
    if (problem.length > 1000) fail('VALIDATION', 'Please keep it under 1000 characters.')
    const lang: Lang = body.lang === 'bn' ? 'bn' : 'en'
    const specialties = await this.listSpecialties()
    const outcome = await this.ai.evaluate({ problem, lang, answers: [], specialties })

    const { rows } = await this.db.query<TriageRow>(
      `INSERT INTO triage_session (
         lang, problem, answers, status, pending_question, pending_quick_replies, pending_kind,
         specialty_id, urgency, explanation, tags, emergency_matches, summary, created_at
       )
       VALUES ($1, $2, '[]'::jsonb, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::text[], $11::text[], $12::jsonb, $13)
       RETURNING *`,
      [
        lang,
        problem,
        outcome.status,
        outcome.status === 'needs_answer' ? outcome.question : null,
        outcome.status === 'needs_answer' ? JSON.stringify(outcome.quickReplies) : null,
        outcome.status === 'needs_answer' ? (outcome.kind ?? null) : null,
        outcome.status === 'complete' ? outcome.specialtyId : null,
        outcome.status === 'complete' ? outcome.urgency : null,
        outcome.status === 'complete' ? outcome.explanation : null,
        outcome.tags,
        outcome.status === 'emergency' ? outcome.emergencyMatches : null,
        outcome.status === 'complete' ? JSON.stringify(outcome.summary) : null,
        this.now().toISOString(),
      ],
    )
    const row = rows[0]!
    const suggestions =
      row.status === 'complete' && row.specialty_id
        ? await this.suggestionsFor(row.specialty_id, row.urgency ?? undefined)
        : []
    return { session: this.toPublicTriage(row), suggestions }
  }

  async answerTriage(id: string, body: { answer?: unknown }): Promise<TriageResult> {
    this.assertUuid(id, 'Conversation')
    const { rows: found } = await this.db.query<TriageRow>(
      'SELECT * FROM triage_session WHERE id = $1',
      [id],
    )
    const current = found[0] ?? fail('NOT_FOUND', 'Conversation not found.')
    if (current.status !== 'needs_answer' || !current.pending_question) {
      fail('VALIDATION', 'This conversation is not waiting for an answer.')
    }
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (!answer) fail('VALIDATION', 'Type an answer first.')
    if (answer.length > 1000) fail('VALIDATION', 'Please keep your answer under 1000 characters.')

    const prevAnswers = parseJson<TriageTurn[]>(current.answers, [])
    const nextAnswers: TriageTurn[] = [
      ...prevAnswers,
      {
        question: current.pending_question,
        answer,
        ...(current.pending_kind ? { kind: current.pending_kind } : {}),
      },
    ]

    const specialties = await this.listSpecialties()
    const outcome = await this.ai.evaluate({
      problem: current.problem,
      lang: current.lang,
      answers: nextAnswers,
      specialties,
    })

    const { rows } = await this.db.query<TriageRow>(
      `UPDATE triage_session
       SET answers = $2::jsonb,
           status = $3,
           pending_question = $4,
           pending_quick_replies = $5::jsonb,
           pending_kind = $6,
           specialty_id = $7,
           urgency = $8,
           explanation = $9,
           tags = $10::text[],
           emergency_matches = $11::text[],
           summary = $12::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        id,
        JSON.stringify(nextAnswers),
        outcome.status,
        outcome.status === 'needs_answer' ? outcome.question : null,
        outcome.status === 'needs_answer' ? JSON.stringify(outcome.quickReplies) : null,
        outcome.status === 'needs_answer' ? (outcome.kind ?? null) : null,
        outcome.status === 'complete' ? outcome.specialtyId : null,
        outcome.status === 'complete' ? outcome.urgency : null,
        outcome.status === 'complete' ? outcome.explanation : null,
        outcome.tags,
        outcome.status === 'emergency' ? outcome.emergencyMatches : null,
        outcome.status === 'complete' ? JSON.stringify(outcome.summary) : null,
      ],
    )
    const row = rows[0]!
    const suggestions =
      row.status === 'complete' && row.specialty_id
        ? await this.suggestionsFor(row.specialty_id, row.urgency ?? undefined)
        : []
    return { session: this.toPublicTriage(row), suggestions }
  }

  // ---------------------------------------------------------------- patient sign-in

  async requestOtp(
    body: { phone?: unknown },
    clientIp = 'unknown',
  ): Promise<{ expiresInSeconds: number; demoCode?: string }> {
    const phone =
      normalizePhone(String(body.phone ?? '')) ??
      fail('VALIDATION', 'Enter a valid mobile number, like 01712345678.')
    this.checkRateLimit(`otp:phone:${phone}`, 8, 15 * 60_000)
    this.checkRateLimit(`otp:ip:${clientIp}`, 30, 15 * 60_000)

    const code = String(randomInt(100_000, 1_000_000))
    const expiresAt = new Date(this.now().getTime() + 5 * 60_000).toISOString()
    await this.db.query(
      `INSERT INTO otp_code (phone, code_hash, expiry, attempts, created_at)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (phone) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           expiry = EXCLUDED.expiry,
           attempts = 0,
           created_at = EXCLUDED.created_at`,
      [phone, hashOtp(phone, code), expiresAt, this.now().toISOString()],
    )
    await this.sendAndLogSms('otp', phone, otpBody(code), { bodyToStore: maskedOtpBody() })
    return {
      expiresInSeconds: 300,
      ...(this.exposeDemoOtp ? { demoCode: code } : {}),
    }
  }

  async verifyOtp(body: { phone?: unknown; code?: unknown }): Promise<{
    sessionId: string
    patient: Patient | null
    needsProfile: boolean
  }> {
    const phone =
      normalizePhone(String(body.phone ?? '')) ?? fail('VALIDATION', 'Enter a valid mobile number.')
    const { rows } = await this.db.query<{
      phone: string
      code_hash: string
      expiry: unknown
      attempts: number
    }>('SELECT * FROM otp_code WHERE phone = $1', [phone])
    const otp = rows[0]
    if (!otp || Date.parse(asIso(otp.expiry)) <= this.now().getTime()) {
      fail('OTP_EXPIRED', 'The code has expired. Ask for a new one.')
    }
    if (otp.attempts >= 5) {
      fail('TOO_MANY_ATTEMPTS', 'Too many wrong codes. Ask for a new one.')
    }
    const submitted = String(body.code ?? '').trim()
    if (hashOtp(phone, submitted) !== otp.code_hash) {
      await this.db.query('UPDATE otp_code SET attempts = attempts + 1 WHERE phone = $1', [phone])
      fail('OTP_INVALID', 'That code is not right.')
    }

    await this.db.query('DELETE FROM otp_code WHERE phone = $1', [phone])
    const { rows: patientRows } = await this.db.query<PatientRow>(
      'SELECT * FROM patient WHERE phone = $1',
      [phone],
    )
    const patient = patientRows[0] ? toPatient(patientRows[0]) : null
    if (patient) {
      await this.db.query('UPDATE patient SET phone_verified_at = $2 WHERE id = $1', [
        patient.id,
        this.now().toISOString(),
      ])
    }

    const sessionId = randomBytes(24).toString('hex')
    const expiresAt = new Date(this.now().getTime() + 7 * 24 * 60 * 60_000).toISOString()
    await this.db.query(
      `INSERT INTO user_session (id, kind, subject_id, phone, expires_at, created_at)
       VALUES ($1, 'patient', $2, $3, $4, $5)`,
      [sessionId, patient?.id ?? null, phone, expiresAt, this.now().toISOString()],
    )
    return { sessionId, patient, needsProfile: !patient }
  }

  private validatePerson(body: { name?: unknown; age?: unknown; sex?: unknown }) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const age = Number(body.age)
    const sex = body.sex as Sex
    if (name.length < 2) fail('VALIDATION', 'Enter the patient’s name.')
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      fail('VALIDATION', 'Enter an age between 0 and 120.')
    }
    if (!['female', 'male', 'other'].includes(sex)) {
      fail('VALIDATION', 'Choose female, male or other.')
    }
    return { name, age, sex }
  }

  async completeProfile(
    sessionId: string | undefined,
    body: { name?: unknown; age?: unknown; sex?: unknown },
  ): Promise<Patient> {
    if (!sessionId) fail('UNAUTHENTICATED', 'Verify your phone number first.')
    const { rows: sessRows } = await this.db.query<{
      id: string
      kind: string
      subject_id: string | null
      phone: string | null
      expires_at: unknown
    }>('SELECT * FROM user_session WHERE id = $1', [sessionId])
    const session = sessRows[0]
    if (
      !session ||
      session.kind !== 'patient' ||
      !session.phone ||
      Date.parse(asIso(session.expires_at)) <= this.now().getTime()
    ) {
      fail('UNAUTHENTICATED', 'Verify your phone number first.')
    }

    const { rows: existing } = await this.db.query<PatientRow>(
      'SELECT * FROM patient WHERE phone = $1',
      [session.phone],
    )
    let patient: Patient
    if (existing[0]) {
      patient = toPatient(existing[0])
    } else {
      const person = this.validatePerson(body)
      const { rows: created } = await this.db.query<PatientRow>(
        `INSERT INTO patient (name, phone, age, sex, registered_by, phone_verified_at)
         VALUES ($1, $2, $3, $4, 'self', $5)
         RETURNING *`,
        [person.name, session.phone, person.age, person.sex, this.now().toISOString()],
      )
      patient = toPatient(created[0]!)
    }

    await this.db.query('UPDATE user_session SET subject_id = $2 WHERE id = $1', [
      session.id,
      patient.id,
    ])
    return patient
  }

  async patientForSession(sessionId: string | undefined): Promise<Patient> {
    if (!sessionId) fail('UNAUTHENTICATED')
    const { rows } = await this.db.query<PatientRow & { expires_at: unknown }>(
      `SELECT p.*, s.expires_at
       FROM user_session s
       JOIN patient p ON p.id = s.subject_id
       WHERE s.id = $1 AND s.kind = 'patient'`,
      [sessionId],
    )
    const row = rows[0]
    if (!row || Date.parse(asIso(row.expires_at)) <= this.now().getTime()) {
      fail('UNAUTHENTICATED')
    }
    return toPatient(row)
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (sessionId) {
      await this.db.query('DELETE FROM user_session WHERE id = $1', [sessionId])
    }
  }

  // ---------------------------------------------------------------- patient appointments

  private async ownAppointment(
    patient: Patient,
    id: string,
    q: Queryable = this.db,
  ): Promise<Appointment> {
    this.assertUuid(id, 'Appointment')
    const { rows } = await q.query<AppointmentRow>(
      'SELECT * FROM appointment WHERE id = $1 AND patient_id = $2',
      [id, patient.id],
    )
    if (!rows[0]) fail('NOT_FOUND', 'Appointment not found.')
    return toAppointment(rows[0])
  }

  async hold(
    patient: Patient,
    body: {
      doctorId?: unknown
      date?: unknown
      start?: unknown
      triageId?: unknown
      rescheduleOf?: unknown
    },
  ): Promise<Appointment> {
    const doctor = await this.doctorOr404(String(body.doctorId ?? ''), true)
    const date = String(body.date ?? '')
    const start = String(body.start ?? '')
    if (!isValidDate(date) || !isValidTime(start)) fail('VALIDATION', 'Choose a date and time.')
    const now = this.now()
    const settings = await this.loadSettings()

    const held = await this.db.transaction(async (tx) => {
      // Idempotent repeat hold for the same slot by the same patient.
      const { rows: myHolds } = await tx.query<AppointmentRow>(
        `SELECT * FROM appointment WHERE patient_id = $1 AND status = 'held'`,
        [patient.id],
      )
      const activeHolds = myHolds.map(toAppointment).filter((a) => occupiesSlot(a, now))
      const same = activeHolds.find(
        (a) => a.doctorId === doctor.id && a.date === date && a.start === start,
      )
      if (same) return same

      let rescheduleOf: Appointment | undefined
      if (body.rescheduleOf) {
        rescheduleOf = await this.ownAppointment(patient, String(body.rescheduleOf), tx)
        if (rescheduleOf.status !== 'booked') {
          fail('VALIDATION', 'Only a booked appointment can be moved.')
        }
      }

      let triageId: string | null = null
      if (body.triageId && UUID_RE.test(String(body.triageId))) {
        const { rows: tRows } = await tx.query<{ id: string; patient_id: string | null }>(
          'SELECT id, patient_id FROM triage_session WHERE id = $1',
          [String(body.triageId)],
        )
        const t = tRows[0]
        if (t && (!t.patient_id || t.patient_id === patient.id)) triageId = t.id
      }

      // One upcoming booking per doctor: a second one is a reschedule.
      if (!rescheduleOf) {
        const { rows: dup } = await tx.query<{ id: string }>(
          `SELECT id FROM appointment
           WHERE patient_id = $1 AND doctor_id = $2
             AND status IN ('booked', 'arrived', 'in_consultation')
             AND date >= $3
           LIMIT 1`,
          [patient.id, doctor.id, this.today()],
        )
        if (dup.length > 0) fail('ALREADY_BOOKED')
      }

      // One active hold per patient at a time + clear any expired holds on the target slot.
      await tx.query(`DELETE FROM appointment WHERE patient_id = $1 AND status = 'held'`, [
        patient.id,
      ])
      await tx.query(
        `DELETE FROM appointment
         WHERE doctor_id = $1 AND date = $2 AND start_time = $3
           AND status = 'held' AND hold_expires_at <= $4`,
        [doctor.id, date, start, now.toISOString()],
      )

      const [leaveDates, dayAppts] = await Promise.all([
        this.leaveDatesFor(doctor.id, tx),
        this.appointmentsForDoctor(doctor.id, date, tx),
      ])

      const check = checkSlot({
        doctor,
        date,
        start,
        leaveDates,
        appointments: dayAppts,
        now,
        openDays: settings.booking.openDays,
        closeMinutesBefore: settings.booking.closeMinutesBefore,
      })
      if (!check.ok) return this.slotError(check.code)

      const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString()
      try {
        const { rows } = await tx.query<AppointmentRow>(
          `INSERT INTO appointment (
             patient_id, doctor_id, date, start_time, end_time, serial, status, source,
             hold_expires_at, triage_id, rescheduled_from_id, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'held', 'online', $7, $8, $9, $10)
           RETURNING *`,
          [
            patient.id,
            doctor.id,
            date,
            start,
            check.slot.end,
            check.slot.serial,
            holdExpiresAt,
            triageId,
            rescheduleOf?.id ?? null,
            now.toISOString(),
          ],
        )
        return toAppointment(rows[0]!)
      } catch (err) {
        if (isPgUniqueViolation(err)) fail('SLOT_TAKEN')
        throw err
      }
    })

    return held
  }

  async getAppointment(patient: Patient, id: string): Promise<AppointmentView> {
    const a = await this.ownAppointment(patient, id)
    if (a.status === 'held' && !occupiesSlot(a, this.now())) {
      await this.db.query('DELETE FROM appointment WHERE id = $1', [a.id])
      fail('HOLD_EXPIRED')
    }
    const [view] = await this.buildViews([a])
    if (a.rescheduledFromId) {
      const { rows } = await this.db.query<AppointmentRow>(
        'SELECT * FROM appointment WHERE id = $1',
        [a.rescheduledFromId],
      )
      if (rows[0]) {
        const [oldView] = await this.buildViews([toAppointment(rows[0])])
        return { ...view!, rescheduledFrom: oldView }
      }
    }
    return view!
  }

  async confirm(patient: Patient, id: string): Promise<AppointmentView> {
    this.assertUuid(id, 'Appointment')
    const now = this.now()

    const { booked, replacedOld } = await this.db.transaction(async (tx) => {
      const a = await this.ownAppointment(patient, id, tx)
      if (a.status !== 'held') {
        fail('VALIDATION', 'This appointment is not waiting for confirmation.')
      }
      if (!occupiesSlot(a, now)) {
        await tx.query('DELETE FROM appointment WHERE id = $1', [a.id])
        fail('HOLD_EXPIRED')
      }

      const { rows } = await tx.query<AppointmentRow>(
        `UPDATE appointment
         SET status = 'booked', hold_expires_at = NULL
         WHERE id = $1 AND status = 'held' AND hold_expires_at > $2
         RETURNING *`,
        [a.id, now.toISOString()],
      )
      if (!rows[0]) fail('HOLD_EXPIRED')
      const confirmed = toAppointment(rows[0])

      if (confirmed.triageId) {
        await tx.query(
          `UPDATE triage_session SET patient_id = $2 WHERE id = $1 AND patient_id IS NULL`,
          [confirmed.triageId, patient.id],
        )
      }

      let oldAppt: Appointment | null = null
      if (confirmed.rescheduledFromId) {
        const { rows: oldRows } = await tx.query<AppointmentRow>(
          `UPDATE appointment
           SET status = 'cancelled', cancel_reason = 'rescheduled'
           WHERE id = $1 AND patient_id = $2 AND status = 'booked'
           RETURNING *`,
          [confirmed.rescheduledFromId, patient.id],
        )
        if (oldRows[0]) oldAppt = toAppointment(oldRows[0])
      }

      return { booked: confirmed, replacedOld: oldAppt }
    })

    if (replacedOld) {
      await this.notifyAppointment('reschedule', booked)
      await this.broadcastQueue(replacedOld.doctorId, replacedOld.date)
    } else {
      await this.notifyAppointment('confirmation', booked)
    }
    await this.broadcastQueue(booked.doctorId, booked.date)
    const [view] = await this.buildViews([booked])
    return view!
  }

  async releaseHold(patient: Patient, id: string): Promise<void> {
    const a = await this.ownAppointment(patient, id)
    if (a.status === 'held') {
      await this.db.query('DELETE FROM appointment WHERE id = $1', [a.id])
    }
  }

  async listMine(patient: Patient, scope: string | null): Promise<AppointmentView[]> {
    const today = this.today()
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT * FROM appointment WHERE patient_id = $1 AND status <> 'held'`,
      [patient.id],
    )
    const mine = rows.map(toAppointment)
    const isUpcoming = (a: Appointment) => ACTIVE_STATUSES.has(a.status) && a.date >= today
    const key = (a: Appointment) => `${a.date} ${a.start}`
    const filtered =
      scope === 'past'
        ? mine.filter((a) => !isUpcoming(a)).sort((a, b) => key(b).localeCompare(key(a)))
        : mine.filter(isUpcoming).sort((a, b) => key(a).localeCompare(key(b)))
    return this.buildViews(filtered)
  }

  async cancel(patient: Patient, id: string): Promise<AppointmentView> {
    const a = await this.ownAppointment(patient, id)
    if (a.status !== 'booked') {
      fail('VALIDATION', 'Only a booked appointment can be cancelled.')
    }
    const { rows } = await this.db.query<AppointmentRow>(
      `UPDATE appointment
       SET status = 'cancelled', cancel_reason = 'patient'
       WHERE id = $1
       RETURNING *`,
      [a.id],
    )
    const cancelled = toAppointment(rows[0]!)
    await this.notifyAppointment('cancellation', cancelled)
    await this.broadcastQueue(cancelled.doctorId, cancelled.date)
    const [view] = await this.buildViews([cancelled])
    return view!
  }

  async queueStatus(patient: Patient, id: string): Promise<QueueStatus> {
    const a = await this.ownAppointment(patient, id)
    const doctor = await this.doctorOr404(a.doctorId, false)
    const rule = daySlots(doctor, a.date).find((s) => s.start === a.start)?.rule
    const slotMinutes = rule?.slotMinutes ?? toMinutes(a.end) - toMinutes(a.start)
    const entries = (await this.appointmentsForDoctor(a.doctorId, a.date)).filter(
      (e) => e.status !== 'held',
    )
    const position = queuePosition(entries, a, {
      date: a.date,
      today: this.today(),
      nowMinutes: dhakaMinutes(this.now()),
      slotMinutes,
    })
    return {
      appointmentId: a.id,
      doctorId: a.doctorId,
      date: a.date,
      serial: a.serial,
      status: a.status,
      sessionStart: rule?.start ?? a.start,
      slotMinutes,
      ...position,
    }
  }

  // ---------------------------------------------------------------- staff auth

  async staffLogin(
    body: { username?: unknown; password?: unknown },
    clientIp = 'unknown',
  ): Promise<{ sessionId: string; user: StaffUser }> {
    const username = String(body.username ?? '')
      .trim()
      .toLowerCase()
    const password = String(body.password ?? '')
    this.checkRateLimit(`staff-login:${clientIp}:${username}`, 15, 15 * 60_000)

    const { rows } = await this.db.query<StaffRow>(
      'SELECT * FROM staff_user WHERE username = $1 AND active = true',
      [username],
    )
    const account = rows[0]
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      fail('UNAUTHENTICATED', 'Wrong username or password.')
    }
    const sessionId = randomBytes(24).toString('hex')
    const expiresAt = new Date(this.now().getTime() + 12 * 60 * 60_000).toISOString()
    await this.db.query(
      `INSERT INTO user_session (id, kind, subject_id, expires_at, created_at)
       VALUES ($1, 'staff', $2, $3, $4)`,
      [sessionId, account.id, expiresAt, this.now().toISOString()],
    )
    return { sessionId, user: toStaffUser(account) }
  }

  async staffForSession(sessionId: string | undefined, roles?: StaffRole[]): Promise<StaffUser> {
    if (!sessionId) fail('UNAUTHENTICATED')
    const { rows } = await this.db.query<StaffRow & { expires_at: unknown }>(
      `SELECT u.*, s.expires_at
       FROM user_session s
       JOIN staff_user u ON u.id = s.subject_id
       WHERE s.id = $1 AND s.kind = 'staff'`,
      [sessionId],
    )
    const row = rows[0]
    if (!row || !row.active || Date.parse(asIso(row.expires_at)) <= this.now().getTime()) {
      fail('UNAUTHENTICATED')
    }
    if (roles && !roles.includes(row.role)) fail('FORBIDDEN')
    return toStaffUser(row)
  }

  // ---------------------------------------------------------------- admin

  async listAllSpecialties(): Promise<Specialty[]> {
    const { rows } = await this.db.query<SpecialtyRow>(
      'SELECT * FROM specialty ORDER BY sort_order ASC, name_en ASC',
    )
    return rows.map(toSpecialty)
  }

  private async validateSpecialty(input: Partial<SpecialtyInput>) {
    const name = {
      en: String(input.name?.en ?? '').trim(),
      bn: String(input.name?.bn ?? '').trim(),
    }
    if (!name.en || !name.bn) fail('VALIDATION', 'Enter the name in English and Bangla.')
    const { rows } = await this.db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM specialty',
    )
    return {
      name,
      description: {
        en: String(input.description?.en ?? '').trim(),
        bn: String(input.description?.bn ?? '').trim(),
      },
      sortOrder: Number(input.sortOrder) || Number(rows[0]?.count ?? 0) + 1,
      active: input.active !== false,
    }
  }

  async createSpecialty(input: Partial<SpecialtyInput>): Promise<Specialty> {
    const fields = await this.validateSpecialty(input)
    const id =
      (input.id && input.id.trim()) ||
      fields.name.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      `sp-${randomBytes(4).toString('hex')}`
    try {
      const { rows } = await this.db.query<SpecialtyRow>(
        `INSERT INTO specialty (id, name_en, name_bn, description_en, description_bn, sort_order, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          fields.name.en,
          fields.name.bn,
          fields.description.en,
          fields.description.bn,
          fields.sortOrder,
          fields.active,
        ],
      )
      return toSpecialty(rows[0]!)
    } catch (err) {
      if (isPgUniqueViolation(err)) fail('VALIDATION', 'A specialty with this name already exists.')
      throw err
    }
  }

  async updateSpecialty(id: string, input: Partial<SpecialtyInput>): Promise<Specialty> {
    const fields = await this.validateSpecialty(input)
    const { rows } = await this.db.query<SpecialtyRow>(
      `UPDATE specialty
       SET name_en = $2, name_bn = $3, description_en = $4, description_bn = $5, sort_order = $6, active = $7
       WHERE id = $1
       RETURNING *`,
      [
        id,
        fields.name.en,
        fields.name.bn,
        fields.description.en,
        fields.description.bn,
        fields.sortOrder,
        fields.active,
      ],
    )
    if (!rows[0]) fail('NOT_FOUND', 'Specialty not found.')
    return toSpecialty(rows[0])
  }

  async listAllDoctors(): Promise<Doctor[]> {
    return this.loadDoctors(this.db)
  }

  private async validateDoctorInput(input: Partial<DoctorInput>) {
    const name = {
      en: String(input.name?.en ?? '').trim(),
      bn: String(input.name?.bn ?? '').trim(),
    }
    if (!name.en || !name.bn) fail('VALIDATION', 'Enter the doctor’s name in English and Bangla.')
    const specialtyId = String(input.specialtyId ?? '')
    const { rows: sp } = await this.db.query<{ id: string }>(
      'SELECT id FROM specialty WHERE id = $1',
      [specialtyId],
    )
    if (!sp[0]) fail('VALIDATION', 'Choose a specialty.')
    const fee = Number(input.fee)
    if (!Number.isInteger(fee) || fee < 0) fail('VALIDATION', 'Enter the fee in whole taka.')
    const schedule = (input.schedule ?? []).map((r, i) => {
      const weekday = Number(r.weekday)
      const slotMinutes = Number(r.slotMinutes)
      const maxPatients = Number(r.maxPatients)
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        fail('VALIDATION', `Chamber ${i + 1}: choose a day.`)
      }
      if (!isValidTime(r.start) || !isValidTime(r.end) || toMinutes(r.start) >= toMinutes(r.end)) {
        fail('VALIDATION', `Chamber ${i + 1}: the end time must be after the start time.`)
      }
      if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 120) {
        fail('VALIDATION', `Chamber ${i + 1}: slot length must be 5–120 minutes.`)
      }
      if (!Number.isInteger(maxPatients) || maxPatients < 1 || maxPatients > 100) {
        fail('VALIDATION', `Chamber ${i + 1}: patient limit must be 1–100.`)
      }
      return {
        id: r.id && UUID_RE.test(r.id) ? r.id : undefined,
        weekday: weekday as Weekday,
        start: r.start,
        end: r.end,
        slotMinutes,
        maxPatients,
        room: String(r.room ?? '').trim(),
      }
    })
    return {
      name,
      specialtyId,
      designation: {
        en: String(input.designation?.en ?? '').trim(),
        bn: String(input.designation?.bn ?? '').trim(),
      },
      qualifications: String(input.qualifications ?? '').trim(),
      experienceYears: Math.max(0, Number(input.experienceYears) || 0),
      fee,
      gender: input.gender === 'female' ? ('female' as const) : ('male' as const),
      active: input.active !== false,
      schedule,
    }
  }

  async createDoctor(input: Partial<DoctorInput>): Promise<Doctor> {
    const v = await this.validateDoctorInput(input)
    const id = await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO doctor (name_en, name_bn, specialty_id, designation_en, designation_bn, qualifications, experience_years, fee, gender, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          v.name.en,
          v.name.bn,
          v.specialtyId,
          v.designation.en,
          v.designation.bn,
          v.qualifications,
          v.experienceYears,
          v.fee,
          v.gender,
          v.active,
        ],
      )
      const doctorId = rows[0]!.id
      for (const r of v.schedule) {
        await tx.query(
          `INSERT INTO schedule_rule (doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [doctorId, r.weekday, r.start, r.end, r.slotMinutes, r.maxPatients, r.room],
        )
      }
      return doctorId
    })
    return this.doctorOr404(id, false)
  }

  async updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
    await this.doctorOr404(id, false)
    const v = await this.validateDoctorInput(input)
    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE doctor
         SET name_en = $2, name_bn = $3, specialty_id = $4, designation_en = $5, designation_bn = $6,
             qualifications = $7, experience_years = $8, fee = $9, gender = $10, active = $11
         WHERE id = $1`,
        [
          id,
          v.name.en,
          v.name.bn,
          v.specialtyId,
          v.designation.en,
          v.designation.bn,
          v.qualifications,
          v.experienceYears,
          v.fee,
          v.gender,
          v.active,
        ],
      )
      await tx.query('DELETE FROM schedule_rule WHERE doctor_id = $1', [id])
      for (const r of v.schedule) {
        if (r.id) {
          await tx.query(
            `INSERT INTO schedule_rule (id, doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [r.id, id, r.weekday, r.start, r.end, r.slotMinutes, r.maxPatients, r.room],
          )
        } else {
          await tx.query(
            `INSERT INTO schedule_rule (doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, r.weekday, r.start, r.end, r.slotMinutes, r.maxPatients, r.room],
          )
        }
      }
    })
    return this.doctorOr404(id, false)
  }

  async listLeaveDays(doctorId: string | null): Promise<LeaveDay[]> {
    const today = this.today()
    const sql =
      doctorId && UUID_RE.test(doctorId)
        ? 'SELECT * FROM leave_day WHERE doctor_id = $1'
        : 'SELECT * FROM leave_day'
    const params = doctorId && UUID_RE.test(doctorId) ? [doctorId] : []
    const { rows } = await this.db.query<LeaveDayRow>(sql, params)
    const list = rows.map(toLeaveDay)
    const upcoming = list
      .filter((l) => l.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const past = list.filter((l) => l.date < today).sort((a, b) => b.date.localeCompare(a.date))
    return [...upcoming, ...past]
  }

  async leaveImpact(doctorId: string, date: string): Promise<{ appointments: number }> {
    await this.doctorOr404(doctorId, false)
    if (!isValidDate(date)) return { appointments: 0 }
    const now = this.now()
    const appts = await this.appointmentsForDoctor(doctorId, date)
    const count = appts.filter(
      (a) => ACTIVE_STATUSES.has(a.status) || (a.status === 'held' && occupiesSlot(a, now)),
    ).length
    return { appointments: count }
  }

  async addLeaveDay(body: { doctorId?: unknown; date?: unknown; reason?: unknown }): Promise<{
    leaveDay: LeaveDay
    cancelled: number
    smsSent: number
  }> {
    const doctor = await this.doctorOr404(String(body.doctorId ?? ''), false)
    const date = String(body.date ?? '')
    if (!isValidDate(date) || date < this.today()) {
      fail('VALIDATION', 'Choose today or a later date.')
    }
    const reason = String(body.reason ?? '').trim()

    const { leaveDay, cancelledAppts } = await this.db.transaction(async (tx) => {
      let inserted: LeaveDayRow
      try {
        const { rows } = await tx.query<LeaveDayRow>(
          `INSERT INTO leave_day (doctor_id, date, reason) VALUES ($1, $2, $3) RETURNING *`,
          [doctor.id, date, reason],
        )
        inserted = rows[0]!
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          fail('VALIDATION', 'The doctor is already on leave that day.')
        }
        throw err
      }

      // Drop active holds and cancel active bookings in the same transaction.
      await tx.query(
        `DELETE FROM appointment WHERE doctor_id = $1 AND date = $2 AND status = 'held'`,
        [doctor.id, date],
      )
      const { rows: updatedRows } = await tx.query<AppointmentRow>(
        `UPDATE appointment
         SET status = 'cancelled', cancel_reason = 'leave_day'
         WHERE doctor_id = $1 AND date = $2
           AND status IN ('booked', 'arrived', 'in_consultation')
         RETURNING *`,
        [doctor.id, date],
      )
      await tx.query(
        `UPDATE queue_state SET now_serving_id = NULL, updated_at = $3
         WHERE doctor_id = $1 AND date = $2`,
        [doctor.id, date, this.now().toISOString()],
      )
      return { leaveDay: toLeaveDay(inserted), cancelledAppts: updatedRows.map(toAppointment) }
    })

    for (const a of cancelledAppts) {
      await this.notifyAppointment('cancellation', a, true)
    }
    await this.broadcastQueue(doctor.id, date)
    return { leaveDay, cancelled: cancelledAppts.length, smsSent: cancelledAppts.length }
  }

  async removeLeaveDay(id: string): Promise<void> {
    this.assertUuid(id, 'Leave day')
    const { rowCount } = await this.db.query('DELETE FROM leave_day WHERE id = $1', [id])
    if (rowCount === 0) fail('NOT_FOUND', 'Leave day not found.')
  }

  async getSettings(): Promise<Settings> {
    return this.loadSettings()
  }

  async putSettings(body: Partial<Settings>): Promise<Settings> {
    const current = await this.loadSettings()
    const daysBefore = Number(body.reminder?.daysBefore)
    const time = String(body.reminder?.time ?? '')
    const openDays = Number(body.booking?.openDays)
    const closeMinutesBefore = Number(
      body.booking?.closeMinutesBefore ?? current.booking.closeMinutesBefore,
    )
    if (daysBefore !== 0 && daysBefore !== 1) {
      fail('VALIDATION', 'Reminders go the day before or on the day.')
    }
    if (!isValidTime(time)) fail('VALIDATION', 'Enter the reminder time as HH:mm.')
    if (!Number.isInteger(openDays) || openDays < 1 || openDays > 60) {
      fail('VALIDATION', 'Booking window must be 1–60 days.')
    }
    if (
      !Number.isInteger(closeMinutesBefore) ||
      closeMinutesBefore < 0 ||
      closeMinutesBefore > 240
    ) {
      fail('VALIDATION', 'Online booking must close 0–240 minutes before a session.')
    }
    const settings: Settings = {
      reminder: { daysBefore: daysBefore as 0 | 1, time },
      booking: { openDays, closeMinutesBefore },
    }
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO setting (key, value) VALUES ('reminder', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(settings.reminder)],
      )
      await tx.query(
        `INSERT INTO setting (key, value) VALUES ('booking', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(settings.booking)],
      )
    })
    return settings
  }

  async listSms(limit = 100): Promise<SmsMessage[]> {
    const safeLimit = Math.min(Math.max(limit || 100, 1), 500)
    const { rows } = await this.db.query<SmsRow>(
      `SELECT id, phone, kind, body, appointment_id, status, sent_at
       FROM sms_message
       ORDER BY sent_at DESC, id DESC
       LIMIT $1`,
      [safeLimit],
    )
    return rows.map(toSmsMessage)
  }

  async listStaff(): Promise<StaffUser[]> {
    const { rows } = await this.db.query<StaffRow>(
      'SELECT * FROM staff_user ORDER BY role ASC, name ASC',
    )
    return rows.map(toStaffUser)
  }

  async createStaff(body: {
    name?: unknown
    username?: unknown
    password?: unknown
    role?: unknown
    doctorId?: unknown
  }): Promise<StaffUser> {
    const name = String(body.name ?? '').trim()
    const username = String(body.username ?? '')
      .trim()
      .toLowerCase()
    const password = String(body.password ?? '')
    const role = body.role as StaffRole
    if (!name) fail('VALIDATION', 'Enter a name.')
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      fail('VALIDATION', 'Username: 3–30 letters, digits, dots or dashes.')
    }
    if (password.length < 6) fail('VALIDATION', 'The password needs at least 6 characters.')
    if (!['admin', 'front_desk', 'doctor'].includes(role)) fail('VALIDATION', 'Choose a role.')
    let doctorId: string | null = null
    if (role === 'doctor') {
      const doc = await this.doctorOr404(String(body.doctorId ?? ''), false).catch(() =>
        fail('VALIDATION', 'Choose the doctor this account belongs to.'),
      )
      doctorId = doc.id
    }
    const hash = await bcrypt.hash(password, 10)
    try {
      const { rows } = await this.db.query<StaffRow>(
        `INSERT INTO staff_user (name, username, password_hash, role, doctor_id, active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [name, username, hash, role, doctorId],
      )
      return toStaffUser(rows[0]!)
    } catch (err) {
      if (isPgUniqueViolation(err)) fail('VALIDATION', 'That username is taken.')
      throw err
    }
  }

  // ---------------------------------------------------------------- front desk & doctor

  async daySheet(doctorId: string, date: string): Promise<DaySheet> {
    const doctor = await this.doctorOr404(doctorId, false)
    if (!isValidDate(date)) fail('VALIDATION', 'Choose a date.')
    const [day] = await this.availabilityFor(doctor, date, 1, false)
    const appts = (await this.appointmentsForDoctor(doctor.id, date)).filter(
      (a) => a.status !== 'held',
    )
    const views = await this.buildViews(appts, { withPatient: true })

    // Earlier seen visits to this doctor per patient.
    const patientIds = [...new Set(appts.map((a) => a.patientId))]
    const prevMap = new Map<string, { count: number; last: string | null }>()
    if (patientIds.length > 0) {
      const { rows } = await this.db.query<{
        patient_id: string
        visit_count: string
        last_visit: unknown | null
      }>(
        `SELECT patient_id, count(*)::text AS visit_count, max(date) AS last_visit
         FROM appointment
         WHERE doctor_id = $1 AND status = 'seen' AND date < $2 AND patient_id = ANY($3::uuid[])
         GROUP BY patient_id`,
        [doctor.id, date, patientIds],
      )
      for (const r of rows) {
        prevMap.set(r.patient_id, {
          count: Number(r.visit_count),
          last: r.last_visit ? asDate(r.last_visit) : null,
        })
      }
    }

    return {
      doctorId: doctor.id,
      date,
      onLeave: day?.onLeave ?? false,
      sessions: day?.sessions ?? [],
      nowServing: appts.find((a) => a.status === 'in_consultation')?.serial ?? null,
      appointments: views.map((v) => ({
        ...v,
        previousVisits: prevMap.get(v.patientId) ?? { count: 0, last: null },
      })),
    }
  }

  async setStatus(id: string, body: { status?: unknown }): Promise<AppointmentView> {
    this.assertUuid(id, 'Appointment')
    const status = body.status as AppointmentStatus
    const allowed: Record<string, AppointmentStatus[]> = {
      // A patient marked no-show who turns up late can be checked in again.
      arrived: ['booked', 'no_show'],
      seen: ['arrived', 'in_consultation'],
      no_show: ['booked', 'arrived'],
    }
    const updated = await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<AppointmentRow>('SELECT * FROM appointment WHERE id = $1', [
        id,
      ])
      if (!rows[0]) fail('NOT_FOUND', 'Appointment not found.')
      const a = toAppointment(rows[0])
      if (!allowed[status]?.includes(a.status)) {
        fail(
          'VALIDATION',
          `Cannot mark a ${a.status.replace('_', ' ')} patient as ${String(status).replace('_', ' ')}.`,
        )
      }
      const { rows: nextRows } = await tx.query<AppointmentRow>(
        'UPDATE appointment SET status = $2 WHERE id = $1 RETURNING *',
        [a.id, status],
      )
      if (a.status === 'in_consultation') {
        await tx.query(
          `INSERT INTO queue_state (doctor_id, date, now_serving_id, updated_at)
           VALUES ($1, $2, NULL, $3)
           ON CONFLICT (doctor_id, date) DO UPDATE
           SET now_serving_id = NULL, updated_at = EXCLUDED.updated_at`,
          [a.doctorId, a.date, this.now().toISOString()],
        )
      }
      return toAppointment(nextRows[0]!)
    })

    await this.broadcastQueue(updated.doctorId, updated.date)
    const [view] = await this.buildViews([updated], { withPatient: true })
    return view!
  }

  async callNext(body: { doctorId?: unknown; date?: unknown }): Promise<DaySheet> {
    const doctor = await this.doctorOr404(String(body.doctorId ?? ''), false)
    const date = String(body.date ?? '')
    if (!isValidDate(date)) fail('VALIDATION', 'Choose a date.')
    const nowIso = this.now().toISOString()

    await this.db.transaction(async (tx) => {
      const entries = await this.appointmentsForDoctor(doctor.id, date, tx)
      for (const cur of entries.filter((a) => a.status === 'in_consultation')) {
        await tx.query(`UPDATE appointment SET status = 'seen' WHERE id = $1`, [cur.id])
      }
      const next = nextToCall(entries.filter((a) => a.status !== 'in_consultation'))
      let servingId: string | null = null
      if (next) {
        await tx.query(
          `UPDATE appointment SET status = 'in_consultation', called_at = $2 WHERE id = $1`,
          [next.id, nowIso],
        )
        servingId = next.id
      }
      await tx.query(
        `INSERT INTO queue_state (doctor_id, date, now_serving_id, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (doctor_id, date) DO UPDATE
         SET now_serving_id = EXCLUDED.now_serving_id, updated_at = EXCLUDED.updated_at`,
        [doctor.id, date, servingId, nowIso],
      )
    })

    await this.broadcastQueue(doctor.id, date)
    return this.daySheet(doctor.id, date)
  }

  async findPatient(phone: string | null): Promise<Patient> {
    const normalized =
      normalizePhone(phone ?? '') ?? fail('VALIDATION', 'Enter a valid mobile number.')
    const { rows } = await this.db.query<PatientRow>('SELECT * FROM patient WHERE phone = $1', [
      normalized,
    ])
    if (!rows[0]) fail('NOT_FOUND', 'No patient with this number.')
    return toPatient(rows[0])
  }

  async createPatient(body: {
    name?: unknown
    phone?: unknown
    age?: unknown
    sex?: unknown
  }): Promise<Patient> {
    const phone =
      normalizePhone(String(body.phone ?? '')) ?? fail('VALIDATION', 'Enter a valid mobile number.')
    const person = this.validatePerson(body)
    try {
      const { rows } = await this.db.query<PatientRow>(
        `INSERT INTO patient (name, phone, age, sex, registered_by)
         VALUES ($1, $2, $3, $4, 'front_desk')
         RETURNING *`,
        [person.name, phone, person.age, person.sex],
      )
      return toPatient(rows[0]!)
    } catch (err) {
      if (isPgUniqueViolation(err)) fail('VALIDATION', 'This number is already registered.')
      throw err
    }
  }

  async bookForPatient(body: {
    patientId?: unknown
    doctorId?: unknown
    date?: unknown
    start?: unknown
    source?: unknown
  }): Promise<AppointmentView> {
    const patientId = this.assertUuid(String(body.patientId ?? ''), 'Patient')
    const { rows: pRows } = await this.db.query<PatientRow>('SELECT * FROM patient WHERE id = $1', [
      patientId,
    ])
    if (!pRows[0]) fail('NOT_FOUND', 'Patient not found.')
    const doctor = await this.doctorOr404(String(body.doctorId ?? ''), true)
    const date = String(body.date ?? '')
    const start = String(body.start ?? '')
    const source = body.source as AppointmentSource
    if (source !== 'phone' && source !== 'walk_in') fail('VALIDATION', 'Choose phone or walk-in.')
    if (!isValidDate(date) || !isValidTime(start)) fail('VALIDATION', 'Choose a date and time.')

    const now = this.now()
    const settings = await this.loadSettings()

    const created = await this.db.transaction(async (tx) => {
      await tx.query(
        `DELETE FROM appointment
         WHERE doctor_id = $1 AND date = $2 AND start_time = $3
           AND status = 'held' AND hold_expires_at <= $4`,
        [doctor.id, date, start, now.toISOString()],
      )
      const [leaveDates, dayAppts] = await Promise.all([
        this.leaveDatesFor(doctor.id, tx),
        this.appointmentsForDoctor(doctor.id, date, tx),
      ])
      const check = checkSlot({
        doctor,
        date,
        start,
        leaveDates,
        appointments: dayAppts,
        now,
        openDays: settings.booking.openDays,
      })
      if (!check.ok) return this.slotError(check.code)

      try {
        const { rows } = await tx.query<AppointmentRow>(
          `INSERT INTO appointment (
             patient_id, doctor_id, date, start_time, end_time, serial, status, source, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'booked', $7, $8)
           RETURNING *`,
          [
            patientId,
            doctor.id,
            date,
            start,
            check.slot.end,
            check.slot.serial,
            source,
            now.toISOString(),
          ],
        )
        return toAppointment(rows[0]!)
      } catch (err) {
        if (isPgUniqueViolation(err)) fail('SLOT_TAKEN')
        throw err
      }
    })

    await this.notifyAppointment('confirmation', created)
    await this.broadcastQueue(doctor.id, date)
    const [view] = await this.buildViews([created], { withPatient: true })
    return view!
  }

  async doctorDay(user: StaffUser, date: string | null): Promise<DaySheet> {
    if (!user.doctorId) fail('FORBIDDEN', 'This account is not linked to a doctor.')
    return this.daySheet(user.doctorId, date && isValidDate(date) ? date : this.today())
  }

  // ---------------------------------------------------------------- analytics

  async analytics(fromQuery: string | null, toQuery: string | null): Promise<AnalyticsSummary> {
    const today = this.today()
    const to = toQuery && isValidDate(toQuery) ? toQuery : today
    const from = fromQuery && isValidDate(fromQuery) ? fromQuery : addDays(to, -29)
    if (daysBetween(from, to) < 0) fail('VALIDATION', 'The start date must be before the end date.')

    const { rows: apptRows } = await this.db.query<{
      date: unknown
      start_time: unknown
      status: AppointmentStatus
      specialty_id: string
    }>(
      `SELECT a.date, a.start_time, a.status, d.specialty_id
       FROM appointment a
       JOIN doctor d ON d.id = a.doctor_id
       WHERE a.status <> 'held' AND a.date >= $1 AND a.date <= $2`,
      [from, to],
    )

    const kept = apptRows.filter((a) => a.status !== 'cancelled')
    const seen = apptRows.filter((a) => a.status === 'seen').length
    const noShows = apptRows.filter((a) => a.status === 'no_show').length

    const bySpecialty = new Map<string, number>()
    const byHour = new Map<number, number>()
    const byDay = new Map<string, number>()
    for (const r of kept) {
      bySpecialty.set(r.specialty_id, (bySpecialty.get(r.specialty_id) ?? 0) + 1)
      const hr = Number(asTime(r.start_time).slice(0, 2))
      byHour.set(hr, (byHour.get(hr) ?? 0) + 1)
      const d = asDate(r.date)
      byDay.set(d, (byDay.get(d) ?? 0) + 1)
    }

    const { rows: triageRows } = await this.db.query<{
      tags: string[] | null
      created_at: unknown
    }>(
      `SELECT tags, created_at FROM triage_session
       WHERE created_at >= ($1::date - interval '1 day') AND created_at <= ($2::date + interval '2 days')`,
      [from, to],
    )
    const tagCounts = new Map<string, number>()
    for (const t of triageRows) {
      const d = dhakaDate(new Date(asIso(t.created_at)))
      if (d < from || d > to) continue
      for (const tag of t.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }

    const days: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)

    return {
      from,
      to,
      totalBookings: apptRows.length,
      seen,
      noShows,
      cancelled: apptRows.length - kept.length,
      noShowRate: seen + noShows ? noShows / (seen + noShows) : 0,
      bySpecialty: [...bySpecialty]
        .map(([specialtyId, count]) => ({ specialtyId, count }))
        .sort((a, b) => b.count - a.count),
      byHour: [...byHour].map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour),
      byDay: days.map((date) => ({ date, count: byDay.get(date) ?? 0 })),
      commonProblems: [...tagCounts]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }
  }

  // ---------------------------------------------------------------- scheduler tasks

  async clearExpiredHolds(): Promise<number> {
    const { rowCount } = await this.db.query(
      `DELETE FROM appointment WHERE status = 'held' AND hold_expires_at <= $1`,
      [this.now().toISOString()],
    )
    return rowCount
  }

  async cleanupExpiredAuth(): Promise<void> {
    const nowIso = this.now().toISOString()
    const cutoff = new Date(this.now().getTime() - 24 * 60 * 60_000).toISOString()
    await this.db.query('DELETE FROM user_session WHERE expires_at <= $1', [nowIso])
    await this.db.query('DELETE FROM otp_code WHERE created_at <= $1', [cutoff])
  }

  /** Sends reminder SMS for appointments whose reminder time has arrived and haven't been reminded yet. */
  async sendDueReminders(): Promise<number> {
    const settings = await this.loadSettings()
    const now = this.now()
    const today = dhakaDate(now)
    const nowMin = dhakaMinutes(now)
    const targetMin = toMinutes(settings.reminder.time)
    if (nowMin < targetMin) return 0

    const targetDate = addDays(today, settings.reminder.daysBefore)
    const { rows } = await this.db.query<AppointmentRow>(
      `SELECT a.*
       FROM appointment a
       WHERE a.date = $1
         AND a.status = 'booked'
         AND NOT EXISTS (
           SELECT 1 FROM sms_message m
           WHERE m.appointment_id = a.id AND m.kind = 'reminder' AND m.status = 'sent'
         )`,
      [targetDate],
    )
    let sent = 0
    for (const r of rows) {
      const a = toAppointment(r)
      // Don't send same-day reminders for slots that already started.
      if (targetDate === today && toMinutes(a.start) <= nowMin) continue
      await this.notifyAppointment('reminder', a)
      sent++
    }
    return sent
  }
}
