// Shapes exchanged over the API (docs/design/api.md). Dates are 'YYYY-MM-DD' and times 'HH:mm',
// both in Asia/Dhaka time; timestamps are ISO 8601 strings.

export type Lang = 'bn' | 'en'

export interface Localized {
  en: string
  bn: string
}

/** 0 = Sunday … 6 = Saturday, as in `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Sex = 'female' | 'male' | 'other'

export type Urgency = 'routine' | 'within_48h' | 'emergency'

export type AppointmentStatus =
  'held' | 'booked' | 'arrived' | 'in_consultation' | 'seen' | 'no_show' | 'cancelled'

export type AppointmentSource = 'online' | 'phone' | 'walk_in'

export type CancelReason = 'patient' | 'staff' | 'leave_day' | 'rescheduled'

export type StaffRole = 'admin' | 'front_desk' | 'doctor'

export type Severity = 'mild' | 'moderate' | 'severe'

// ---- Doctors and schedules ----

export interface Specialty {
  id: string
  name: Localized
  description: Localized
  sortOrder: number
  active: boolean
}

export type SpecialtyInput = Omit<Specialty, 'id'> & { id?: string }

export interface ScheduleRule {
  id: string
  weekday: Weekday
  start: string
  end: string
  slotMinutes: number
  maxPatients: number
  room: string
}

export interface Doctor {
  id: string
  name: Localized
  specialtyId: string
  designation: Localized
  qualifications: string
  experienceYears: number
  /** Consultation fee in BDT, paid at the counter. */
  fee: number
  gender: 'female' | 'male'
  active: boolean
  schedule: ScheduleRule[]
}

export type DoctorInput = Omit<Doctor, 'id' | 'schedule'> & {
  schedule: Array<Omit<ScheduleRule, 'id'> & { id?: string }>
}

export interface Slot {
  date: string
  start: string
  end: string
  serial: number
  available: boolean
}

export interface AvailabilitySession {
  ruleId: string
  start: string
  end: string
  room: string
  slots: Slot[]
  /** Online booking has closed for this session; only the front desk can still book it. */
  closed?: boolean
}

export interface AvailabilityDay {
  date: string
  onLeave: boolean
  sessions: AvailabilitySession[]
}

export interface DoctorListItem extends Doctor {
  nextSlot: Slot | null
}

export interface LeaveDay {
  id: string
  doctorId: string
  date: string
  reason: string
}

// ---- Patients and appointments ----

export interface Patient {
  id: string
  name: string
  phone: string
  age: number
  sex: Sex
  registeredBy: 'self' | 'front_desk'
}

export interface PreVisitSummary {
  symptoms: string
  duration: string
  severity: Severity | 'unknown'
  /** The patient's own words, as typed or transcribed. */
  note: string
}

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  date: string
  start: string
  end: string
  serial: number
  status: AppointmentStatus
  source: AppointmentSource
  holdExpiresAt?: string
  triageId?: string
  rescheduledFromId?: string
  cancelReason?: CancelReason
  calledAt?: string
  createdAt: string
}

export interface AppointmentView extends Appointment {
  doctor: Doctor
  patient?: Patient
  summary?: PreVisitSummary
  room?: string
  /** For a held reschedule: the booking it will replace. */
  rescheduledFrom?: AppointmentView
  /** On staff lists: earlier visits of this patient to this doctor. */
  previousVisits?: { count: number; last: string | null }
}

export interface QueueStatus {
  appointmentId: string
  doctorId: string
  date: string
  serial: number
  status: AppointmentStatus
  /** Serial of the patient in consultation now, or null before the first call. */
  nowServing: number | null
  /** Patients still to be seen before this one, including the one in consultation. */
  ahead: number
  /** Estimated consultation time, 'HH:mm'; null once the patient has been seen or cancelled. */
  estimatedTime: string | null
  sessionStart: string
  slotMinutes: number
}

export interface DaySheet {
  doctorId: string
  date: string
  onLeave: boolean
  sessions: AvailabilitySession[]
  nowServing: number | null
  appointments: AppointmentView[]
}

// ---- AI assistant ----

export interface TriageAnswer {
  question: string
  answer: string
}

export type TriageStatus = 'needs_answer' | 'complete' | 'emergency'

export interface TriageSession {
  id: string
  lang: Lang
  problem: string
  answers: TriageAnswer[]
  status: TriageStatus
  /** The follow-up question to show when status is 'needs_answer'. */
  question?: string
  /** Suggested quick replies for the follow-up question. */
  quickReplies?: string[]
  specialtyId?: string
  urgency?: Urgency
  explanation?: string
  /** Symptom IDs from the specialty guide, used for analytics. */
  tags: string[]
  /** Phrases that triggered the emergency notice. */
  emergencyMatches?: string[]
}

export interface DoctorSuggestion {
  doctor: Doctor
  slots: Slot[]
}

export interface TriageResult {
  session: TriageSession
  suggestions: DoctorSuggestion[]
}

// ---- Staff, settings, messages, analytics ----

export interface StaffUser {
  id: string
  name: string
  username: string
  role: StaffRole
  doctorId?: string
  active: boolean
}

export interface Settings {
  reminder: {
    /** 0 = on the day, 1 = the day before. */
    daysBefore: 0 | 1
    time: string
  }
  booking: {
    /** How many days ahead patients can book. */
    openDays: number
    /** Online booking for a session closes this many minutes before it starts. */
    closeMinutesBefore: number
  }
}

export type SmsKind = 'otp' | 'confirmation' | 'reschedule' | 'cancellation' | 'reminder'

export interface SmsMessage {
  id: string
  phone: string
  kind: SmsKind
  body: string
  appointmentId?: string
  status: 'queued' | 'sent' | 'failed'
  createdAt: string
}

export interface AnalyticsSummary {
  from: string
  to: string
  totalBookings: number
  seen: number
  noShows: number
  cancelled: number
  /** No-shows ÷ (seen + no-shows), 0–1. */
  noShowRate: number
  bySpecialty: Array<{ specialtyId: string; count: number }>
  byHour: Array<{ hour: number; count: number }>
  byDay: Array<{ date: string; count: number }>
  commonProblems: Array<{ tag: string; count: number }>
}

// ---- Errors ----

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'DOCTOR_ON_LEAVE'
  | 'SLOT_IN_PAST'
  | 'BOOKING_CLOSED'
  | 'ALREADY_BOOKED'
  | 'HOLD_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string }
}
