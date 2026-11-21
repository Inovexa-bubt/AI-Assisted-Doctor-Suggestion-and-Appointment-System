import { Router } from 'express'
import {
  type AuthMiddleware,
  type AuthedRequest,
  PATIENT_COOKIE,
} from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAuthRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()

  // POST /api/v1/auth/otp
  router.post('/otp', async (req, res) => {
    res.json(await service.requestOtp(req.body ?? {}, req.ip))
  })

  // POST /api/v1/auth/verify
  router.post('/verify', async (req, res) => {
    const { sessionId, patient, needsProfile } = await service.verifyOtp(req.body ?? {})
    res.cookie(PATIENT_COOKIE, sessionId, auth.cookieOpts(7 * 24 * 60 * 60_000))
    res.json({ patient, needsProfile })
  })

  // POST /api/v1/auth/profile
  router.post('/profile', async (req, res) => {
    res.json(await service.completeProfile(auth.patientSid(req), req.body ?? {}))
  })

  // GET /api/v1/auth/me
  router.get('/me', auth.requirePatient, (req: AuthedRequest, res) => {
    res.json(req.patient)
  })

  // POST /api/v1/auth/logout
  router.post('/logout', async (req, res) => {
    await service.logout(auth.patientSid(req))
    res.clearCookie(PATIENT_COOKIE, auth.clearCookieOpts)
    res.status(204).end()
  })

  return router
}
