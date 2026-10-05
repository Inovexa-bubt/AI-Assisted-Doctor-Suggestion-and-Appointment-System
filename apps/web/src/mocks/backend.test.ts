import { type Patient, dhakaInstant, openSlots } from '@inovexa/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, MockBackend } from './backend.ts'
import { MockDb, STORAGE_KEY } from './db.ts'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

// Sunday 4 October 2026, 18:10 in Dhaka.
let clock = dhakaInstant('2026-10-04', '18:10')
const now = () => clock
const advance = (minutes: number) => {
  clock = new Date(clock.getTime() + minutes * 60_000)
}

let storage: MemoryStorage
let db: MockDb
let api: MockBackend
let queueEvents: string[]

beforeEach(() => {
  clock = dhakaInstant('2026-10-04', '18:10')
  storage = new MemoryStorage()
  db = new MockDb(storage, now)
  queueEvents = []
  let seed = 1
  api = new MockBackend(db, {
    now,
    random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    onQueueChanged: (doctorId, date) => queueEvents.push(`${doctorId} ${date}`),
  })
})

const errorCode = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ApiError) return e.code
    throw e
  }
  return 'no error'
}

/** Signs a new patient in through OTP and registration. */
function register(phone: string, name = 'Test Patient'): { patient: Patient; sessionId: string } {
  const { demoCode } = api.requestOtp({ phone })
  const { sessionId, needsProfile } = api.verifyOtp({ phone, code: demoCode })
  expect(needsProfile).toBe(true)
  const patient = api.completeProfile(sessionId, { name, age: 34, sex: 'female' })
  return { patient, sessionId }
}

/** The first open slot for Dr. Sharmin Akter (d02: Sat, Mon, Wed mornings). */
function firstOpenSlot(doctorId = 'd02') {
  return openSlots(api.getAvailability(doctorId, {}))[0]!
}

describe('sign-in', () => {
  it('registers a new phone number and keeps the session', () => {
    const { patient, sessionId } = register('01711000001')
    expect(api.patientForSession(sessionId)).toEqual(patient)
    expect(db.all('sms').some((m) => m.kind === 'otp' && !m.body.match(/\d{6}/))).toBe(true)
  })

  it('locks out after five wrong codes', () => {
    api.requestOtp({ phone: '01711000002' })
    for (let i = 0; i < 5; i++)
      expect(errorCode(() => api.verifyOtp({ phone: '01711000002', code: '000000' }))).toBe(
        'OTP_INVALID',
      )
    expect(errorCode(() => api.verifyOtp({ phone: '01711000002', code: '000000' }))).toBe(
      'TOO_MANY_ATTEMPTS',
    )
  })

  it('expires codes after five minutes', () => {
    const { demoCode } = api.requestOtp({ phone: '01711000003' })
    advance(6)
    expect(errorCode(() => api.verifyOtp({ phone: '01711000003', code: demoCode }))).toBe(
      'OTP_EXPIRED',
    )
  })

  it('signs an existing patient straight in', () => {
    const existing = db.all('patients')[0]!
    const { demoCode } = api.requestOtp({ phone: existing.phone })
    expect(api.verifyOtp({ phone: existing.phone, code: demoCode })).toMatchObject({
      patient: existing,
      needsProfile: false,
    })
  })
})

