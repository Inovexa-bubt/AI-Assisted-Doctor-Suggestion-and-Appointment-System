import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createFrontdeskRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['front_desk', 'admin']))

  // GET /api/v1/frontdesk/day?doctorId=&date=
  router.get('/day', async (req, res) => {
    const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : ''
    const date = typeof req.query.date === 'string' ? req.query.date : ''
    res.json(await service.daySheet(doctorId, date))
  })

  // POST /api/v1/frontdesk/appointments/:id/status
  router.post('/appointments/:id/status', async (req, res) => {
    res.json(await service.setStatus(String(req.params.id), req.body ?? {}))
  })

  // POST /api/v1/frontdesk/queue/next
  router.post('/queue/next', async (req, res) => {
    res.json(await service.callNext(req.body ?? {}))
  })

  // GET /api/v1/frontdesk/patients?phone=
  router.get('/patients', async (req, res) => {
    const phone = typeof req.query.phone === 'string' ? req.query.phone : null
    res.json(await service.findPatient(phone))
  })

  // POST /api/v1/frontdesk/patients
  router.post('/patients', async (req, res) => {
    res.status(201).json(await service.createPatient(req.body ?? {}))
  })

  // POST /api/v1/frontdesk/appointments
  router.post('/appointments', async (req, res) => {
    res.status(201).json(await service.bookForPatient(req.body ?? {}))
  })

  return router
}
