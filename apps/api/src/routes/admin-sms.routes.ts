import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminSmsRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/sms?limit=100
  router.get('/', async (req, res) => {
    res.json(await service.listSms(Number(req.query.limit)))
  })

  return router
}
