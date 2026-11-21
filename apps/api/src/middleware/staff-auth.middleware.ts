import type { Patient, StaffRole, StaffUser } from '@inovexa/shared'
import type { CookieOptions, NextFunction, Request, Response } from 'express'
import type { AppConfig } from '../config.ts'
import type { HospitalService } from '../services/hospital.ts'

export const PATIENT_COOKIE = 'sid'
export const STAFF_COOKIE = 'staff_sid'

export interface AuthedRequest extends Request {
  patient?: Patient
  staff?: StaffUser
}

export function createAuthMiddleware(service: HospitalService, config: AppConfig) {
  const cookieOpts = (maxAgeMs: number): CookieOptions => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  })

  const clearCookieOpts: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  }

  const patientSid = (req: Request): string | undefined =>
    typeof req.cookies?.[PATIENT_COOKIE] === 'string' ? req.cookies[PATIENT_COOKIE] : undefined

  const staffSid = (req: Request): string | undefined =>
    typeof req.cookies?.[STAFF_COOKIE] === 'string' ? req.cookies[STAFF_COOKIE] : undefined

  const requirePatient = async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      req.patient = await service.patientForSession(patientSid(req))
      next()
    } catch (err) {
      next(err)
    }
  }

  const requireStaff = (allowedRoles?: StaffRole[]) => {
    return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
      try {
        req.staff = await service.staffForSession(staffSid(req), allowedRoles)
        next()
      } catch (err) {
        next(err)
      }
    }
  }

  return {
    cookieOpts,
    clearCookieOpts,
    patientSid,
    staffSid,
    requirePatient,
    requireStaff,
  }
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>
