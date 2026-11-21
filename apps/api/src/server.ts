import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { seedDatabase } from './db/seed.ts'
import { createAiProvider } from './providers/ai.ts'
import { createSmsProvider } from './providers/sms.ts'
import { createSttProvider } from './providers/stt.ts'
import { createQueueHub } from './realtime.ts'
import { startScheduler } from './scheduler.ts'
import { HospitalService } from './services/hospital.ts'

async function main() {
  const config = loadConfig()
  const db = await createDb(config.databaseUrl, { ssl: config.databaseSsl })
  await runMigrations(db)

  // Auto-seed an empty database when AUTO_SEED=true (or non-production) so first deploy works out of the box.
  if (config.autoSeed) {
    const { seeded } = await seedDatabase(db, { onlyIfEmpty: true })
    if (seeded) console.log('[api] database was empty — seeded with sample data.')
  }

  const ai = createAiProvider(config)
  const stt = createSttProvider(config)
  const sms = createSmsProvider(config)

  const queue = createQueueHub()
  const service = new HospitalService({
    db,
    ai,
    sms,
    queue,
    exposeDemoOtp: config.exposeDemoOtp,
  })
  const app = createApp({ service, stt, config })
  const httpServer = createServer(app)
  queue.attach?.(httpServer, config.corsOrigin)

  const scheduler = config.enableScheduler ? startScheduler(service) : null

  httpServer.listen(config.port, () => {
    console.log(
      `[api] Lumina Hospital API running at http://localhost:${config.port} (db=${db.driver}, ai=${ai.name}, stt=${stt.name}, sms=${sms.name})`,
    )
  })

  const shutdown = async () => {
    scheduler?.stop()
    await queue.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    await db.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

void main()
