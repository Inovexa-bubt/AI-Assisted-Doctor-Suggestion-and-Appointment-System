import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminDoctorRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/doctors
  router.get('/', async (_req, res) => {
    res.json(await service.listAllDoctors())
  })

  // POST /api/v1/admin/doctors
  router.post('/', async (req, res) => {
    res.status(201).json(await service.createDoctor(req.body ?? {}))
  })

  // PUT /api/v1/admin/doctors/:id
  router.put('/:id', async (req, res) => {
    res.json(await service.updateDoctor(String(req.params.id), req.body ?? {}))
  })

  return router
}
