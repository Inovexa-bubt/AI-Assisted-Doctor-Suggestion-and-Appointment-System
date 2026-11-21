import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.ts'
import { type Db, createDb } from './client.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = path.resolve(__dirname, '../../db/migrations/001_init.sql')

export async function runMigrations(db: Db): Promise<void> {
  let sql = readFileSync(MIGRATION_PATH, 'utf8')
  // PGlite supports gen_random_uuid() natively in PG16+ without CREATE EXTENSION pgcrypto.
  if (db.driver === 'pglite') {
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i, '')
  }
  await db.exec(sql)
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isCli) {
  const cfg = loadConfig()
  const db = await createDb(cfg.databaseUrl)
  try {
    await runMigrations(db)
    console.log(`Migrations applied (${db.driver}).`)
  } finally {
    await db.close()
  }
}
