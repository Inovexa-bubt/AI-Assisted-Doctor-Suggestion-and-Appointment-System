import { describe, expect, it } from 'vitest'
import {
  type Appointment,
  type Doctor,
  type QueueEntry,
  availability,
  checkSlot,
  daySlots,
  dhakaInstant,
  nextToCall,
  occupiesSlot,
  openSlots,
  queuePosition,
  sessionSlots,
} from '../src/index.ts'

// 2026-10-04 is a Sunday; 2026-10-05 a Monday.
const doctor: Doctor = {
  id: 'd1',
  name: { en: 'Dr. Test', bn: 'ডা. টেস্ট' },
  specialtyId: 'medicine',
  designation: { en: 'Consultant', bn: 'কনসালট্যান্ট' },
  qualifications: 'MBBS',
  experienceYears: 5,
  fee: 800,
  gender: 'female',
  active: true,
  schedule: [
    {
      id: 'r-eve',
      weekday: 0,
      start: '17:00',
      end: '18:00',
      slotMinutes: 15,
      maxPatients: 10,
      room: 'Room 1',
    },
    {
      id: 'r-morn',
      weekday: 0,
      start: '10:00',
      end: '11:00',
      slotMinutes: 20,
      maxPatients: 2,
      room: 'Room 1',
    },
    {
      id: 'r-mon',
      weekday: 1,
      start: '09:00',
      end: '10:00',
      slotMinutes: 15,
      maxPatients: 4,
      room: 'Room 2',
    },
  ],
}

const booking = (
  start: string,
  status: Appointment['status'],
  extra: Partial<Appointment> = {},
) => ({
  id: `a-${start}`,
  doctorId: 'd1',
  date: '2026-10-04',
  start,
  status,
  ...extra,
})

describe('sessionSlots', () => {
  it('makes min(patient limit, duration ÷ slot length) slots', () => {
    expect(
      sessionSlots({ start: '17:00', end: '18:00', slotMinutes: 15, maxPatients: 10 }),
    ).toHaveLength(4)
    expect(
      sessionSlots({ start: '17:00', end: '18:00', slotMinutes: 15, maxPatients: 3 }),
    ).toHaveLength(3)
    expect(sessionSlots({ start: '18:00', end: '17:00', slotMinutes: 15, maxPatients: 3 })).toEqual(
      [],
    )
  })

  it('continues serial numbers across the sessions of a day, in time order', () => {
    const slots = daySlots(doctor, '2026-10-04')
    expect(slots.map((s) => [s.start, s.serial])).toEqual([
      ['10:00', 1],
      ['10:20', 2],
      ['17:00', 3],
      ['17:15', 4],
      ['17:30', 5],
      ['17:45', 6],
    ])
  })
})

describe('occupiesSlot', () => {
  const now = new Date('2026-10-04T04:00:00Z')
  it('frees the slot when a hold expires or a booking is cancelled', () => {
    expect(occupiesSlot({ status: 'held', holdExpiresAt: '2026-10-04T04:03:00Z' }, now)).toBe(true)
    expect(occupiesSlot({ status: 'held', holdExpiresAt: '2026-10-04T03:59:00Z' }, now)).toBe(false)
    expect(occupiesSlot({ status: 'cancelled' }, now)).toBe(false)
    expect(occupiesSlot({ status: 'no_show' }, now)).toBe(true)
  })
})

describe('availability', () => {
  // 10:10 in Dhaka on Sunday 4 October.
  const now = dhakaInstant('2026-10-04', '10:10')

  it('marks past, taken and held slots unavailable', () => {
    const days = availability({
      doctor,
      from: '2026-10-04',
      days: 2,
      leaveDates: [],
      appointments: [
        booking('17:00', 'booked'),
        booking('17:15', 'held', { holdExpiresAt: new Date(now.getTime() + 60_000).toISOString() }),
        booking('17:30', 'held', { holdExpiresAt: new Date(now.getTime() - 60_000).toISOString() }),
        booking('17:45', 'cancelled'),
      ],
      now,
    })
    const sunday = days[0]!.sessions.flatMap((s) => s.slots)
    expect(sunday.map((s) => [s.start, s.available])).toEqual([
      ['10:00', false], // past
      ['10:20', true],
      ['17:00', false], // booked
      ['17:15', false], // held
      ['17:30', true], // hold expired
      ['17:45', true], // cancelled
    ])
    expect(days[1]!.sessions[0]!.slots.every((s) => s.available)).toBe(true)
    expect(openSlots(days)[0]).toMatchObject({ date: '2026-10-04', start: '10:20', serial: 2 })
  })

  it('shows leave days with no sessions', () => {
    const [day] = availability({
      doctor,
      from: '2026-10-05',
      days: 1,
      leaveDates: ['2026-10-05'],
      appointments: [],
      now,
    })
    expect(day).toEqual({ date: '2026-10-05', onLeave: true, sessions: [] })
  })

  it('closes online booking for sessions that start within the cut-off', () => {
    // 16:10: the 17:00 session starts in 50 minutes.
    const at = dhakaInstant('2026-10-04', '16:10')
    const online = (closeMinutesBefore?: number) =>
      availability({
        doctor,
        from: '2026-10-04',
        days: 2,
        leaveDates: [],
        appointments: [],
        now: at,
        closeMinutesBefore,
      })
    const [today, tomorrow] = online(60)
    expect(today!.sessions.find((s) => s.ruleId === 'r-eve')).toMatchObject({ closed: true })
    expect(today!.sessions.flatMap((s) => s.slots).some((s) => s.available)).toBe(false)
    expect(tomorrow!.sessions[0]!.closed).toBeUndefined()
    // A 45-minute cut-off leaves it open; the front desk (no cut-off) always sees it open.
    expect(online(45)[0]!.sessions.find((s) => s.ruleId === 'r-eve')!.closed).toBeUndefined()
    expect(openSlots(online())[0]).toMatchObject({ date: '2026-10-04', start: '17:00' })
  })
})

