import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAnalyticsRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/analytics?from=&to=
  router.get('/', async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : null
    const to = typeof req.query.to === 'string' ? req.query.to : null
    res.json(await service.analytics(from, to))
  })

  return router
}
