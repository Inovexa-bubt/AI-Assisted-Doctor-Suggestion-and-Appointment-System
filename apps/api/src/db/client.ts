import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

// Keep PostgreSQL DATE (OID 1082) as plain 'YYYY-MM-DD' strings (never shifted by local TZ).
pg.types.setTypeParser(1082, (val) => val)

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
}

export interface Db extends Queryable {
  exec(sql: string): Promise<void>
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
  readonly driver: 'pg' | 'pglite'
}

/** Normalizes a PG date value (Date or string) to 'YYYY-MM-DD'. */
export function asDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

/** Normalizes a PG time value ('17:30:00' or '17:30') to 'HH:mm'. */
export function asTime(val: unknown): string {
  return String(val).slice(0, 5)
}

/** Normalizes a PG timestamptz value to an ISO 8601 string. */
export function asIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString()
  return new Date(String(val)).toISOString()
}

export async function createDb(databaseUrl: string): Promise<Db> {
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    const pool = new pg.Pool({ connectionString: databaseUrl })
    return {
      driver: 'pg',
      async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
        const res = await pool.query(sql, params)
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length }
      },
      async exec(sql: string) {
        await pool.query(sql)
      },
      async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const tx: Queryable = {
            async query<R = Record<string, unknown>>(sql: string, params: unknown[] = []) {
              const res = await client.query(sql, params)
              return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length }
            },
          }
          const result = await fn(tx)
          await client.query('COMMIT')
          return result
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      },
      async close() {
        await pool.end()
      },
    }
  }

  // Embedded PostgreSQL via PGlite (for zero-config local dev and automated integration tests).
  let pglite: PGlite
  if (!databaseUrl || databaseUrl === 'memory://' || databaseUrl === 'pglite://memory') {
    pglite = new PGlite()
  } else {
    const rawPath = databaseUrl.replace(/^pglite:\/\//, '')
    const resolved = path.resolve(process.cwd(), rawPath)
    mkdirSync(path.dirname(resolved), { recursive: true })
    pglite = new PGlite(resolved)
  }
  await pglite.waitReady

  return {
    driver: 'pglite',
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await pglite.query<T>(sql, params)
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
    },
    async exec(sql: string) {
      await pglite.exec(sql)
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      return pglite.transaction(async (rawTx) => {
        const tx: Queryable = {
          async query<R = Record<string, unknown>>(sql: string, params: unknown[] = []) {
            const res = await rawTx.query<R>(sql, params)
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
          },
        }
        return fn(tx)
      })
    },
    async close() {
      await pglite.close()
    },
  }
}
