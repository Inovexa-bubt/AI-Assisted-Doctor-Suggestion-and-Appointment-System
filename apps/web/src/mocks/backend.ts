// The mock API's business logic: every endpoint in docs/design/api.md as a method on an in-memory
// database. No browser APIs here, so it can be tested in Node. handlers.ts maps HTTP onto it.

import {
  type AnalyticsSummary,
  type Appointment,
  type AppointmentSource,
  type AppointmentStatus,
  type AppointmentView,
  type AvailabilityDay,
  type DaySheet,
  type Doctor,
  type DoctorInput,
  type DoctorListItem,
  type DoctorSuggestion,
  type ErrorCode,
  type Lang,
  type LeaveDay,
  type Patient,
  type QueueStatus,
  type Settings,
  type Sex,
  type SmsKind,
  type SmsMessage,
  type Specialty,
  type SpecialtyInput,
  type StaffAccount,
  type StaffRole,
  type StaffUser,
  type TriageResult,
  type TriageSession,
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
  queuePosition,
  runMockTriage,
  smsBody,
  toMinutes,
} from '@inovexa/shared'
import { type Collections, type MockDb, queueId } from './db.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode

  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const STATUS_FOR: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  DOCTOR_ON_LEAVE: 409,
  SLOT_IN_PAST: 409,
  HOLD_EXPIRED: 410,
  OTP_INVALID: 422,
  OTP_EXPIRED: 422,
  TOO_MANY_ATTEMPTS: 429,
}

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  SLOT_TAKEN: 'Someone else just took this slot.',
  DOCTOR_ON_LEAVE: 'The doctor is on leave that day.',
  SLOT_IN_PAST: 'This slot has already started.',
  HOLD_EXPIRED: 'The 5-minute hold on this slot has expired.',
  NOT_FOUND: 'Not found.',
}

const fail = (code: ErrorCode, message = MESSAGES[code] ?? code): never => {
  throw new ApiError(STATUS_FOR[code], code, message)
}

const ACTIVE: ReadonlySet<AppointmentStatus> = new Set(['booked', 'arrived', 'in_consultation'])

const SAMPLE_TRANSCRIPTS: Record<Lang, string> = {
  en: 'I have had a headache and dizziness for three days',
  bn: 'তিন দিন ধরে মাথাব্যথা আর মাথা ঘোরা',
}

export interface BackendOptions {
  now?: () => Date
  random?: () => number
  /** Called after any change to a doctor's queue for a date. */
  onQueueChanged?: (doctorId: string, date: string) => void
}

type TriageRow = Collections['triage']

export class MockBackend {
  private readonly now: () => Date
  private readonly random: () => number
  private readonly onQueueChanged: (doctorId: string, date: string) => void
  private readonly db: MockDb

  constructor(db: MockDb, options: BackendOptions = {}) {
    this.db = db
    this.now = options.now ?? (() => new Date())
    this.random = options.random ?? Math.random
    this.onQueueChanged = options.onQueueChanged ?? (() => {})
  }

  // ---------------------------------------------------------------- helpers

  private id(prefix: string) {
    return `${prefix}_${this.now().getTime().toString(36)}${Math.floor(this.random() * 1e8).toString(36)}`
  }

  private today() {
    return dhakaDate(this.now())
  }

  private openDays() {
    return this.db.settings().booking.openDays
  }

  private doctorOr404(id: string, activeOnly = true): Doctor {
    const doctor = this.db.get('doctors', id)
    if (!doctor || (activeOnly && !doctor.active)) return fail('NOT_FOUND', 'Doctor not found.')
    return doctor
  }

  private leaveDates(doctorId: string): string[] {
    return this.db
      .all('leaveDays')
      .filter((l) => l.doctorId === doctorId)
      .map((l) => l.date)
  }

  private appointmentsOf(doctorId: string, date?: string): Appointment[] {
    return this.db
      .all('appointments')
      .filter((a) => a.doctorId === doctorId && (date === undefined || a.date === date))
  }

  private roomFor(doctor: Doctor, date: string, start: string): string | undefined {
    return (
      daySlots(doctor, date).find((s) => s.start === start)?.rule.room ?? doctor.schedule[0]?.room
    )
  }

  private view(a: Appointment, withPatient = false): AppointmentView {
    const doctor = this.db.get('doctors', a.doctorId)!
    const summary = a.triageId ? this.db.get('triage', a.triageId)?.summary : undefined
    const room = this.roomFor(doctor, a.date, a.start)
    return {
      ...a,
      doctor,
      ...(withPatient ? { patient: this.db.get('patients', a.patientId) } : {}),
      ...(summary ? { summary } : {}),
      ...(room ? { room } : {}),
    }
  }

  private sendSms(kind: SmsKind, phone: string, body: string, appointmentId?: string) {
    const message: SmsMessage = {
      id: this.id('s'),
      phone,
      kind,
      body,
      status: 'sent',
      createdAt: this.now().toISOString(),
      ...(appointmentId ? { appointmentId } : {}),
    }
    this.db.put('sms', message)
  }

