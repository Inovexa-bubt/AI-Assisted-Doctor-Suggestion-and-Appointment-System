import { Router } from 'express'
import type { HospitalService } from '../services/hospital.ts'

export function createDoctorRoutes(service: HospitalService) {
  const router = Router()

  // GET /api/v1/doctors?specialtyId=&q=
  router.get('/', async (req, res) => {
    res.json(
      await service.listDoctors({
        specialtyId: typeof req.query.specialtyId === 'string' ? req.query.specialtyId : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      }),
    )
  })

  // GET /api/v1/doctors/:id
  router.get('/:id', async (req, res) => {
    res.json(await service.getDoctor(String(req.params.id)))
  })

  // GET /api/v1/doctors/:id/availability?from=YYYY-MM-DD&days=14
  router.get('/:id/availability', async (req, res) => {
    res.json(
      await service.getAvailability(String(req.params.id), {
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        days: req.query.days ? Number(req.query.days) : undefined,
      }),
    )
  })

  return router
}