describe('checkSlot', () => {
  const now = dhakaInstant('2026-10-04', '10:10')
  const base = {
    doctor,
    leaveDates: [] as string[],
    appointments: [] as ReturnType<typeof booking>[],
    now,
    openDays: 14,
  }

  it('accepts a free slot and returns its serial', () => {
    const result = checkSlot({ ...base, date: '2026-10-04', start: '17:15' })
    expect(result).toMatchObject({ ok: true, slot: { serial: 4, rule: { id: 'r-eve' } } })
  })

  it.each([
    ['2026-10-04', '17:10', 'VALIDATION'],
    ['2026-10-04', '10:00', 'SLOT_IN_PAST'],
    ['2026-10-25', '17:00', 'VALIDATION'],
  ])('rejects %s %s with %s', (date, start, code) => {
    expect(checkSlot({ ...base, date, start })).toEqual({ ok: false, code })
  })

  it('rejects online booking after the cut-off but lets the front desk book', () => {
    const at = dhakaInstant('2026-10-04', '16:10')
    const slot = { ...base, now: at, date: '2026-10-04', start: '17:30' }
    expect(checkSlot({ ...slot, closeMinutesBefore: 60 })).toEqual({
      ok: false,
      code: 'BOOKING_CLOSED',
    })
    expect(checkSlot(slot).ok).toBe(true)
  })

  it('rejects leave days and taken slots, but ignores the appointment being rescheduled', () => {
    expect(
      checkSlot({ ...base, date: '2026-10-05', start: '09:00', leaveDates: ['2026-10-05'] }),
    ).toEqual({ ok: false, code: 'DOCTOR_ON_LEAVE' })
    const appointments = [booking('17:00', 'booked')]
    expect(checkSlot({ ...base, appointments, date: '2026-10-04', start: '17:00' })).toEqual({
      ok: false,
      code: 'SLOT_TAKEN',
    })
    expect(
      checkSlot({ ...base, appointments, date: '2026-10-04', start: '17:00', ignoreId: 'a-17:00' })
        .ok,
    ).toBe(true)
  })
})

describe('queue', () => {
  const entries: QueueEntry[] = [
    { id: 'a1', serial: 1, start: '17:00', status: 'seen' },
    { id: 'a2', serial: 2, start: '17:15', status: 'in_consultation' },
    { id: 'a3', serial: 3, start: '17:30', status: 'booked' },
    { id: 'a4', serial: 4, start: '17:45', status: 'arrived' },
    { id: 'a5', serial: 5, start: '18:00', status: 'arrived' },
    { id: 'a6', serial: 6, start: '18:15', status: 'no_show' },
  ]

  it('calls the arrived patient with the lowest serial, skipping those not yet here', () => {
    expect(nextToCall(entries)?.id).toBe('a4')
    expect(nextToCall(entries.filter((e) => e.status !== 'arrived'))).toBeUndefined()
  })

  it('counts waiting patients with a lower serial plus the one in consultation', () => {
    const mine = entries[4]!
    const pos = queuePosition(entries, mine, {
      date: '2026-10-04',
      today: '2026-10-04',
      nowMinutes: 17 * 60 + 20,
      slotMinutes: 15,
    })
    expect(pos).toEqual({ nowServing: 2, ahead: 3, estimatedTime: '18:05' })
  })

  it('never estimates earlier than the scheduled slot', () => {
    const pos = queuePosition(entries, entries[4]!, {
      date: '2026-10-04',
      today: '2026-10-04',
      nowMinutes: 16 * 60,
      slotMinutes: 15,
    })
    expect(pos.estimatedTime).toBe('18:00')
  })

  it('uses the slot time for future dates and nothing once seen', () => {
    const future = queuePosition(entries, entries[2]!, {
      date: '2026-10-05',
      today: '2026-10-04',
      nowMinutes: 0,
      slotMinutes: 15,
    })
    expect(future.estimatedTime).toBe('17:30')
    const seen = queuePosition(entries, entries[0]!, {
      date: '2026-10-04',
      today: '2026-10-04',
      nowMinutes: 0,
      slotMinutes: 15,
    })
    expect(seen).toEqual({ nowServing: 2, ahead: 0, estimatedTime: null })
  })
})