  private notifyAppointment(kind: Exclude<SmsKind, 'otp'>, a: Appointment, onLeave = false) {
    const patient = this.db.get('patients', a.patientId)
    const doctor = this.db.get('doctors', a.doctorId)
    if (!patient || !doctor) return
    const body = smsBody(kind, {
      doctorName: doctor.name.en,
      date: a.date,
      start: a.start,
      serial: a.serial,
      room: this.roomFor(doctor, a.date, a.start),
      onLeave,
    })
    this.sendSms(kind, patient.phone, body, a.id)
  }

  private update(a: Appointment, changes: Partial<Appointment>): Appointment {
    const next: Appointment = { ...a, ...changes }
    for (const key of Object.keys(changes) as Array<keyof Appointment>) {
      if (changes[key] === undefined) delete next[key]
    }
    return this.db.put('appointments', next)
  }

  /** Deletes holds that have expired, so they stop blocking their slot. */
  private clearExpiredHolds() {
    const now = this.now()
    for (const a of this.db.all('appointments')) {
      if (a.status === 'held' && !occupiesSlot(a, now)) this.db.remove('appointments', a.id)
    }
  }

  private slotError(code: ErrorCode): never {
    return fail(code, code === 'VALIDATION' ? 'That slot is not bookable.' : undefined)
  }

  // ---------------------------------------------------------------- public

