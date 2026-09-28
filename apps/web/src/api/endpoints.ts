// One typed function per endpoint in docs/design/api.md.

import type {
  AnalyticsSummary,
  Appointment,
  AppointmentSource,
  AppointmentView,
  AvailabilityDay,
  DaySheet,
  Doctor,
  DoctorInput,
  DoctorListItem,
  Lang,
  LeaveDay,
  Patient,
  QueueStatus,
  Settings,
  Sex,
  SmsMessage,
  Specialty,
  SpecialtyInput,
  StaffRole,
  StaffUser,
  TriageResult,
} from '@inovexa/shared'
import { request } from './client.ts'

export interface PersonInput {
  name: string
  age: number
  sex: Sex
}

export const api = {
  // Public
  specialties: () => request<Specialty[]>('GET', '/specialties'),
  doctors: (query: { specialtyId?: string; q?: string } = {}) =>
    request<DoctorListItem[]>('GET', '/doctors', { query }),
  doctor: (id: string) => request<Doctor>('GET', `/doctors/${id}`),
  availability: (id: string, query: { from?: string; days?: number } = {}) =>
    request<AvailabilityDay[]>('GET', `/doctors/${id}/availability`, { query }),
  startTriage: (problem: string, lang: Lang) =>
    request<TriageResult>('POST', '/triage', { body: { problem, lang } }),
  answerTriage: (id: string, answer: string) =>
    request<TriageResult>('POST', `/triage/${id}/answers`, { body: { answer } }),
  transcribe: (audio: Blob, lang: Lang) => {
    const form = new FormData()
    form.set('audio', audio, 'speech.webm')
    form.set('lang', lang)
    return request<{ text: string }>('POST', '/speech/transcribe', { form })
  },

  // Patient sign-in
  requestOtp: (phone: string) =>
    request<{ expiresInSeconds: number; demoCode?: string }>('POST', '/auth/otp', {
      body: { phone },
    }),
  verifyOtp: (phone: string, code: string) =>
    request<{ patient: Patient | null; needsProfile: boolean }>('POST', '/auth/verify', {
      body: { phone, code },
    }),
  completeProfile: (input: PersonInput) =>
    request<Patient>('POST', '/auth/profile', { body: input }),
  me: () => request<Patient>('GET', '/auth/me'),
  logout: () => request<void>('POST', '/auth/logout'),

  // Patient appointments
  hold: (body: {
    doctorId: string
    date: string
    start: string
    triageId?: string
    rescheduleOf?: string
  }) => request<Appointment>('POST', '/appointments/holds', { body }),
  appointment: (id: string) => request<AppointmentView>('GET', `/appointments/${id}`),
  confirm: (id: string) => request<AppointmentView>('POST', `/appointments/${id}/confirm`),
  releaseHold: (id: string) => request<void>('DELETE', `/appointments/${id}/hold`),
  myAppointments: (scope: 'upcoming' | 'past') =>
    request<AppointmentView[]>('GET', '/appointments', { query: { scope } }),
  cancel: (id: string) => request<AppointmentView>('POST', `/appointments/${id}/cancel`),
  queue: (id: string) => request<QueueStatus>('GET', `/appointments/${id}/queue`),

  // Staff
  staffLogin: (username: string, password: string) =>
    request<StaffUser>('POST', '/staff/login', { body: { username, password } }),
  staffMe: () => request<StaffUser>('GET', '/staff/me'),
  staffLogout: () => request<void>('POST', '/staff/logout'),

  // Admin
  adminSpecialties: () => request<Specialty[]>('GET', '/admin/specialties'),
  createSpecialty: (input: SpecialtyInput) =>
    request<Specialty>('POST', '/admin/specialties', { body: input }),
  updateSpecialty: (id: string, input: SpecialtyInput) =>
    request<Specialty>('PUT', `/admin/specialties/${id}`, { body: input }),
  adminDoctors: () => request<Doctor[]>('GET', '/admin/doctors'),
  createDoctor: (input: DoctorInput) => request<Doctor>('POST', '/admin/doctors', { body: input }),
  updateDoctor: (id: string, input: DoctorInput) =>
    request<Doctor>('PUT', `/admin/doctors/${id}`, { body: input }),
  leaveDays: (doctorId?: string) =>
    request<LeaveDay[]>('GET', '/admin/leave-days', { query: { doctorId } }),
  leaveImpact: (doctorId: string, date: string) =>
    request<{ appointments: number }>('GET', '/admin/leave-days/impact', {
      query: { doctorId, date },
    }),
  addLeaveDay: (body: { doctorId: string; date: string; reason: string }) =>
    request<{ leaveDay: LeaveDay; cancelled: number; smsSent: number }>(
      'POST',
      '/admin/leave-days',
      { body },
    ),
  removeLeaveDay: (id: string) => request<void>('DELETE', `/admin/leave-days/${id}`),
  settings: () => request<Settings>('GET', '/admin/settings'),
  saveSettings: (settings: Settings) =>
    request<Settings>('PUT', '/admin/settings', { body: settings }),
  sms: (limit = 100) => request<SmsMessage[]>('GET', '/admin/sms', { query: { limit } }),
  staffAccounts: () => request<StaffUser[]>('GET', '/admin/staff'),
  createStaffAccount: (body: {
    name: string
    username: string
    password: string
    role: StaffRole
    doctorId?: string
  }) => request<StaffUser>('POST', '/admin/staff', { body }),

  // Front desk
  daySheet: (doctorId: string, date: string) =>
    request<DaySheet>('GET', '/frontdesk/day', { query: { doctorId, date } }),
  setStatus: (id: string, status: 'arrived' | 'seen' | 'no_show') =>
    request<AppointmentView>('POST', `/frontdesk/appointments/${id}/status`, { body: { status } }),
  callNext: (doctorId: string, date: string) =>
    request<DaySheet>('POST', '/frontdesk/queue/next', { body: { doctorId, date } }),
  findPatient: (phone: string) =>
    request<Patient>('GET', '/frontdesk/patients', { query: { phone } }),
  createPatient: (input: PersonInput & { phone: string }) =>
    request<Patient>('POST', '/frontdesk/patients', { body: input }),
  bookForPatient: (body: {
    patientId: string
    doctorId: string
    date: string
    start: string
    source: Exclude<AppointmentSource, 'online'>
  }) => request<AppointmentView>('POST', '/frontdesk/appointments', { body }),

  // Doctor
  doctorDay: (date: string) => request<DaySheet>('GET', '/doctor/day', { query: { date } }),

  // Analytics
  analytics: (from: string, to: string) =>
    request<AnalyticsSummary>('GET', '/analytics', { query: { from, to } }),
}
