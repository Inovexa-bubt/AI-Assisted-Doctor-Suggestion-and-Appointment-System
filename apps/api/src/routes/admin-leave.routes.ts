import { Router } from 'express'
import type { AuthMiddleware } from '../middleware/staff-auth.middleware.ts'
import type { HospitalService } from '../services/hospital.ts'

export function createAdminLeaveRoutes(service: HospitalService, auth: AuthMiddleware) {
  const router = Router()
  router.use(auth.requireStaff(['admin']))

  // GET /api/v1/admin/leave-days?doctorId=
  router.get('/', async (req, res) => {
    const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : null
    res.json(await service.listLeaveDays(doctorId))
  })

  // GET /api/v1/admin/leave-days/impact?doctorId=&date=
  router.get('/impact', async (req, res) => {
    const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : ''
    const date = typeof req.query.date === 'string' ? req.query.date : ''
    res.json(await service.leaveImpact(doctorId, date))
  })

  // POST /api/v1/admin/leave-days
  router.post('/', async (req, res) => {
    res.status(201).json(await service.addLeaveDay(req.body ?? {}))
  })

  // DELETE /api/v1/admin/leave-days/:id
  router.delete('/:id', async (req, res) => {
    await service.removeLeaveDay(String(req.params.id))
    res.status(204).end()
  })

  return router
}