describe('booking', () => {
  it('holds a slot for five minutes, then confirms it with an SMS', () => {
    const { patient } = register('01711000010')
    const slot = firstOpenSlot()
    const held = api.hold(patient, { doctorId: 'd02', date: slot.date, start: slot.start })
    expect(held).toMatchObject({ status: 'held', serial: slot.serial })
    expect(Date.parse(held.holdExpiresAt!) - clock.getTime()).toBe(5 * 60_000)
    expect(openSlots(api.getAvailability('d02', {}))[0]).not.toEqual(slot)

    const booked = api.confirm(patient, held.id)
    expect(booked).toMatchObject({ status: 'booked', room: 'Room 102' })
    expect(booked.holdExpiresAt).toBeUndefined()
    expect(api.listSms(1)[0]).toMatchObject({ kind: 'confirmation', phone: '01711000010' })
    expect(queueEvents).toContain(`d02 ${slot.date}`)
  })

  it('never lets two patients hold the same slot', () => {
    const a = register('01711000011').patient
    const b = register('01711000012').patient
    const slot = firstOpenSlot()
    api.hold(a, { doctorId: 'd02', date: slot.date, start: slot.start })
    expect(
      errorCode(() => api.hold(b, { doctorId: 'd02', date: slot.date, start: slot.start })),
    ).toBe('SLOT_TAKEN')
    advance(6)
    expect(api.hold(b, { doctorId: 'd02', date: slot.date, start: slot.start }).patientId).toBe(
      b.id,
    )
  })

  it('returns the same hold for a repeated request and releases older holds', () => {
    const { patient } = register('01711000013')
    const [s1, s2] = openSlots(api.getAvailability('d02', {}))
    const first = api.hold(patient, { doctorId: 'd02', date: s1!.date, start: s1!.start })
    expect(api.hold(patient, { doctorId: 'd02', date: s1!.date, start: s1!.start }).id).toBe(
      first.id,
    )
    api.hold(patient, { doctorId: 'd02', date: s2!.date, start: s2!.start })
    expect(db.get('appointments', first.id)).toBeUndefined()
  })

  it('refuses to confirm an expired hold', () => {
    const { patient } = register('01711000014')
    const slot = firstOpenSlot()
    const held = api.hold(patient, { doctorId: 'd02', date: slot.date, start: slot.start })
    advance(5.5)
    expect(errorCode(() => api.confirm(patient, held.id))).toBe('HOLD_EXPIRED')
  })

  it('rejects past slots, leave days and bad input', () => {
    const { patient } = register('01711000015')
    const leave = db.all('leaveDays').find((l) => l.date > '2026-10-04')!
    const doctor = db.get('doctors', leave.doctorId)!
    const start = api.getAvailability(doctor.id, { from: leave.date, days: 1 })[0]!.onLeave
    expect(start).toBe(true)
    const ruleStart = doctor.schedule[0]!.start
    expect(
      errorCode(() =>
        api.hold(patient, { doctorId: doctor.id, date: leave.date, start: ruleStart }),
      ),
    ).toMatch(/DOCTOR_ON_LEAVE|VALIDATION/)
    expect(
      errorCode(() => api.hold(patient, { doctorId: 'd01', date: '2026-10-04', start: '17:00' })),
    ).toBe('SLOT_IN_PAST')
    expect(
      errorCode(() => api.hold(patient, { doctorId: 'd02', date: 'tomorrow', start: '10:00' })),
    ).toBe('VALIDATION')
  })

  it('reschedules by holding the new slot and cancelling the old one on confirm', () => {
    const { patient } = register('01711000016')
    const [s1, s2] = openSlots(api.getAvailability('d02', {}))
    const original = api.confirm(
      patient,
      api.hold(patient, { doctorId: 'd02', date: s1!.date, start: s1!.start }).id,
    )
    const held = api.hold(patient, {
      doctorId: 'd02',
      date: s2!.date,
      start: s2!.start,
      rescheduleOf: original.id,
    })
    expect(api.getAppointment(patient, held.id).rescheduledFrom?.id).toBe(original.id)
    api.confirm(patient, held.id)
    expect(db.get('appointments', original.id)).toMatchObject({
      status: 'cancelled',
      cancelReason: 'rescheduled',
    })
    expect(api.listSms(1)[0]!.kind).toBe('reschedule')
    expect(api.listMine(patient, 'upcoming').map((a) => a.id)).toEqual([held.id])
  })

  it('lets a patient cancel only a booked appointment', () => {
    const { patient } = register('01711000017')
    const slot = firstOpenSlot()
    const booked = api.confirm(
      patient,
      api.hold(patient, { doctorId: 'd02', date: slot.date, start: slot.start }).id,
    )
    expect(api.cancel(patient, booked.id).status).toBe('cancelled')
    expect(errorCode(() => api.cancel(patient, booked.id))).toBe('VALIDATION')
    expect(api.listMine(patient, 'past')[0]!.id).toBe(booked.id)
  })
})

