import { Router } from 'express'
import type { HospitalService } from '../services/hospital.ts'

export function createTriageRoutes(service: HospitalService) {
  const router = Router()

  // POST /api/v1/triage
  router.post('/', async (req, res) => {
    res.json(await service.startTriage(req.body ?? {}))
  })

  // POST /api/v1/triage/:id/answers
  router.post('/:id/answers', async (req, res) => {
    res.json(await service.answerTriage(String(req.params.id), req.body ?? {}))
  })

  return router
}