  listSpecialties(): Specialty[] {
    return this.db
      .all('specialties')
      .filter((s) => s.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  listDoctors(query: { specialtyId?: string; q?: string }): DoctorListItem[] {
    const q = normalizeText(query.q ?? '')
    const specialties = new Map(this.db.all('specialties').map((s) => [s.id, s]))
    const today = this.today()
    return this.db
      .all('doctors')
      .filter((d) => d.active)
      .filter((d) => !query.specialtyId || d.specialtyId === query.specialtyId)
      .filter((d) => {
        if (!q) return true
        const specialty = specialties.get(d.specialtyId)
        return [d.name.en, d.name.bn, specialty?.name.en ?? '', specialty?.name.bn ?? '']
          .map(normalizeText)
          .some((text) => text.includes(q))
      })
      .map((d) => ({ ...d, nextSlot: openSlots(this.availabilityFor(d, today))[0] ?? null }))
  }

  getDoctor(id: string): Doctor {
    return this.doctorOr404(id)
  }

  private availabilityFor(doctor: Doctor, from: string, days = this.openDays()): AvailabilityDay[] {
    const today = this.today()
    const lastOpen = addDays(today, this.openDays() - 1)
    const result = availability({
      doctor,
      from,
      days,
      leaveDates: this.leaveDates(doctor.id),
      appointments: this.appointmentsOf(doctor.id),
      now: this.now(),
    })
    // Slots beyond the booking window are shown but not bookable.
    for (const day of result) {
      if (day.date > lastOpen)
        for (const s of day.sessions) for (const slot of s.slots) slot.available = false
    }
    return result
  }

  getAvailability(id: string, query: { from?: string; days?: number }): AvailabilityDay[] {
    const doctor = this.doctorOr404(id)
    const from = query.from && isValidDate(query.from) ? query.from : this.today()
    const days = Math.min(Math.max(query.days ?? this.openDays(), 1), 31)
    return this.availabilityFor(doctor, from, days)
  }

  // ---------------------------------------------------------------- AI assistant

  private publicTriage(t: TriageRow): TriageSession {
    return {
      id: t.id,
      lang: t.lang,
      problem: t.problem,
      answers: t.answers.map(({ question, answer }) => ({ question, answer })),
      status: t.status,
      tags: t.tags,
      ...(t.question ? { question: t.question } : {}),
      ...(t.quickReplies ? { quickReplies: t.quickReplies } : {}),
      ...(t.specialtyId ? { specialtyId: t.specialtyId } : {}),
      ...(t.urgency ? { urgency: t.urgency } : {}),
      ...(t.explanation ? { explanation: t.explanation } : {}),
      ...(t.emergencyMatches ? { emergencyMatches: t.emergencyMatches } : {}),
    }
  }

  private suggestionsFor(t: TriageRow): DoctorSuggestion[] {
    if (t.status !== 'complete' || !t.specialtyId) return []
    const today = this.today()
    const suggestions = this.db
      .all('doctors')
      .filter((d) => d.active && d.specialtyId === t.specialtyId)
      .map((doctor) => ({
        doctor,
        slots: openSlots(this.availabilityFor(doctor, today)).slice(0, 3),
      }))
      .filter((s) => s.slots.length > 0)
    const earliest = (s: DoctorSuggestion) => `${s.slots[0]!.date} ${s.slots[0]!.start}`
    return t.urgency === 'within_48h'
      ? suggestions.sort((a, b) => earliest(a).localeCompare(earliest(b)))
      : suggestions.sort((a, b) => b.doctor.experienceYears - a.doctor.experienceYears)
  }

  private advanceTriage(t: TriageRow): TriageResult {
    const outcome = runMockTriage({ problem: t.problem, lang: t.lang, answers: t.answers })
    const next: TriageRow = {
      id: t.id,
      lang: t.lang,
      problem: t.problem,
      answers: t.answers,
      tags: outcome.tags,
      status: outcome.status,
      createdAt: t.createdAt,
      ...(t.patientId ? { patientId: t.patientId } : {}),
    }
    if (outcome.status === 'emergency') next.emergencyMatches = outcome.emergencyMatches
    if (outcome.status === 'needs_answer') {
      next.question = outcome.question
      next.quickReplies = outcome.quickReplies
      next.pendingKind = outcome.kind
    }
    if (outcome.status === 'complete') {
      next.specialtyId = outcome.specialtyId
      next.urgency = outcome.urgency
      next.explanation = outcome.explanation
      next.summary = outcome.summary
    }
    this.db.put('triage', next)
    return { session: this.publicTriage(next), suggestions: this.suggestionsFor(next) }
  }

  startTriage(body: { problem?: unknown; lang?: unknown }): TriageResult {
    const problem = typeof body.problem === 'string' ? body.problem.trim() : ''
    if (!problem) fail('VALIDATION', 'Describe the problem first.')
    if (problem.length > 1000) fail('VALIDATION', 'Please keep it under 1000 characters.')
    const lang: Lang = body.lang === 'bn' ? 'bn' : 'en'
    return this.advanceTriage({
      id: this.id('t'),
      lang,
      problem,
      answers: [],
      tags: [],
      status: 'needs_answer',
      createdAt: this.now().toISOString(),
    })
  }

  answerTriage(id: string, body: { answer?: unknown }): TriageResult {
    const t = this.db.get('triage', id) ?? fail('NOT_FOUND', 'Conversation not found.')
    if (t.status !== 'needs_answer' || !t.pendingKind || !t.question) {
      fail('VALIDATION', 'This conversation is not waiting for an answer.')
    }
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (!answer) fail('VALIDATION', 'Type an answer first.')
    return this.advanceTriage({
      ...t,
      answers: [...t.answers, { kind: t.pendingKind!, question: t.question!, answer }],
    })
  }

  transcribe(lang: string | null): { text: string } {
    return { text: SAMPLE_TRANSCRIPTS[lang === 'bn' ? 'bn' : 'en'] }
  }

  // ---------------------------------------------------------------- patient sign-in

  requestOtp(body: { phone?: unknown }): { expiresInSeconds: number; demoCode: string } {
    const phone =
      normalizePhone(String(body.phone ?? '')) ??
      fail('VALIDATION', 'Enter a valid mobile number, like 01712345678.')
    const code = String(Math.floor(this.random() * 900_000) + 100_000)
    const expiresAt = new Date(this.now().getTime() + 5 * 60_000).toISOString()
    this.db.put('otps', { id: phone, code, expiresAt, attempts: 0 })
    this.sendSms('otp', phone, maskedOtpBody())
    return { expiresInSeconds: 300, demoCode: code }
  }

  verifyOtp(body: { phone?: unknown; code?: unknown }): {
    sessionId: string
    patient: Patient | null
    needsProfile: boolean
  } {
    const phone =
      normalizePhone(String(body.phone ?? '')) ?? fail('VALIDATION', 'Enter a valid mobile number.')
    const otp = this.db.get('otps', phone)
    if (!otp || Date.parse(otp.expiresAt) <= this.now().getTime()) {
      return fail('OTP_EXPIRED', 'The code has expired. Ask for a new one.')
    }
    if (otp.attempts >= 5)
      return fail('TOO_MANY_ATTEMPTS', 'Too many wrong codes. Ask for a new one.')
    if (String(body.code ?? '').trim() !== otp.code) {
      this.db.put('otps', { ...otp, attempts: otp.attempts + 1 })
      return fail('OTP_INVALID', 'That code is not right.')
    }
    this.db.remove('otps', phone)
    const patient = this.db.all('patients').find((p) => p.phone === phone) ?? null
    const sessionId = this.id('sess')
    this.db.put('sessions', { id: sessionId, kind: 'patient', subjectId: patient?.id ?? '', phone })
    return { sessionId, patient, needsProfile: !patient }
  }

  private validatePerson(body: { name?: unknown; age?: unknown; sex?: unknown }) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const age = Number(body.age)
    const sex = body.sex as Sex
    if (name.length < 2) fail('VALIDATION', 'Enter the patient’s name.')
    if (!Number.isInteger(age) || age < 0 || age > 120)
      fail('VALIDATION', 'Enter an age between 0 and 120.')
    if (!['female', 'male', 'other'].includes(sex))
      fail('VALIDATION', 'Choose female, male or other.')
    return { name, age, sex }
  }

  completeProfile(
    sessionId: string | undefined,
    body: { name?: unknown; age?: unknown; sex?: unknown },
  ): Patient {
    const session = sessionId ? this.db.get('sessions', sessionId) : undefined
    if (!session || session.kind !== 'patient' || !session.phone)
      return fail('UNAUTHENTICATED', 'Verify your phone number first.')
    const existing = this.db.all('patients').find((p) => p.phone === session.phone)
    const patient =
      existing ??
      this.db.put('patients', {
        id: this.id('p'),
        phone: session.phone,
        registeredBy: 'self',
        ...this.validatePerson(body),
      })
    this.db.put('sessions', { ...session, subjectId: patient.id })
    return patient
  }

  patientForSession(sessionId: string | undefined): Patient {
    const session = sessionId ? this.db.get('sessions', sessionId) : undefined
    const patient =
      session?.kind === 'patient' && session.subjectId
        ? this.db.get('patients', session.subjectId)
        : undefined
    return patient ?? fail('UNAUTHENTICATED', 'Please sign in.')
  }

  logout(sessionId: string | undefined) {
    if (sessionId) this.db.remove('sessions', sessionId)
  }

  // ---------------------------------------------------------------- patient appointments

  private ownAppointment(patient: Patient, id: string): Appointment {
    const a = this.db.get('appointments', id)
    return a && a.patientId === patient.id ? a : fail('NOT_FOUND', 'Appointment not found.')
  }

  hold(
    patient: Patient,
    body: {
      doctorId?: unknown
      date?: unknown
      start?: unknown
      triageId?: unknown
      rescheduleOf?: unknown
    },
  ): Appointment {
    const doctor = this.doctorOr404(String(body.doctorId ?? ''))
    const date = String(body.date ?? '')
    const start = String(body.start ?? '')
    if (!isValidDate(date) || !isValidTime(start)) fail('VALIDATION', 'Choose a date and time.')
    const now = this.now()

    // A repeated request (double click, page reload) gets the same hold back.
    const mine = this.db
      .all('appointments')
      .filter((a) => a.patientId === patient.id && a.status === 'held' && occupiesSlot(a, now))
    const same = mine.find((a) => a.doctorId === doctor.id && a.date === date && a.start === start)
    if (same) return same

    let rescheduleOf: Appointment | undefined
    if (body.rescheduleOf) {
      rescheduleOf = this.ownAppointment(patient, String(body.rescheduleOf))
      if (rescheduleOf.status !== 'booked')
        fail('VALIDATION', 'Only a booked appointment can be moved.')
    }
    let triageId: string | undefined
    if (body.triageId) {
      const t = this.db.get('triage', String(body.triageId))
      if (t && (!t.patientId || t.patientId === patient.id)) triageId = t.id
    }

    // One hold per patient at a time.
    for (const a of mine) this.db.remove('appointments', a.id)
    this.clearExpiredHolds()

    const check = checkSlot({
      doctor,
      date,
      start,
      leaveDates: this.leaveDates(doctor.id),
      appointments: this.appointmentsOf(doctor.id, date),
      now,
      openDays: this.openDays(),
    })
    if (!check.ok) return this.slotError(check.code)

    return this.db.put('appointments', {
      id: this.id('a'),
      patientId: patient.id,
      doctorId: doctor.id,
      date,
      start,
      end: check.slot.end,
      serial: check.slot.serial,
      status: 'held',
      source: 'online',
      holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString(),
      createdAt: now.toISOString(),
      ...(triageId ? { triageId } : {}),
      ...(rescheduleOf ? { rescheduledFromId: rescheduleOf.id } : {}),
    })
  }

  getAppointment(patient: Patient, id: string): AppointmentView {
    const a = this.ownAppointment(patient, id)
    if (a.status === 'held' && !occupiesSlot(a, this.now())) {
      this.db.remove('appointments', a.id)
      return fail('HOLD_EXPIRED')
    }
    const view = this.view(a)
    if (a.rescheduledFromId) {
      const old = this.db.get('appointments', a.rescheduledFromId)
      if (old) return { ...view, rescheduledFrom: this.view(old) }
    }
    return view
  }

  confirm(patient: Patient, id: string): AppointmentView {
    const a = this.ownAppointment(patient, id)
    if (a.status !== 'held')
      return fail('VALIDATION', 'This appointment is not waiting for confirmation.')
    if (!occupiesSlot(a, this.now())) {
      this.db.remove('appointments', a.id)
      return fail('HOLD_EXPIRED')
    }
    const booked = this.update(a, { status: 'booked', holdExpiresAt: undefined })
    if (booked.triageId) {
      const t = this.db.get('triage', booked.triageId)
      if (t && !t.patientId) this.db.put('triage', { ...t, patientId: patient.id })
    }
    const old = booked.rescheduledFromId
      ? this.db.get('appointments', booked.rescheduledFromId)
      : undefined
    if (old && old.status === 'booked') {
      this.update(old, { status: 'cancelled', cancelReason: 'rescheduled' })
      this.notifyAppointment('reschedule', booked)
      this.onQueueChanged(old.doctorId, old.date)
    } else {
      this.notifyAppointment('confirmation', booked)
    }
    this.onQueueChanged(booked.doctorId, booked.date)
    return this.view(booked)
  }

  releaseHold(patient: Patient, id: string) {
    const a = this.ownAppointment(patient, id)
    if (a.status === 'held') this.db.remove('appointments', a.id)
  }

  listMine(patient: Patient, scope: string | null): AppointmentView[] {
    const today = this.today()
    const mine = this.db
      .all('appointments')
      .filter((a) => a.patientId === patient.id && a.status !== 'held')
    const upcoming = (a: Appointment) => ACTIVE.has(a.status) && a.date >= today
    const key = (a: Appointment) => `${a.date} ${a.start}`
    const list =
      scope === 'past'
        ? mine.filter((a) => !upcoming(a)).sort((a, b) => key(b).localeCompare(key(a)))
        : mine.filter(upcoming).sort((a, b) => key(a).localeCompare(key(b)))
    return list.map((a) => this.view(a))
  }

  cancel(patient: Patient, id: string): AppointmentView {
    const a = this.ownAppointment(patient, id)
    if (a.status !== 'booked')
      return fail('VALIDATION', 'Only a booked appointment can be cancelled.')
    const cancelled = this.update(a, { status: 'cancelled', cancelReason: 'patient' })
    this.notifyAppointment('cancellation', cancelled)
    this.onQueueChanged(a.doctorId, a.date)
    return this.view(cancelled)
  }

  queueStatus(patient: Patient, id: string): QueueStatus {
    const a = this.ownAppointment(patient, id)
    const doctor = this.db.get('doctors', a.doctorId)!
    const rule = daySlots(doctor, a.date).find((s) => s.start === a.start)?.rule
    const slotMinutes = rule?.slotMinutes ?? toMinutes(a.end) - toMinutes(a.start)
    const entries = this.appointmentsOf(a.doctorId, a.date).filter((e) => e.status !== 'held')
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

  // ---------------------------------------------------------------- staff

  private publicStaff({ password: _password, ...user }: StaffAccount): StaffUser {
    return user
  }

  staffLogin(body: { username?: unknown; password?: unknown }): {
    sessionId: string
    user: StaffUser
  } {
    const username = String(body.username ?? '')
      .trim()
      .toLowerCase()
    const account = this.db.all('staff').find((s) => s.username === username && s.active)
    if (!account || account.password !== String(body.password ?? '')) {
      return fail('UNAUTHENTICATED', 'Wrong username or password.')
    }
    const sessionId = this.id('staff')
    this.db.put('sessions', { id: sessionId, kind: 'staff', subjectId: account.id })
    return { sessionId, user: this.publicStaff(account) }
  }

  staffForSession(sessionId: string | undefined, roles?: StaffRole[]): StaffUser {
    const session = sessionId ? this.db.get('sessions', sessionId) : undefined
    const account = session?.kind === 'staff' ? this.db.get('staff', session.subjectId) : undefined
    if (!account?.active) return fail('UNAUTHENTICATED', 'Please sign in.')
    if (roles && !roles.includes(account.role))
      return fail('FORBIDDEN', 'Your account cannot do this.')
    return this.publicStaff(account)
  }

  // ---------------------------------------------------------------- admin

  listAllSpecialties(): Specialty[] {
    return this.db.all('specialties').sort((a, b) => a.sortOrder - b.sortOrder)
  }

  private validateSpecialty(input: Partial<SpecialtyInput>) {
    const name = {
      en: String(input.name?.en ?? '').trim(),
      bn: String(input.name?.bn ?? '').trim(),
    }
    if (!name.en || !name.bn) fail('VALIDATION', 'Enter the name in English and Bangla.')
    return {
      name,
      description: {
        en: String(input.description?.en ?? '').trim(),
        bn: String(input.description?.bn ?? '').trim(),
      },
      sortOrder: Number(input.sortOrder) || this.db.all('specialties').length + 1,
      active: input.active !== false,
    }
  }

  createSpecialty(input: Partial<SpecialtyInput>): Specialty {
    const fields = this.validateSpecialty(input)
    const id =
      fields.name.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || this.id('sp')
    if (this.db.get('specialties', id))
      fail('VALIDATION', 'A specialty with this name already exists.')
    return this.db.put('specialties', { id, ...fields })
  }

  updateSpecialty(id: string, input: Partial<SpecialtyInput>): Specialty {
    if (!this.db.get('specialties', id)) fail('NOT_FOUND', 'Specialty not found.')
    return this.db.put('specialties', { id, ...this.validateSpecialty(input) })
  }

  listAllDoctors(): Doctor[] {
    return this.db.all('doctors')
  }

  private validateDoctor(input: Partial<DoctorInput>, id: string): Doctor {
    const name = {
      en: String(input.name?.en ?? '').trim(),
      bn: String(input.name?.bn ?? '').trim(),
    }
    if (!name.en || !name.bn) fail('VALIDATION', 'Enter the doctor’s name in English and Bangla.')
    if (!input.specialtyId || !this.db.get('specialties', input.specialtyId))
      fail('VALIDATION', 'Choose a specialty.')
    const fee = Number(input.fee)
    if (!Number.isInteger(fee) || fee < 0) fail('VALIDATION', 'Enter the fee in whole taka.')
    const schedule = (input.schedule ?? []).map((r, i) => {
      const slotMinutes = Number(r.slotMinutes)
      const maxPatients = Number(r.maxPatients)
      if (!(r.weekday >= 0 && r.weekday <= 6)) fail('VALIDATION', `Chamber ${i + 1}: choose a day.`)
      if (!isValidTime(r.start) || !isValidTime(r.end) || toMinutes(r.start) >= toMinutes(r.end)) {
        fail('VALIDATION', `Chamber ${i + 1}: the end time must be after the start time.`)
      }
      if (!(slotMinutes >= 5 && slotMinutes <= 120))
        fail('VALIDATION', `Chamber ${i + 1}: slot length must be 5–120 minutes.`)
      if (!(maxPatients >= 1 && maxPatients <= 100))
        fail('VALIDATION', `Chamber ${i + 1}: patient limit must be 1–100.`)
      return {
        id: r.id ?? `${id}-r${i + 1}-${Math.floor(this.random() * 1e6).toString(36)}`,
        weekday: r.weekday,
        start: r.start,
        end: r.end,
        slotMinutes,
        maxPatients,
        room: String(r.room ?? '').trim(),
      }
    })
    return {
      id,
      name,
      specialtyId: input.specialtyId!,
      designation: {
        en: String(input.designation?.en ?? '').trim(),
        bn: String(input.designation?.bn ?? '').trim(),
      },
      qualifications: String(input.qualifications ?? '').trim(),
      experienceYears: Math.max(0, Number(input.experienceYears) || 0),
      fee,
      gender: input.gender === 'female' ? 'female' : 'male',
      active: input.active !== false,
      schedule,
    }
  }

  createDoctor(input: Partial<DoctorInput>): Doctor {
    return this.db.put('doctors', this.validateDoctor(input, this.id('d')))
  }

  updateDoctor(id: string, input: Partial<DoctorInput>): Doctor {
    this.doctorOr404(id, false)
    return this.db.put('doctors', this.validateDoctor(input, id))
  }

  listLeaveDays(doctorId: string | null): LeaveDay[] {
    const today = this.today()
    const list = this.db.all('leaveDays').filter((l) => !doctorId || l.doctorId === doctorId)
    const upcoming = list
      .filter((l) => l.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const past = list.filter((l) => l.date < today).sort((a, b) => b.date.localeCompare(a.date))
    return [...upcoming, ...past]
  }

  private bookingsCancelledByLeave(doctorId: string, date: string): Appointment[] {
    const now = this.now()
    return this.appointmentsOf(doctorId, date).filter(
      (a) => ACTIVE.has(a.status) || (a.status === 'held' && occupiesSlot(a, now)),
    )
  }

  leaveImpact(doctorId: string, date: string): { appointments: number } {
    this.doctorOr404(doctorId, false)
    return { appointments: this.bookingsCancelledByLeave(doctorId, date).length }
  }

  addLeaveDay(body: { doctorId?: unknown; date?: unknown; reason?: unknown }): {
    leaveDay: LeaveDay
    cancelled: number
    smsSent: number
  } {
    const doctor = this.doctorOr404(String(body.doctorId ?? ''), false)
    const date = String(body.date ?? '')
    if (!isValidDate(date) || date < this.today())
      fail('VALIDATION', 'Choose today or a later date.')
    if (this.leaveDates(doctor.id).includes(date))
      fail('VALIDATION', 'The doctor is already on leave that day.')
    const leaveDay = this.db.put('leaveDays', {
      id: this.id('l'),
      doctorId: doctor.id,
      date,
      reason: String(body.reason ?? '').trim(),
    })
    let cancelled = 0
    for (const a of this.bookingsCancelledByLeave(doctor.id, date)) {
      if (a.status === 'held') {
        this.db.remove('appointments', a.id)
        continue
      }
      const c = this.update(a, { status: 'cancelled', cancelReason: 'leave_day' })
      this.notifyAppointment('cancellation', c, true)
      cancelled++
    }
    this.onQueueChanged(doctor.id, date)
    return { leaveDay, cancelled, smsSent: cancelled }
  }

  removeLeaveDay(id: string) {
    if (!this.db.get('leaveDays', id)) fail('NOT_FOUND', 'Leave day not found.')
    this.db.remove('leaveDays', id)
  }

  getSettings(): Settings {
    const { reminder, booking } = this.db.settings()
    return { reminder, booking }
  }

  putSettings(body: Partial<Settings>): Settings {
    const daysBefore = Number(body.reminder?.daysBefore)
    const time = String(body.reminder?.time ?? '')
    const openDays = Number(body.booking?.openDays)
    if (daysBefore !== 0 && daysBefore !== 1)
      fail('VALIDATION', 'Reminders go the day before or on the day.')
    if (!isValidTime(time)) fail('VALIDATION', 'Enter the reminder time as HH:mm.')
    if (!Number.isInteger(openDays) || openDays < 1 || openDays > 60)
      fail('VALIDATION', 'Booking window must be 1–60 days.')
    const settings: Settings = {
      reminder: { daysBefore: daysBefore as 0 | 1, time },
      booking: { openDays },
    }
    this.db.put('settings', { ...settings, id: 'settings' })
    return settings
  }

  listSms(limit: number): SmsMessage[] {
    // Newest first; for equal timestamps the later insert wins (the sort is stable).
    return this.db
      .all('sms')
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.min(Math.max(limit || 100, 1), 500))
  }

  listStaff(): StaffUser[] {
    return this.db.all('staff').map((s) => this.publicStaff(s))
  }

  createStaff(body: {
    name?: unknown
    username?: unknown
    password?: unknown
    role?: unknown
    doctorId?: unknown
  }): StaffUser {
    const name = String(body.name ?? '').trim()
    const username = String(body.username ?? '')
      .trim()
      .toLowerCase()
    const password = String(body.password ?? '')
    const role = body.role as StaffRole
    if (!name) fail('VALIDATION', 'Enter a name.')
    if (!/^[a-z0-9._-]{3,30}$/.test(username))
      fail('VALIDATION', 'Username: 3–30 letters, digits, dots or dashes.')
    if (this.db.all('staff').some((s) => s.username === username))
      fail('VALIDATION', 'That username is taken.')
    if (password.length < 6) fail('VALIDATION', 'The password needs at least 6 characters.')
    if (!['admin', 'front_desk', 'doctor'].includes(role)) fail('VALIDATION', 'Choose a role.')
    const doctorId = role === 'doctor' ? String(body.doctorId ?? '') : undefined
    if (role === 'doctor' && !this.db.get('doctors', doctorId!))
      fail('VALIDATION', 'Choose the doctor this account belongs to.')
    const account = this.db.put('staff', {
      id: this.id('u'),
      name,
      username,
      password,
      role,
      active: true,
      ...(doctorId ? { doctorId } : {}),
    })
    return this.publicStaff(account)
  }

  // ---------------------------------------------------------------- front desk and doctor

  daySheet(doctorId: string, date: string): DaySheet {
    const doctor = this.doctorOr404(doctorId, false)
    if (!isValidDate(date)) fail('VALIDATION', 'Choose a date.')
    const [day] = this.availabilityFor(doctor, date, 1)
    const appointments = this.appointmentsOf(doctor.id, date)
      .filter((a) => a.status !== 'held')
      .sort((a, b) => a.serial - b.serial)
    return {
      doctorId: doctor.id,
      date,
      onLeave: day?.onLeave ?? false,
      sessions: day?.sessions ?? [],
      nowServing: appointments.find((a) => a.status === 'in_consultation')?.serial ?? null,
      appointments: appointments.map((a) => this.view(a, true)),
    }
  }

  setStatus(id: string, body: { status?: unknown }): AppointmentView {
    const a = this.db.get('appointments', id) ?? fail('NOT_FOUND', 'Appointment not found.')
    const status = body.status as AppointmentStatus
    const allowed: Record<string, AppointmentStatus[]> = {
      arrived: ['booked'],
      seen: ['arrived', 'in_consultation'],
      no_show: ['booked', 'arrived'],
    }
    if (!allowed[status]?.includes(a.status))
      fail(
        'VALIDATION',
        `Cannot mark a ${a.status.replace('_', ' ')} patient as ${String(status).replace('_', ' ')}.`,
      )
    const next = this.update(a, { status })
    if (a.status === 'in_consultation')
      this.db.put('queue', {
        id: queueId(a.doctorId, a.date),
        doctorId: a.doctorId,
        date: a.date,
        nowServingId: null,
      })
    this.onQueueChanged(a.doctorId, a.date)
    return this.view(next, true)
  }

  callNext(body: { doctorId?: unknown; date?: unknown }): DaySheet {
    const doctor = this.doctorOr404(String(body.doctorId ?? ''), false)
    const date = String(body.date ?? '')
    const entries = this.appointmentsOf(doctor.id, date)
    for (const current of entries.filter((a) => a.status === 'in_consultation')) {
      this.update(current, { status: 'seen' })
    }
    const next = nextToCall(entries.filter((a) => a.status !== 'in_consultation'))
    const called = next
      ? this.update(this.db.get('appointments', next.id)!, {
          status: 'in_consultation',
          calledAt: this.now().toISOString(),
        })
      : undefined
    this.db.put('queue', {
      id: queueId(doctor.id, date),
      doctorId: doctor.id,
      date,
      nowServingId: called?.id ?? null,
    })
    this.onQueueChanged(doctor.id, date)
    return this.daySheet(doctor.id, date)
  }

  findPatient(phone: string | null): Patient {
    const normalized =
      normalizePhone(phone ?? '') ?? fail('VALIDATION', 'Enter a valid mobile number.')
    return (
      this.db.all('patients').find((p) => p.phone === normalized) ??
      fail('NOT_FOUND', 'No patient with this number.')
    )
  }

  createPatient(body: { name?: unknown; phone?: unknown; age?: unknown; sex?: unknown }): Patient {
    const phone =
      normalizePhone(String(body.phone ?? '')) ?? fail('VALIDATION', 'Enter a valid mobile number.')
    if (this.db.all('patients').some((p) => p.phone === phone))
      fail('VALIDATION', 'This number is already registered.')
    return this.db.put('patients', {
      id: this.id('p'),
      phone,
      registeredBy: 'front_desk',
      ...this.validatePerson(body),
    })
  }

  bookForPatient(body: {
    patientId?: unknown
    doctorId?: unknown
    date?: unknown
    start?: unknown
    source?: unknown
  }): AppointmentView {
    const patient =
      this.db.get('patients', String(body.patientId ?? '')) ??
      fail('NOT_FOUND', 'Patient not found.')
    const doctor = this.doctorOr404(String(body.doctorId ?? ''))
    const date = String(body.date ?? '')
    const start = String(body.start ?? '')
    const source = body.source as AppointmentSource
    if (source !== 'phone' && source !== 'walk_in') fail('VALIDATION', 'Choose phone or walk-in.')
    this.clearExpiredHolds()
    const check = checkSlot({
      doctor,
      date,
      start,
      leaveDates: this.leaveDates(doctor.id),
      appointments: this.appointmentsOf(doctor.id, date),
      now: this.now(),
      openDays: this.openDays(),
    })
    if (!check.ok) return this.slotError(check.code)
    const a = this.db.put('appointments', {
      id: this.id('a'),
      patientId: patient.id,
      doctorId: doctor.id,
      date,
      start,
      end: check.slot.end,
      serial: check.slot.serial,
      status: 'booked',
      source,
      createdAt: this.now().toISOString(),
    })
    this.notifyAppointment('confirmation', a)
    this.onQueueChanged(doctor.id, date)
    return this.view(a, true)
  }

  doctorDay(user: StaffUser, date: string | null): DaySheet {
    if (!user.doctorId) return fail('FORBIDDEN', 'This account is not linked to a doctor.')
    return this.daySheet(user.doctorId, date && isValidDate(date) ? date : this.today())
  }

  // ---------------------------------------------------------------- analytics

  analytics(fromQuery: string | null, toQuery: string | null): AnalyticsSummary {
    const today = this.today()
    const to = toQuery && isValidDate(toQuery) ? toQuery : today
    const from = fromQuery && isValidDate(fromQuery) ? fromQuery : addDays(to, -29)
    if (daysBetween(from, to) < 0) fail('VALIDATION', 'The start date must be before the end date.')
    const doctors = new Map(this.db.all('doctors').map((d) => [d.id, d]))
    const inRange = this.db
      .all('appointments')
      .filter((a) => a.status !== 'held' && a.date >= from && a.date <= to)
    const kept = inRange.filter((a) => a.status !== 'cancelled')
    const seen = inRange.filter((a) => a.status === 'seen').length
    const noShows = inRange.filter((a) => a.status === 'no_show').length
    const count = <K extends string | number>(keys: K[]) => {
      const m = new Map<K, number>()
      for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
      return m
    }
    const bySpecialty = count(kept.map((a) => doctors.get(a.doctorId)?.specialtyId ?? 'unknown'))
    const byHour = count(kept.map((a) => Number(a.start.slice(0, 2))))
    const byDay = count(kept.map((a) => a.date))
    const tags = count(
      this.db
        .all('triage')
        .filter((t) => {
          const d = dhakaDate(new Date(t.createdAt))
          return d >= from && d <= to
        })
        .flatMap((t) => t.tags),
    )
    const days: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
    return {
      from,
      to,
      totalBookings: inRange.length,
      seen,
      noShows,
      cancelled: inRange.length - kept.length,
      noShowRate: seen + noShows ? noShows / (seen + noShows) : 0,
      bySpecialty: [...bySpecialty]
        .map(([specialtyId, n]) => ({ specialtyId, count: n }))
        .sort((a, b) => b.count - a.count),
      byHour: [...byHour].map(([hour, n]) => ({ hour, count: n })).sort((a, b) => a.hour - b.hour),
      byDay: days.map((date) => ({ date, count: byDay.get(date) ?? 0 })),
      commonProblems: [...tags]
        .map(([tag, n]) => ({ tag, count: n }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }
  }
}
