import { Router } from 'express'
import {
  type AuthMiddleware,
  type AuthedRequest,
  STAFF_COOKIE,
} from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createStaffRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()

  // POST /api/v1/staff/login
  router.post('/login', async (req, res) => {
    const { sessionId, user } = await service.staffLogin(req.body ?? {}, req.ip)
    res.cookie(STAFF_COOKIE, sessionId, auth.cookieOpts(12 * 60 * 60_000))
    res.json(user)
  })

  // GET /api/v1/staff/me
  router.get('/me', auth.requireStaff(), (req: AuthedRequest, res) => {
    res.json(req.staff)
  })

  // POST /api/v1/staff/logout
  router.post('/logout', async (req, res) => {
    await service.logout(auth.staffSid(req))
    res.clearCookie(STAFF_COOKIE, auth.clearCookieOpts)
    res.status(204).end()
  })

  return router
}
