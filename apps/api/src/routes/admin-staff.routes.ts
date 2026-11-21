import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminStaffRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/staff
  router.get('/', async (_req, res) => {
    res.json(await service.listStaff())
  })

  // POST /api/v1/admin/staff
  router.post('/', async (req, res) => {
    res.status(201).json(await service.createStaff(req.body ?? {}))
  })

  return router
}
