import { Router } from 'express'
import type { AuthMiddleware, AuthedRequest } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createDoctorDashboardRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['doctor']))

  // GET /api/v1/doctor/day?date=YYYY-MM-DD
  router.get('/day', async (req: AuthedRequest, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : null
    res.json(await service.doctorDay(req.staff!, date))
  })

  return router
}
