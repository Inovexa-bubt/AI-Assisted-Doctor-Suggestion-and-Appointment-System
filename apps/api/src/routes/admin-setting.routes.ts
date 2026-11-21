import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminSettingRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/settings
  router.get('/', async (_req, res) => {
    res.json(await service.getSettings())
  })

  // PUT /api/v1/admin/settings
  router.put('/', async (req, res) => {
    res.json(await service.putSettings(req.body ?? {}))
  })

  return router
}
