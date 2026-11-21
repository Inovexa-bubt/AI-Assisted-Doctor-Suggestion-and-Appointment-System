import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import multer from 'multer'
import type { AppConfig } from './config.ts'
import { ApiError } from './errors.ts'
import { createAuthMiddleware } from './middleware/staff-auth.middleware.ts'
import type { SttProvider } from './providers/stt.ts'
import { createAdminDoctorRoutes } from './routes/admin-doctor.routes.ts'
import { createAdminLeaveRoutes } from './routes/admin-leave.routes.ts'
import { createAdminSettingRoutes } from './routes/admin-setting.routes.ts'
import { createAdminSmsRoutes } from './routes/admin-sms.routes.ts'
import { createAdminSpecialtyRoutes } from './routes/admin-specialty.routes.ts'
import { createAdminStaffRoutes } from './routes/admin-staff.routes.ts'
import { createAnalyticsRoutes } from './routes/analytics.routes.ts'
import { createAppointmentRoutes } from './routes/appointment.routes.ts'
import { createAuthRoutes } from './routes/auth.routes.ts'
import { createDoctorDashboardRoutes } from './routes/doctor-dashboard.routes.ts'
import { createDoctorRoutes } from './routes/doctor.routes.ts'
import { createFrontdeskRoutes } from './routes/frontdesk.routes.ts'
import { createSpecialtyRoutes } from './routes/specialty.routes.ts'
import { createSpeechRoutes } from './routes/speech.routes.ts'
import { createStaffRoutes } from './routes/staff.routes.ts'
import { createTriageRoutes } from './routes/triage.routes.ts'
import type { HospitalService } from './services/hospital.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface CreateAppOptions {
  service: HospitalService
  stt: SttProvider
  config: AppConfig
}

export function createApp({ service, stt, config }: CreateAppOptions) {
  const app = express()
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // Allow inline styles & Vite SPA assets when serving static frontend in single-service deploy.
      contentSecurityPolicy: false,
    }),
  )
  app.use(
    cors({
      origin: config.corsOrigin ? config.corsOrigin.split(',').map((s) => s.trim()) : true,
      credentials: true,
    }),
  )
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))

  const auth = createAuthMiddleware(service, config)
  const api = express.Router()

  api.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Public routes
  api.use('/specialties', createSpecialtyRoutes(service))
  api.use('/doctors', createDoctorRoutes(service))
  api.use('/triage', createTriageRoutes(service))
  api.use('/speech', createSpeechRoutes(stt))

  // Patient auth & appointments
  api.use('/auth', createAuthRoutes(service, auth))
  api.use('/appointments', createAppointmentRoutes(service, auth))

  // Staff auth & role-scoped portals
  api.use('/staff', createStaffRoutes(service, auth))
  api.use('/frontdesk', createFrontdeskRoutes(service, auth))
  api.use('/doctor', createDoctorDashboardRoutes(service, auth))
  api.use('/analytics', createAnalyticsRoutes(service, auth))

  // Admin panel
  api.use('/admin/specialties', createAdminSpecialtyRoutes(service, auth))
  api.use('/admin/doctors', createAdminDoctorRoutes(service, auth))
  api.use('/admin/leave-days', createAdminLeaveRoutes(service, auth))
  api.use('/admin/settings', createAdminSettingRoutes(service, auth))
  api.use('/admin/sms', createAdminSmsRoutes(service, auth))
  api.use('/admin/staff', createAdminStaffRoutes(service, auth))

  app.use('/api/v1', api)

  // Unknown API endpoints return JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
  })

  // Optional static SPA hosting for single-container / PaaS deployments (Render, Railway, Docker).
  if (config.serveStatic) {
    const webDist = path.resolve(__dirname, '../../web/dist')
    if (existsSync(webDist)) {
      app.use(express.static(webDist))
      app.get('/{*splat}', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
          next()
          return
        }
        res.sendFile(path.join(webDist, 'index.html'))
      })
    }
  }

  // Central error handler matching docs/design/api.md
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err)
      return
    }
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } })
      return
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: { code: 'VALIDATION', message: err.message } })
      return
    }
    console.error('[api] unhandled error:', err)
    res.status(500).json({ error: { code: 'VALIDATION', message: 'Internal server error.' } })
  })

  return app
}
