import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Appointment,
  type DaySheet,
  type DoctorListItem,
  type QueueStatus,
  type SmsMessage,
  type TriageResult,
  dhakaInstant,
  openSlots,
} from '@inovexa/shared'
import { io as createSocketClient } from 'socket.io-client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { type Db, createDb } from './db/client.ts'
import { seedDatabase, stableUuid } from './db/seed.ts'
import { createAiProvider } from './providers/ai.ts'
import { createSmsProvider } from './providers/sms.ts'
import { createSttProvider } from './providers/stt.ts'
import { type QueueBroadcaster, createQueueHub } from './realtime.ts'
import { HospitalService } from './services/hospital.ts'

// Sunday 4 October 2026, 15:00 Dhaka time (before 17:00 evening sessions, so 17:00 is outside 60-min cut-off).
const BASE_TIME = dhakaInstant('2026-10-04', '15:00')

describe('Lumina Hospital API (PostgreSQL + Socket.IO)', () => {
  let db: Db
  let clock: Date
  let service: HospitalService
  let queue: QueueBroadcaster
  let server: ReturnType<typeof createServer>
  let baseUrl: string

  beforeAll(async () => {
    db = await createDb('memory://')
    const config = loadConfig({
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      STT_PROVIDER: 'mock',
      SMS_PROVIDER: 'sandbox',
      COOKIE_SECURE: 'false',
    })
    clock = new Date(BASE_TIME)
    queue = createQueueHub()
    service = new HospitalService({
      db,
      ai: createAiProvider(config),
      sms: createSmsProvider(config),
      queue,
      now: () => clock,
      exposeDemoOtp: true,
    })
    const app = createApp({ service, stt: createSttProvider(config), config })
    server = createServer(app)
    queue.attach?.(server, '*')
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  beforeEach(async () => {
    clock = new Date(BASE_TIME)
    await seedDatabase(db, { now: clock, seed: 42, compact: true })
  })

  afterAll(async () => {
    await queue.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await db.close()
  })

  async function registerPatient(phone: string, name = 'Test Patient') {
    const agent = request.agent(baseUrl)
    const otpRes = await agent.post('/api/v1/auth/otp').send({ phone }).expect(200)
    const demoCode = otpRes.body.demoCode as string
    expect(demoCode).toMatch(/^\d{6}$/)
    const verifyRes = await agent
      .post('/api/v1/auth/verify')
      .send({ phone, code: demoCode })
      .expect(200)
    expect(verifyRes.body.needsProfile).toBe(true)
    const profRes = await agent
      .post('/api/v1/auth/profile')
      .send({ name, age: 32, sex: 'female' })
      .expect(200)
    return { agent, patient: profRes.body }
  }

  async function signInStaff(username: string, password: string) {
    const agent = request.agent(baseUrl)
    const res = await agent.post('/api/v1/staff/login').send({ username, password }).expect(200)
    return { agent, user: res.body }
  }

  it('serves health, specialties, doctors and availability', async () => {
    await request(baseUrl).get('/api/v1/health').expect(200, { ok: true })
    const sp = await request(baseUrl).get('/api/v1/specialties').expect(200)
    expect(sp.body).toHaveLength(14)

    const docs = await request(baseUrl)
      .get('/api/v1/doctors')
      .query({ specialtyId: 'gastroenterology' })
      .expect(200)
    expect((docs.body as DoctorListItem[]).length).toBeGreaterThanOrEqual(2)
    expect((docs.body as DoctorListItem[])[0]!.nextSlot).not.toBeNull()
  })

  it('masks OTP in SMS log, enforces 5-attempt lockout and expiry', async () => {
    const phone = '01711000101'
    const otpRes = await request(baseUrl).post('/api/v1/auth/otp').send({ phone }).expect(200)
    expect(otpRes.body.demoCode).toMatch(/^\d{6}$/)

    // Verify OTP code is masked in DB SMS log.
    const { agent: admin } = await signInStaff('admin', 'admin123')
    const smsRes = await admin.get('/api/v1/admin/sms?limit=5').expect(200)
    const otpSms = (smsRes.body as SmsMessage[]).find((m) => m.kind === 'otp' && m.phone === phone)
    expect(otpSms?.body).toContain('******')
    expect(otpSms?.body).not.toContain(otpRes.body.demoCode)

    for (let i = 0; i < 5; i++) {
      const r = await request(baseUrl)
        .post('/api/v1/auth/verify')
        .send({ phone, code: '000000' })
        .expect(422)
      expect(r.body.error.code).toBe('OTP_INVALID')
    }
    const locked = await request(baseUrl)
      .post('/api/v1/auth/verify')
      .send({ phone, code: otpRes.body.demoCode })
      .expect(429)
    expect(locked.body.error.code).toBe('TOO_MANY_ATTEMPTS')

    // New OTP expires after 5 minutes.
    const otp2 = await request(baseUrl)
      .post('/api/v1/auth/otp')
      .send({ phone: '01711000102' })
      .expect(200)
    clock = new Date(clock.getTime() + 6 * 60_000)
    const exp = await request(baseUrl)
      .post('/api/v1/auth/verify')
      .send({ phone: '01711000102', code: otp2.body.demoCode })
      .expect(422)
    expect(exp.body.error.code).toBe('OTP_EXPIRED')
  })

  it('enforces slot locking, 5-min hold expiry, online cut-off, one booking per doctor, reschedule and cancel', async () => {
    const doctorId = stableUuid('doctor', 'd01') // Dr. Mahmudul Hasan: Sun 17:00-21:00
    const { agent: p1 } = await registerPatient('01711000201', 'Patient One')
    const { agent: p2 } = await registerPatient('01711000202', 'Patient Two')

    const avail = await request(baseUrl).get(`/api/v1/doctors/${doctorId}/availability`).expect(200)
    const free = openSlots(avail.body)
    const [slot1, slot2] = free
    expect(slot1).toBeTruthy()
    expect(slot2).toBeTruthy()

    // Patient 1 holds slot1; Patient 2 cannot hold the same slot (409 SLOT_TAKEN).
    const hold1 = await p1
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot1!.date, start: slot1!.start })
      .expect(201)
    const conflict = await p2
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot1!.date, start: slot1!.start })
      .expect(409)
    expect(conflict.body.error.code).toBe('SLOT_TAKEN')

    // Patient 1 confirms slot1.
    const confirmed = await p1.post(`/api/v1/appointments/${hold1.body.id}/confirm`).expect(200)
    expect(confirmed.body.status).toBe('booked')

    // Patient 1 cannot hold a second booking with the same doctor without rescheduleOf.
    const dup = await p1
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot2!.date, start: slot2!.start })
      .expect(409)
    expect(dup.body.error.code).toBe('ALREADY_BOOKED')

    // Reschedule holds slot2 with rescheduleOf, and confirming atomically cancels slot1.
    const moveHold = await p1
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot2!.date, start: slot2!.start, rescheduleOf: hold1.body.id })
      .expect(201)
    await p1.post(`/api/v1/appointments/${moveHold.body.id}/confirm`).expect(200)

    const upcoming = await p1.get('/api/v1/appointments?scope=upcoming').expect(200)
    expect((upcoming.body as Appointment[]).map((a) => a.id)).toEqual([moveHold.body.id])

    // Cancel the rescheduled booking.
    const cancelled = await p1.post(`/api/v1/appointments/${moveHold.body.id}/cancel`).expect(200)
    expect(cancelled.body.status).toBe('cancelled')

    // Hold expiry returns 410 HOLD_EXPIRED and scheduler cleans it up.
    const holdExp = await p2
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot2!.date, start: slot2!.start })
      .expect(201)
    clock = new Date(clock.getTime() + 6 * 60_000)
    const expRes = await p2.post(`/api/v1/appointments/${holdExp.body.id}/confirm`).expect(410)
    expect(expRes.body.error.code).toBe('HOLD_EXPIRED')

    // Online booking closes 60 min before 17:00 (at 16:15).
    clock = dhakaInstant('2026-10-04', '16:15')
    const closed = await p2
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: '2026-10-04', start: '17:00' })
      .expect(409)
    expect(closed.body.error.code).toBe('BOOKING_CLOSED')
  })

  it('runs emergency check before AI, completes triage, links pre-visit summary and transcribes speech', async () => {
    const em = await request(baseUrl)
      .post('/api/v1/triage')
      .send({ problem: 'Sudden chest pain since morning', lang: 'en' })
      .expect(200)
    expect((em.body as TriageResult).session.status).toBe('emergency')
    expect((em.body as TriageResult).suggestions).toEqual([])

    const t1 = await request(baseUrl)
      .post('/api/v1/triage')
      .send({ problem: 'Stomach pain after meals', lang: 'en' })
      .expect(200)
    expect(t1.body.session.status).toBe('needs_answer')

    const t2 = await request(baseUrl)
      .post(`/api/v1/triage/${t1.body.session.id}/answers`)
      .send({ answer: 'A few days' })
      .expect(200)
    const t3 = await request(baseUrl)
      .post(`/api/v1/triage/${t2.body.session.id}/answers`)
      .send({ answer: 'Severe' })
      .expect(200)
    expect(t3.body.session).toMatchObject({
      status: 'complete',
      specialtyId: 'gastroenterology',
      urgency: 'within_48h',
    })
    expect(t3.body.suggestions.length).toBeGreaterThan(0)

    // Book with triageId and verify pre-visit summary appears on the confirmed booking.
    const { agent: patient } = await registerPatient('01711000301', 'Triage Patient')
    const sugg = t3.body.suggestions[0]
    const slot = sugg.slots[0]
    const held = await patient
      .post('/api/v1/appointments/holds')
      .send({
        doctorId: sugg.doctor.id,
        date: slot.date,
        start: slot.start,
        triageId: t3.body.session.id,
      })
      .expect(201)
    const booked = await patient.post(`/api/v1/appointments/${held.body.id}/confirm`).expect(200)
    expect(booked.body.summary).toMatchObject({ severity: 'severe' })

    // Speech-to-text endpoint works with multipart upload (in-memory only).
    const sttRes = await request(baseUrl)
      .post('/api/v1/speech/transcribe')
      .field('lang', 'bn')
      .attach('audio', Buffer.from('fake-audio-bytes'), {
        filename: 'speech.webm',
        contentType: 'audio/webm',
      })
      .expect(200)
    expect(sttRes.body.text).toBeTruthy()
  })

  it('pushes live Socket.IO queue updates when front desk calls next patient, and enforces doctor/admin RBAC', async () => {
    const doctorId = stableUuid('doctor', 'd01') // Dr. Mahmudul Hasan (Sun 17:00)
    const date = '2026-10-04'
    const { agent: patientAgent } = await registerPatient('01711000401', 'Queue Watcher')
    const { agent: deskAgent } = await signInStaff('frontdesk', 'frontdesk123')

    const avail = await request(baseUrl)
      .get(`/api/v1/doctors/${doctorId}/availability`)
      .query({ from: date, days: 1 })
      .expect(200)
    const slot = openSlots(avail.body)[0]!
    const held = await patientAgent
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date: slot.date, start: slot.start })
      .expect(201)
    const booked = await patientAgent
      .post(`/api/v1/appointments/${held.body.id}/confirm`)
      .expect(200)

    // Connect patient's Socket.IO listener to the doctor's room.
    const sock = createSocketClient(baseUrl, { path: '/socket.io', transports: ['websocket'] })
    await new Promise<void>((resolve) => sock.on('connect', () => resolve()))
    sock.emit('queue:join', { doctorId, date })

    const eventPromise = new Promise<{ doctorId: string; date: string; nowServing: number | null }>(
      (resolve) => {
        sock.once('queue:changed', (payload) => resolve(payload))
      },
    )

    // Mark patient no-show, then check in again (late arrival), then call next!
    await deskAgent
      .post(`/api/v1/frontdesk/appointments/${booked.body.id}/status`)
      .send({ status: 'no_show' })
      .expect(200)
    await deskAgent
      .post(`/api/v1/frontdesk/appointments/${booked.body.id}/status`)
      .send({ status: 'arrived' })
      .expect(200)

    const nextSheet = await deskAgent
      .post('/api/v1/frontdesk/queue/next')
      .send({ doctorId, date })
      .expect(200)
    expect((nextSheet.body as DaySheet).nowServing).not.toBeNull()

    const payload = await eventPromise
    expect(payload.doctorId).toBe(doctorId)
    expect(payload.date).toBe(date)
    expect('patient' in payload).toBe(false)
    sock.disconnect()

    const qRes = await patientAgent.get(`/api/v1/appointments/${booked.body.id}/queue`).expect(200)
    expect((qRes.body as QueueStatus).serial).toBe(slot.serial)

    // RBAC: doctor can view own day sheet, but is 403 on analytics & frontdesk.
    const { agent: docAgent } = await signInStaff('dr.mahmudul', 'doctor123')
    const docSheet = await docAgent.get('/api/v1/doctor/day').query({ date }).expect(200)
    expect(docSheet.body.doctorId).toBe(doctorId)
    await docAgent.get('/api/v1/analytics').expect(403)
    await docAgent.get('/api/v1/frontdesk/day').query({ doctorId, date }).expect(403)
  })

  it('handles admin leave day cancellations, settings, analytics and scheduled reminders', async () => {
    const { agent: admin } = await signInStaff('admin', 'admin123')
    const doctorId = stableUuid('doctor', 'd02') // Dr. Sharmin Akter: Mon 2026-10-05 10:00
    const date = '2026-10-05'

    const { agent: p } = await registerPatient('01711000501', 'Leave Affected')
    const held = await p
      .post('/api/v1/appointments/holds')
      .send({ doctorId, date, start: '10:00' })
      .expect(201)
    await p.post(`/api/v1/appointments/${held.body.id}/confirm`).expect(200)

    // Test scheduled reminders: advance to 19:05 on 2026-10-04 (day before at 19:00).
    clock = dhakaInstant('2026-10-04', '19:05')
    const firstBatch = await service.sendDueReminders()
    expect(firstBatch).toBeGreaterThanOrEqual(1)
    // Running again is idempotent (no duplicate reminders).
    expect(await service.sendDueReminders()).toBe(0)

    // Admin checks leave impact and adds leave day -> cancels booking + sends SMS.
    const impact = await admin
      .get('/api/v1/admin/leave-days/impact')
      .query({ doctorId, date })
      .expect(200)
    expect(impact.body.appointments).toBeGreaterThanOrEqual(1)

    const added = await admin
      .post('/api/v1/admin/leave-days')
      .send({ doctorId, date, reason: 'Medical conference' })
      .expect(201)
    expect(added.body.cancelled).toBe(impact.body.appointments)

    // Analytics endpoint returns summary.
    const analytics = await admin
      .get('/api/v1/analytics')
      .query({ from: '2026-09-05', to: '2026-10-04' })
      .expect(200)
    expect(analytics.body.byDay).toHaveLength(30)
    expect(typeof analytics.body.noShowRate).toBe('number')

    // Admin updates settings including closeMinutesBefore.
    const saved = await admin
      .put('/api/v1/admin/settings')
      .send({
        reminder: { daysBefore: 0, time: '08:00' },
        booking: { openDays: 21, closeMinutesBefore: 30 },
      })
      .expect(200)
    expect(saved.body.booking.closeMinutesBefore).toBe(30)
  })

  it('imports lumina_hospital_seed.sql cleanly into a fresh PostgreSQL database with valid bcrypt hashes', async () => {
    const freshDb = await createDb('memory://')
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const seedPath = path.resolve(__dirname, '../../../lumina_hospital_seed.sql')
      const sql = readFileSync(seedPath, 'utf8').replace(
        /CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i,
        '',
      )
      await freshDb.exec(sql)

      const config = loadConfig({ NODE_ENV: 'test', AI_PROVIDER: 'mock', SMS_PROVIDER: 'sandbox' })
      const freshService = new HospitalService({
        db: freshDb,
        ai: createAiProvider(config),
        sms: createSmsProvider(config),
        queue: { emitQueueChanged() {}, async close() {} },
      })

      expect(await freshService.listSpecialties()).toHaveLength(14)
      expect(await freshService.listAllDoctors()).toHaveLength(22)
      const adminLogin = await freshService.staffLogin({ username: 'admin', password: 'admin123' })
      expect(adminLogin.user.role).toBe('admin')
      const deskLogin = await freshService.staffLogin({
        username: 'frontdesk',
        password: 'frontdesk123',
      })
      expect(deskLogin.user.role).toBe('front_desk')
      const docLogin = await freshService.staffLogin({
        username: 'dr.tanvir',
        password: 'doctor123',
      })
      expect(docLogin.user.role).toBe('doctor')
    } finally {
      await freshDb.close()
    }
  })
})