describe('AI assistant', () => {
  it('asks follow-ups, then suggests doctors in the specialty with open slots', () => {
    let result = api.startTriage({ problem: 'Stomach pain after meals', lang: 'en' })
    expect(result.session).toMatchObject({
      status: 'needs_answer',
      quickReplies: ['Since today', 'A few days', '1–2 weeks', 'More than a month'],
    })
    result = api.answerTriage(result.session.id, { answer: 'A few days' })
    result = api.answerTriage(result.session.id, { answer: 'Severe' })
    expect(result.session).toMatchObject({
      status: 'complete',
      specialtyId: 'gastroenterology',
      urgency: 'within_48h',
    })
    expect(result.session.answers).toHaveLength(2)
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(
      result.suggestions.every(
        (s) => s.doctor.specialtyId === 'gastroenterology' && s.slots.length > 0,
      ),
    ).toBe(true)
    const firsts = result.suggestions.map((s) => `${s.slots[0]!.date} ${s.slots[0]!.start}`)
    expect([...firsts].sort()).toEqual(firsts)
  })

  it('returns only the emergency notice for emergency symptoms', () => {
    const result = api.startTriage({ problem: 'হঠাৎ বুকে ব্যথা', lang: 'bn' })
    expect(result.session.status).toBe('emergency')
    expect(result.suggestions).toEqual([])
  })

  it('links the conversation and its pre-visit summary to the booking', () => {
    const { patient } = register('01711000020')
    let result = api.startTriage({
      problem: 'Fever and body ache for three days, moderate',
      lang: 'en',
    })
    expect(result.session.status).toBe('complete')
    const slot = result.suggestions[0]!.slots[0]!
    const held = api.hold(patient, {
      doctorId: result.suggestions[0]!.doctor.id,
      date: slot.date,
      start: slot.start,
      triageId: result.session.id,
    })
    const booked = api.confirm(patient, held.id)
    expect(booked.summary).toMatchObject({ duration: 'three days', severity: 'moderate' })
    expect(db.get('triage', result.session.id)!.patientId).toBe(patient.id)
  })
})

describe('front desk and queue', () => {
  it('calls the arrived patient with the lowest serial and moves the queue', () => {
    const sheet = api.daySheet('d01', '2026-10-04')
    const current = sheet.appointments.find((a) => a.status === 'in_consultation')!
    const arrived = sheet.appointments.filter((a) => a.status === 'arrived')
    expect(sheet.nowServing).toBe(current.serial)
    const booked = sheet.appointments.find(
      (a) => a.status === 'booked' && a.serial > current.serial,
    )!
    api.setStatus(booked.id, { status: 'arrived' })

    const after = api.callNext({ doctorId: 'd01', date: '2026-10-04' })
    const expectedNext = [...arrived, booked].sort((a, b) => a.serial - b.serial)[0]!
    expect(after.nowServing).toBe(expectedNext.serial)
    expect(after.appointments.find((a) => a.id === current.id)!.status).toBe('seen')
  })

  it('rejects impossible status changes', () => {
    const seen = api.daySheet('d01', '2026-10-04').appointments.find((a) => a.status === 'seen')!
    expect(errorCode(() => api.setStatus(seen.id, { status: 'arrived' }))).toBe('VALIDATION')
  })

  it('shows a patient how many are ahead and when they will be seen', () => {
    const { patient } = register('01711000030')
    // The session is under way, so only the front desk can still book it.
    const slot = api
      .daySheet('d01', '2026-10-04')
      .sessions.flatMap((s) => s.slots)
      .find((s) => s.available)!
    const booked = api.bookForPatient({
      patientId: patient.id,
      doctorId: 'd01',
      date: slot.date,
      start: slot.start,
      source: 'walk_in',
    })
    const status = api.queueStatus(patient, booked.id)
    expect(status.ahead).toBeGreaterThan(0)
    expect(status.nowServing).not.toBeNull()
    expect(status.estimatedTime! >= slot.start).toBe(true)
  })

  it('registers a phone patient and books them without OTP', () => {
    const patient = api.createPatient({
      name: 'Walk In',
      phone: '+8801811000040',
      age: 60,
      sex: 'male',
    })
    expect(patient).toMatchObject({ phone: '01811000040', registeredBy: 'front_desk' })
    expect(api.findPatient('01811-000040').id).toBe(patient.id)
    const slot = firstOpenSlot('d03')
    const booked = api.bookForPatient({
      patientId: patient.id,
      doctorId: 'd03',
      date: slot.date,
      start: slot.start,
      source: 'phone',
    })
    expect(booked).toMatchObject({ status: 'booked', source: 'phone', patient: { id: patient.id } })
    expect(
      errorCode(() =>
        api.bookForPatient({
          patientId: patient.id,
          doctorId: 'd03',
          date: slot.date,
          start: slot.start,
          source: 'walk_in',
        }),
      ),
    ).toBe('SLOT_TAKEN')
  })
})

