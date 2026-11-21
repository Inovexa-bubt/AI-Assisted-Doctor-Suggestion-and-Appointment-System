import { Router } from 'express'
import type { HospitalService } from '../services/hospital.ts'

export function createSpecialtyRoutes(service: HospitalService) {
  const router = Router()

  // GET /api/v1/specialties — active specialties in display order
  router.get('/', async (_req, res) => {
    res.json(await service.listSpecialties())
  })

  return router
}
