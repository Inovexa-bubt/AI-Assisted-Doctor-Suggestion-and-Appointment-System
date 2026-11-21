import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminSpecialtyRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/specialties
  router.get('/', async (_req, res) => {
    res.json(await service.listAllSpecialties())
  })

  // POST /api/v1/admin/specialties
  router.post('/', async (req, res) => {
    res.status(201).json(await service.createSpecialty(req.body ?? {}))
  })

  // PUT /api/v1/admin/specialties/:id
  router.put('/:id', async (req, res) => {
    res.json(await service.updateSpecialty(String(req.params.id), req.body ?? {}))
  })

  return router
}
