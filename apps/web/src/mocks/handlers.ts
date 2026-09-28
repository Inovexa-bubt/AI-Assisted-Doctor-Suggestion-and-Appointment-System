// Maps the HTTP contract in docs/design/api.md onto MockBackend. Runs in the browser page (MSW's
// request handlers execute in the page, not in the service worker), so it can manage the session
// cookies itself.

import type { StaffRole } from '@inovexa/shared'
import { type HttpResponseResolver, HttpResponse, delay, http } from 'msw'
import { ApiError, type MockBackend } from './backend.ts'

const BASE = '/api/v1'
const PATIENT_COOKIE = 'sid'
const STAFF_COOKIE = 'staff_sid'

function readCookie(name: string): string | undefined {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

function writeCookie(name: string, value: string | null) {
  document.cookie =
    value === null
      ? `${name}=; Path=/; Max-Age=0; SameSite=Lax`
      : `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`
}

type Ctx = {
  params: Record<string, string>
  query: URLSearchParams
  body: Record<string, unknown>
  request: Request
}

/** Wraps a backend call: JSON in, JSON out, ApiError → error body, a short realistic delay. */
function route(fn: (ctx: Ctx) => unknown, status = 200): HttpResponseResolver {
  return async ({ request, params }) => {
    await delay(import.meta.env.MODE === 'test' ? 0 : 120 + Math.random() * 200)
    try {
      const isJson = request.headers.get('content-type')?.includes('application/json')
      const body = isJson ? ((await request.json()) as Record<string, unknown>) : {}
      const result = await fn({
        params: params as Record<string, string>,
        query: new URL(request.url).searchParams,
        body,
        request,
      })
      return result === undefined
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(result as object, { status })
    } catch (e) {
      if (e instanceof ApiError) {
        return HttpResponse.json(
          { error: { code: e.code, message: e.message } },
          { status: e.status },
        )
      }
      console.error(e)
      return HttpResponse.json(
        { error: { code: 'VALIDATION', message: String(e) } },
        { status: 500 },
      )
    }
  }
}

export function createHandlers(api: MockBackend) {
  const patient = () => api.patientForSession(readCookie(PATIENT_COOKIE))
  const staff = (...roles: StaffRole[]) =>
    api.staffForSession(readCookie(STAFF_COOKIE), roles.length ? roles : undefined)
  const desk = () => staff('front_desk', 'admin')
  const admin = () => staff('admin')

  return [
    // Public
    http.get(
      `${BASE}/specialties`,
      route(() => api.listSpecialties()),
    ),
    http.get(
      `${BASE}/doctors`,
      route(({ query }) =>
        api.listDoctors({
          specialtyId: query.get('specialtyId') ?? undefined,
          q: query.get('q') ?? undefined,
        }),
      ),
    ),
    http.get(
      `${BASE}/doctors/:id`,
      route(({ params }) => api.getDoctor(params.id!)),
    ),
    http.get(
      `${BASE}/doctors/:id/availability`,
      route(({ params, query }) =>
        api.getAvailability(params.id!, {
          from: query.get('from') ?? undefined,
          days: query.get('days') ? Number(query.get('days')) : undefined,
        }),
      ),
    ),
    http.post(
      `${BASE}/triage`,
      route(({ body }) => api.startTriage(body)),
    ),
    http.post(
      `${BASE}/triage/:id/answers`,
      route(({ params, body }) => api.answerTriage(params.id!, body)),
    ),
    http.post(
      `${BASE}/speech/transcribe`,
      route(async ({ request }) => {
        const form = await request.formData()
        return api.transcribe(form.get('lang') as string | null)
      }),
    ),

    // Patient sign-in
    http.post(
      `${BASE}/auth/otp`,
      route(({ body }) => api.requestOtp(body)),
    ),
    http.post(
      `${BASE}/auth/verify`,
      route(({ body }) => {
        const { sessionId, ...result } = api.verifyOtp(body)
        writeCookie(PATIENT_COOKIE, sessionId)
        return result
      }),
    ),
    http.post(
      `${BASE}/auth/profile`,
      route(({ body }) => api.completeProfile(readCookie(PATIENT_COOKIE), body)),
    ),
    http.get(
      `${BASE}/auth/me`,
      route(() => patient()),
    ),
    http.post(
      `${BASE}/auth/logout`,
      route(() => {
        api.logout(readCookie(PATIENT_COOKIE))
        writeCookie(PATIENT_COOKIE, null)
      }),
    ),

    // Patient appointments
    http.post(
      `${BASE}/appointments/holds`,
      route(({ body }) => api.hold(patient(), body), 201),
    ),
    http.get(
      `${BASE}/appointments`,
      route(({ query }) => api.listMine(patient(), query.get('scope'))),
    ),
    http.get(
      `${BASE}/appointments/:id`,
      route(({ params }) => api.getAppointment(patient(), params.id!)),
    ),
    http.post(
      `${BASE}/appointments/:id/confirm`,
      route(({ params }) => api.confirm(patient(), params.id!)),
    ),
    http.delete(
      `${BASE}/appointments/:id/hold`,
      route(({ params }) => api.releaseHold(patient(), params.id!)),
    ),
    http.post(
      `${BASE}/appointments/:id/cancel`,
      route(({ params }) => api.cancel(patient(), params.id!)),
    ),
    http.get(
      `${BASE}/appointments/:id/queue`,
      route(({ params }) => api.queueStatus(patient(), params.id!)),
    ),

    // Staff sign-in
    http.post(
      `${BASE}/staff/login`,
      route(({ body }) => {
        const { sessionId, user } = api.staffLogin(body)
        writeCookie(STAFF_COOKIE, sessionId)
        return user
      }),
    ),
    http.get(
      `${BASE}/staff/me`,
      route(() => staff()),
    ),
    http.post(
      `${BASE}/staff/logout`,
      route(() => {
        api.logout(readCookie(STAFF_COOKIE))
        writeCookie(STAFF_COOKIE, null)
      }),
    ),

    // Admin
    http.get(
      `${BASE}/admin/specialties`,
      route(() => (admin(), api.listAllSpecialties())),
    ),
    http.post(
      `${BASE}/admin/specialties`,
      route(({ body }) => (admin(), api.createSpecialty(body)), 201),
    ),
    http.put(
      `${BASE}/admin/specialties/:id`,
      route(({ params, body }) => (admin(), api.updateSpecialty(params.id!, body))),
    ),
    http.get(
      `${BASE}/admin/doctors`,
      route(() => (admin(), api.listAllDoctors())),
    ),
    http.post(
      `${BASE}/admin/doctors`,
      route(({ body }) => (admin(), api.createDoctor(body)), 201),
    ),
    http.put(
      `${BASE}/admin/doctors/:id`,
      route(({ params, body }) => (admin(), api.updateDoctor(params.id!, body))),
    ),
    http.get(
      `${BASE}/admin/leave-days`,
      route(({ query }) => (admin(), api.listLeaveDays(query.get('doctorId')))),
    ),
    http.get(
      `${BASE}/admin/leave-days/impact`,
      route(
        ({ query }) => (
          admin(),
          api.leaveImpact(query.get('doctorId') ?? '', query.get('date') ?? '')
        ),
      ),
    ),
    http.post(
      `${BASE}/admin/leave-days`,
      route(({ body }) => (admin(), api.addLeaveDay(body)), 201),
    ),
    http.delete(
      `${BASE}/admin/leave-days/:id`,
      route(({ params }) => (admin(), api.removeLeaveDay(params.id!))),
    ),
    http.get(
      `${BASE}/admin/settings`,
      route(() => (admin(), api.getSettings())),
    ),
    http.put(
      `${BASE}/admin/settings`,
      route(({ body }) => (admin(), api.putSettings(body))),
    ),
    http.get(
      `${BASE}/admin/sms`,
      route(({ query }) => (admin(), api.listSms(Number(query.get('limit'))))),
    ),
    http.get(
      `${BASE}/admin/staff`,
      route(() => (admin(), api.listStaff())),
    ),
    http.post(
      `${BASE}/admin/staff`,
      route(({ body }) => (admin(), api.createStaff(body)), 201),
    ),

    // Front desk
    http.get(
      `${BASE}/frontdesk/day`,
      route(
        ({ query }) => (desk(), api.daySheet(query.get('doctorId') ?? '', query.get('date') ?? '')),
      ),
    ),
    http.post(
      `${BASE}/frontdesk/appointments/:id/status`,
      route(({ params, body }) => (desk(), api.setStatus(params.id!, body))),
    ),
    http.post(
      `${BASE}/frontdesk/queue/next`,
      route(({ body }) => (desk(), api.callNext(body))),
    ),
    http.get(
      `${BASE}/frontdesk/patients`,
      route(({ query }) => (desk(), api.findPatient(query.get('phone')))),
    ),
    http.post(
      `${BASE}/frontdesk/patients`,
      route(({ body }) => (desk(), api.createPatient(body)), 201),
    ),
    http.post(
      `${BASE}/frontdesk/appointments`,
      route(({ body }) => (desk(), api.bookForPatient(body)), 201),
    ),

    // Doctor
    http.get(
      `${BASE}/doctor/day`,
      route(({ query }) => api.doctorDay(staff('doctor'), query.get('date'))),
    ),

    // Analytics
    http.get(
      `${BASE}/analytics`,
      route(({ query }) => (admin(), api.analytics(query.get('from'), query.get('to')))),
    ),
  ]
}
