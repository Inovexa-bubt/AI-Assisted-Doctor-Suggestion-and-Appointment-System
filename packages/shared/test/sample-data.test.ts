import { describe, expect, it } from 'vitest'
import { daySlots, dhakaInstant, generateSampleData } from '../src/index.ts'

// Sunday 4 October 2026, 18:10 in Dhaka: some evening sessions are running.
const now = dhakaInstant('2026-10-04', '18:10')
const data = generateSampleData({ now })

describe('generateSampleData', () => {
  it('is deterministic for the same date', () => {
    const again = generateSampleData({ now })
    expect(JSON.stringify(again)).toBe(JSON.stringify(data))
  })

  it('never double-books a slot', () => {
    const seen = new Set<string>()
    for (const a of data.appointments.filter((a) => a.status !== 'cancelled')) {
      const key = `${a.doctorId} ${a.date} ${a.start}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
    }
  })

  it('uses real slots and serials from the doctor’s schedule', () => {
    const doctors = new Map(data.doctors.map((d) => [d.id, d]))
    for (const a of data.appointments.slice(0, 500)) {
      const slot = daySlots(doctors.get(a.doctorId)!, a.date).find((s) => s.start === a.start)
      expect(slot?.serial).toBe(a.serial)
    }
  })

  it('books nobody on a leave day', () => {
    const leave = new Set(data.leaveDays.map((l) => `${l.doctorId} ${l.date}`))
    expect(data.appointments.some((a) => leave.has(`${a.doctorId} ${a.date}`))).toBe(false)
    expect(data.leaveDays.filter((l) => l.date > '2026-10-04')).toHaveLength(2)
  })

  it('has at most one patient in consultation per doctor, only today', () => {
    const inConsultation = data.appointments.filter((a) => a.status === 'in_consultation')
    expect(inConsultation.length).toBeGreaterThan(0)
    expect(new Set(inConsultation.map((a) => a.doctorId)).size).toBe(inConsultation.length)
    expect(inConsultation.every((a) => a.date === '2026-10-04')).toBe(true)
    for (const q of data.queue.filter((q) => q.nowServingId)) {
      expect(inConsultation.some((a) => a.id === q.nowServingId)).toBe(true)
    }
  })

  it('covers three months of history and the booking window', () => {
    const dates = data.appointments.map((a) => a.date).sort()
    expect(dates[0]! <= '2026-07-07').toBe(true)
    expect(dates.at(-1)! >= '2026-10-15').toBe(true)
    expect(
      data.appointments.filter((a) => a.date < '2026-10-04' && a.status === 'booked'),
    ).toHaveLength(0)
  })

  it('links finished AI conversations to bookings with a pre-visit summary', () => {
    const triage = new Map(data.triage.map((t) => [t.id, t]))
    const linked = data.appointments.filter((a) => a.triageId)
    expect(linked.length).toBeGreaterThan(100)
    for (const a of linked) {
      const t = triage.get(a.triageId!)!
      expect(t.patientId).toBe(a.patientId)
      expect(t.summary?.symptoms).toBeTruthy()
    }
  })

  it('creates staff accounts for every doctor', () => {
    expect(data.staff.filter((s) => s.role === 'doctor')).toHaveLength(data.doctors.length)
    expect(new Set(data.staff.map((s) => s.username)).size).toBe(data.staff.length)
  })
})
