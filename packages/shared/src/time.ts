import type { Weekday } from './types.ts'

export const TIME_ZONE = 'Asia/Dhaka'

// Dhaka is UTC+6 all year (no daylight saving), so a fixed offset is exact.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000

/** Today's date in Dhaka, 'YYYY-MM-DD'. */
export function dhakaDate(now: Date = new Date()): string {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Minutes since midnight in Dhaka. */
export function dhakaMinutes(now: Date = new Date()): number {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** The instant a Dhaka date and 'HH:mm' time refer to. */
export function dhakaInstant(date: string, time: string): Date {
  return new Date(Date.parse(`${date}T${time}:00Z`) - DHAKA_OFFSET_MS)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (negative if `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export function weekdayOf(date: string): Weekday {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}
