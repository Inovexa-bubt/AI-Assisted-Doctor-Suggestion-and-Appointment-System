import type {
  Appointment,
  AvailabilityDay,
  AvailabilitySession,
  Doctor,
  ErrorCode,
  ScheduleRule,
  Slot,
} from './types.ts'
import {
  addDays,
  daysBetween,
  dhakaDate,
  dhakaMinutes,
  fromMinutes,
  toMinutes,
  weekdayOf,
} from './time.ts'

type SlotRule = Pick<ScheduleRule, 'start' | 'end' | 'slotMinutes' | 'maxPatients'>

export interface SessionSlot {
  start: string
  end: string
  serial: number
}

/**
 * The slots of one chamber session: `min(maxPatients, duration ÷ slotMinutes)` of them.
 * Serials start after `serialOffset`, so a doctor's second session of the day continues the
 * numbering and each doctor has one queue per day.
 */
export function sessionSlots(rule: SlotRule, serialOffset = 0): SessionSlot[] {
  const first = toMinutes(rule.start)
  const last = toMinutes(rule.end)
  if (rule.slotMinutes <= 0 || last <= first) return []
  const count = Math.min(rule.maxPatients, Math.floor((last - first) / rule.slotMinutes))
  return Array.from({ length: count }, (_, i) => {
    const start = first + i * rule.slotMinutes
    return {
      start: fromMinutes(start),
      end: fromMinutes(start + rule.slotMinutes),
      serial: serialOffset + i + 1,
    }
  })
}

/** The doctor's chamber sessions on a date, earliest first. */
export function rulesOn(doctor: Pick<Doctor, 'schedule'>, date: string): ScheduleRule[] {
  const weekday = weekdayOf(date)
  return doctor.schedule
    .filter((r) => r.weekday === weekday)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

export interface DaySlot extends SessionSlot {
  rule: ScheduleRule
}

/** Every slot the doctor has on a date, with day-wide serial numbers. */
export function daySlots(doctor: Pick<Doctor, 'schedule'>, date: string): DaySlot[] {
  const out: DaySlot[] = []
  for (const rule of rulesOn(doctor, date)) {
    for (const slot of sessionSlots(rule, out.length)) out.push({ ...slot, rule })
  }
  return out
}

type Occupancy = Pick<Appointment, 'status' | 'holdExpiresAt'>

/** Whether an appointment still takes up its slot. Cancelled ones and expired holds do not. */
export function occupiesSlot(a: Occupancy, now: Date): boolean {
  if (a.status === 'cancelled') return false
  if (a.status === 'held') return !!a.holdExpiresAt && Date.parse(a.holdExpiresAt) > now.getTime()
  return true
}

export type SlotBooking = Pick<Appointment, 'doctorId' | 'date' | 'start'> & Occupancy

export interface AvailabilityInput {
  doctor: Doctor
  from: string
  days: number
  leaveDates: Iterable<string>
  appointments: Iterable<SlotBooking>
  now: Date
}

/** Sessions and slots for each day in the range. Past slots and taken slots are unavailable. */
export function availability(input: AvailabilityInput): AvailabilityDay[] {
  const { doctor, from, days, now } = input
  const today = dhakaDate(now)
  const nowMin = dhakaMinutes(now)
  const onLeave = new Set(input.leaveDates)
  const taken = new Set<string>()
  for (const a of input.appointments) {
    if (a.doctorId === doctor.id && occupiesSlot(a, now)) taken.add(`${a.date} ${a.start}`)
  }

  const result: AvailabilityDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    if (!doctor.active || onLeave.has(date)) {
      result.push({ date, onLeave: onLeave.has(date), sessions: [] })
      continue
    }
    const sessions: AvailabilitySession[] = []
    let offset = 0
    for (const rule of rulesOn(doctor, date)) {
      const slots: Slot[] = sessionSlots(rule, offset).map((s) => ({
        date,
        ...s,
        available:
          !taken.has(`${date} ${s.start}`) &&
          (date > today || (date === today && toMinutes(s.start) > nowMin)),
      }))
      offset += slots.length
      sessions.push({ ruleId: rule.id, start: rule.start, end: rule.end, room: rule.room, slots })
    }
    result.push({ date, onLeave: false, sessions })
  }
  return result
}

/** All open slots in the range, earliest first. */
export function openSlots(days: AvailabilityDay[]): Slot[] {
  return days.flatMap((d) => d.sessions.flatMap((s) => s.slots.filter((slot) => slot.available)))
}

export interface SlotCheckInput {
  doctor: Doctor
  date: string
  start: string
  leaveDates: Iterable<string>
  appointments: Iterable<SlotBooking & { id?: string }>
  now: Date
  openDays: number
  /** An appointment to ignore when checking whether the slot is taken (e.g. the one being rescheduled). */
  ignoreId?: string
}

export type SlotCheck = { ok: true; slot: DaySlot } | { ok: false; code: ErrorCode }

/** Validates that a slot exists, is in the booking window and is free. */
export function checkSlot(input: SlotCheckInput): SlotCheck {
  const { doctor, date, start, now } = input
  if (!doctor.active) return { ok: false, code: 'NOT_FOUND' }
  const slot = daySlots(doctor, date).find((s) => s.start === start)
  if (!slot) return { ok: false, code: 'VALIDATION' }
  if (new Set(input.leaveDates).has(date)) return { ok: false, code: 'DOCTOR_ON_LEAVE' }
  const today = dhakaDate(now)
  if (date < today || (date === today && toMinutes(start) <= dhakaMinutes(now))) {
    return { ok: false, code: 'SLOT_IN_PAST' }
  }
  if (daysBetween(today, date) >= input.openDays) return { ok: false, code: 'VALIDATION' }
  for (const a of input.appointments) {
    if (a.id !== undefined && a.id === input.ignoreId) continue
    if (a.doctorId === doctor.id && a.date === date && a.start === start && occupiesSlot(a, now)) {
      return { ok: false, code: 'SLOT_TAKEN' }
    }
  }
  return { ok: true, slot }
}