describe('rules from the requirements interviews', () => {
  it('keeps one upcoming online booking per doctor; a second one is a reschedule', () => {
    const { patient } = register('01711000050')
    const [first, second] = openSlots(api.getAvailability('d02', {}))
    const booked = api.confirm(
      patient,
      api.hold(patient, { doctorId: 'd02', date: first!.date, start: first!.start }).id,
    )
    expect(
      errorCode(() =>
        api.hold(patient, { doctorId: 'd02', date: second!.date, start: second!.start }),
      ),
    ).toBe('ALREADY_BOOKED')
    const moved = api.hold(patient, {
      doctorId: 'd02',
      date: second!.date,
      start: second!.start,
      rescheduleOf: booked.id,
    })
    expect(moved.status).toBe('held')
    // Another doctor is fine.
    const other = firstOpenSlot('d03')
    expect(
      api.hold(patient, { doctorId: 'd03', date: other.date, start: other.start }).status,
    ).toBe('held')
  })

  it('closes online booking before a session, but the front desk can still book it', () => {
    // 18:10 on Sunday: Dr. Mahmudul Hasan's 17:00–21:00 session is under way.
    const online = api.getAvailability('d01', { days: 1 })[0]!.sessions[0]!
    expect(online.closed).toBe(true)
    expect(online.slots.some((s) => s.available)).toBe(false)
    const desk = api.daySheet('d01', '2026-10-04').sessions[0]!
    expect(desk.closed).toBeUndefined()
    const free = desk.slots.find((s) => s.available)!

    const { patient } = register('01711000051')
    expect(
      errorCode(() => api.hold(patient, { doctorId: 'd01', date: free.date, start: free.start })),
    ).toBe('BOOKING_CLOSED')
    const booked = api.bookForPatient({
      patientId: patient.id,
      doctorId: 'd01',
      date: free.date,
      start: free.start,
      source: 'walk_in',
    })
    expect(booked.status).toBe('booked')
  })

  it('lets the admin set the cut-off, within limits', () => {
    expect(api.getSettings().booking.closeMinutesBefore).toBe(60)
    const reminder = api.getSettings().reminder
    expect(
      errorCode(() =>
        api.putSettings({ reminder, booking: { openDays: 14, closeMinutesBefore: 300 } }),
      ),
    ).toBe('VALIDATION')
    api.putSettings({ reminder, booking: { openDays: 14, closeMinutesBefore: 30 } })
    expect(api.getSettings().booking.closeMinutesBefore).toBe(30)
    // Settings saved before the cut-off existed fall back to the default.
    db.put('settings', { id: 'settings', reminder, booking: { openDays: 14 } } as never)
    expect(api.getSettings().booking.closeMinutesBefore).toBe(60)
  })

  it('checks in a no-show who turns up late', () => {
    const booked = api
      .daySheet('d01', '2026-10-04')
      .appointments.find((a) => a.status === 'booked')!
    api.setStatus(booked.id, { status: 'no_show' })
    expect(api.setStatus(booked.id, { status: 'arrived' }).status).toBe('arrived')
  })

  it('tells staff whether each patient has seen this doctor before', () => {
    const sheet = api.daySheet('d01', '2026-10-04')
    for (const a of sheet.appointments) {
      const earlier = db
        .all('appointments')
        .filter(
          (b) =>
            b.patientId === a.patientId &&
            b.doctorId === 'd01' &&
            b.status === 'seen' &&
            b.date < a.date,
        )
        .map((b) => b.date)
        .sort()
      expect(a.previousVisits).toEqual({ count: earlier.length, last: earlier.at(-1) ?? null })
    }
    expect(sheet.appointments.some((a) => a.previousVisits!.count > 0)).toBe(true)
  })
})

