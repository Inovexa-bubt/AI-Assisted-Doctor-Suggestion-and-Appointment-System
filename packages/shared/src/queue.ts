import type { AppointmentStatus } from './types.ts'
import { fromMinutes, toMinutes } from './time.ts'

export interface QueueEntry {
  id: string
  serial: number
  start: string
  status: AppointmentStatus
}

const WAITING: ReadonlySet<AppointmentStatus> = new Set(['booked', 'arrived'])
const FINISHED: ReadonlySet<AppointmentStatus> = new Set(['seen', 'no_show', 'cancelled', 'held'])

/** Serial of the patient in consultation, or null. */
export function nowServing(entries: QueueEntry[]): number | null {
  return entries.find((e) => e.status === 'in_consultation')?.serial ?? null
}

/**
 * Who "call next patient" calls: the arrived patient with the lowest serial. Patients who have
 * not arrived are skipped and can be called once they arrive.
 */
export function nextToCall(entries: QueueEntry[]): QueueEntry | undefined {
  return entries.filter((e) => e.status === 'arrived').sort((a, b) => a.serial - b.serial)[0]
}

export interface QueuePosition {
  nowServing: number | null
  ahead: number
  /** 'HH:mm', or null when the patient is done or the date has passed. */
  estimatedTime: string | null
}

/**
 * Position and estimated time for one patient.
 *
 * ahead = waiting patients (booked or arrived) with a lower serial, plus the one in consultation.
 * estimated time = later of (the patient's slot time, now + ahead × slot length).
 */
export function queuePosition(
  entries: QueueEntry[],
  mine: QueueEntry,
  opts: { date: string; today: string; nowMinutes: number; slotMinutes: number },
): QueuePosition {
  const serving = nowServing(entries)
  if (FINISHED.has(mine.status) || opts.date < opts.today) {
    return { nowServing: serving, ahead: 0, estimatedTime: null }
  }
  if (mine.status === 'in_consultation') {
    return { nowServing: serving, ahead: 0, estimatedTime: fromMinutes(opts.nowMinutes) }
  }
  const ahead = entries.filter(
    (e) =>
      e.id !== mine.id &&
      (e.status === 'in_consultation' || (WAITING.has(e.status) && e.serial < mine.serial)),
  ).length
  const scheduled = toMinutes(mine.start)
  const estimated =
    opts.date > opts.today
      ? scheduled
      : Math.max(scheduled, opts.nowMinutes + ahead * opts.slotMinutes)
  return { nowServing: serving, ahead, estimatedTime: fromMinutes(estimated) }
}
