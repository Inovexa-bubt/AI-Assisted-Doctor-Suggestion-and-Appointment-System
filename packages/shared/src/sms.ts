import type { SmsKind } from './types.ts'

const HOSPITAL = 'Lumina Specialized Hospital'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-10-05' → '5 Oct'. */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]}`
}

export interface SmsDetails {
  doctorName: string
  date: string
  start: string
  serial: number
  room?: string
  /** Cancellation because the doctor is on leave. */
  onLeave?: boolean
}

/**
 * SMS wording, shared by the mock and the real backend. English keeps each message to one
 * 160-character segment; Bangla SMS costs more per message. To confirm with the client.
 */
export function smsBody(kind: Exclude<SmsKind, 'otp'>, d: SmsDetails): string {
  const when = `${shortDate(d.date)}, ${d.start}`
  const room = d.room ? ` ${d.room}.` : ''
  switch (kind) {
    case 'confirmation':
      return `${HOSPITAL}: Booked with ${d.doctorName} on ${when}, serial ${d.serial}.${room}`
    case 'reschedule':
      return `${HOSPITAL}: Moved to ${when} with ${d.doctorName}, serial ${d.serial}.${room}`
    case 'cancellation':
      return d.onLeave
        ? `${HOSPITAL}: ${d.doctorName} is on leave on ${shortDate(d.date)}. Your ${d.start} appointment is cancelled. Please book again.`
        : `${HOSPITAL}: Your appointment with ${d.doctorName} on ${when} is cancelled.`
    case 'reminder':
      return `${HOSPITAL}: Reminder: ${d.doctorName}, ${when}, serial ${d.serial}.${room}`
  }
}

export function otpBody(code: string): string {
  return `${HOSPITAL}: Your code is ${code}. It expires in 5 minutes. Do not share it.`
}

/** OTP messages are stored with the code masked. */
export function maskedOtpBody(): string {
  return otpBody('******')
}
