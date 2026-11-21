import type { ErrorCode } from '@inovexa/shared'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode

  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const STATUS_FOR: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  DOCTOR_ON_LEAVE: 409,
  SLOT_IN_PAST: 409,
  BOOKING_CLOSED: 409,
  ALREADY_BOOKED: 409,
  HOLD_EXPIRED: 410,
  OTP_INVALID: 422,
  OTP_EXPIRED: 422,
  TOO_MANY_ATTEMPTS: 429,
}

export const DEFAULT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  SLOT_TAKEN: 'Someone else just took this slot.',
  DOCTOR_ON_LEAVE: 'The doctor is on leave that day.',
  SLOT_IN_PAST: 'This slot has already started.',
  BOOKING_CLOSED:
    'Online booking for this session has closed. Please call or visit the front desk.',
  ALREADY_BOOKED:
    'You already have an upcoming appointment with this doctor. Reschedule it instead.',
  HOLD_EXPIRED: 'The 5-minute hold on this slot has expired.',
  NOT_FOUND: 'Not found.',
  UNAUTHENTICATED: 'Please sign in.',
  FORBIDDEN: 'Your account cannot do this.',
}

export function fail(code: ErrorCode, message = DEFAULT_MESSAGES[code] ?? code): never {
  throw new ApiError(STATUS_FOR[code], code, message)
}

export function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}