describe('admin', () => {
  it('adding a leave day cancels that day’s bookings and texts each patient', () => {
    const date = '2026-10-05'
    const impact = api.leaveImpact('d02', date)
    expect(impact.appointments).toBeGreaterThan(0)
    const smsBefore = db.all('sms').length
    const result = api.addLeaveDay({ doctorId: 'd02', date, reason: 'Sick' })
    expect(result.cancelled).toBe(impact.appointments)
    expect(db.all('sms').length - smsBefore).toBe(impact.appointments)
    expect(api.listSms(1)[0]!.body).toContain('is on leave')
    expect(api.getAvailability('d02', { from: date, days: 1 })[0]!.onLeave).toBe(true)
    expect(errorCode(() => api.addLeaveDay({ doctorId: 'd02', date }))).toBe('VALIDATION')
  })

  it('validates doctor schedules', () => {
    const input = {
      ...db.get('doctors', 'd02')!,
      schedule: [
        {
          weekday: 1 as const,
          start: '13:00',
          end: '10:00',
          slotMinutes: 10,
          maxPatients: 10,
          room: 'R',
        },
      ],
    }
    expect(errorCode(() => api.updateDoctor('d02', input))).toBe('VALIDATION')
  })

  it('enforces staff roles', () => {
    expect(errorCode(() => api.staffLogin({ username: 'admin', password: 'wrong' }))).toBe(
      'UNAUTHENTICATED',
    )
    const { sessionId } = api.staffLogin({ username: 'frontdesk', password: 'frontdesk123' })
    expect(api.staffForSession(sessionId, ['front_desk', 'admin']).role).toBe('front_desk')
    expect(errorCode(() => api.staffForSession(sessionId, ['admin']))).toBe('FORBIDDEN')
    const doctor = api.staffLogin({ username: 'dr.mahmudul', password: 'doctor123' }).user
    expect(api.doctorDay(doctor, '2026-10-04').doctorId).toBe('d01')
  })

  it('adds up the analytics', () => {
    const a = api.analytics('2026-09-05', '2026-10-04')
    expect(a.byDay).toHaveLength(30)
    const kept = a.totalBookings - a.cancelled
    expect(a.bySpecialty.reduce((n, s) => n + s.count, 0)).toBe(kept)
    expect(a.byHour.reduce((n, h) => n + h.count, 0)).toBe(kept)
    expect(a.noShowRate).toBeGreaterThan(0)
    expect(a.noShowRate).toBeLessThan(0.3)
    expect(a.commonProblems.length).toBe(10)
  })
})

describe('MockDb persistence', () => {
  it('keeps demo changes across reloads on the same day', () => {
    const { patient } = register('01711000050')
    const reloaded = new MockDb(storage, now)
    expect(reloaded.get('patients', patient.id)).toEqual(patient)
    expect((storage.getItem(STORAGE_KEY) ?? '').length).toBeLessThan(20_000)
  })

  it('starts fresh on a new day', () => {
    const { patient } = register('01711000051')
    advance(24 * 60)
    expect(new MockDb(storage, now).get('patients', patient.id)).toBeUndefined()
  })

  it('reset throws the changes away', () => {
    const { patient } = register('01711000052')
    db.reset()
    expect(db.get('patients', patient.id)).toBeUndefined()
  })
})
