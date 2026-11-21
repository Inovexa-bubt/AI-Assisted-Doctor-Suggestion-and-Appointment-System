import { Router } from 'express'
import type { AuthMiddleware, AuthedRequest } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAppointmentRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()

  // POST /api/v1/appointments/holds
  router.post('/holds', auth.requirePatient, async (req: AuthedRequest, res) => {
    res.status(201).json(await service.hold(req.patient!, req.body ?? {}))
  })

  // GET /api/v1/appointments?scope=upcoming|past
  router.get('/', auth.requirePatient, async (req: AuthedRequest, res) => {
    const scope = typeof req.query.scope === 'string' ? req.query.scope : null
    res.json(await service.listMine(req.patient!, scope))
  })

  // GET /api/v1/appointments/:id
  router.get('/:id', auth.requirePatient, async (req: AuthedRequest, res) => {
    res.json(await service.getAppointment(req.patient!, String(req.params.id)))
  })

  // POST /api/v1/appointments/:id/confirm
  router.post('/:id/confirm', auth.requirePatient, async (req: AuthedRequest, res) => {
    res.json(await service.confirm(req.patient!, String(req.params.id)))
  })

  // DELETE /api/v1/appointments/:id/hold
  router.delete('/:id/hold', auth.requirePatient, async (req: AuthedRequest, res) => {
    await service.releaseHold(req.patient!, String(req.params.id))
    res.status(204).end()
  })

  // POST /api/v1/appointments/:id/cancel
  router.post('/:id/cancel', auth.requirePatient, async (req: AuthedRequest, res) => {
    res.json(await service.cancel(req.patient!, String(req.params.id)))
  })

  // GET /api/v1/appointments/:id/queue
  router.get('/:id/queue', auth.requirePatient, async (req: AuthedRequest, res) => {
    res.json(await service.queueStatus(req.patient!, String(req.params.id)))
  })

  return router
}
