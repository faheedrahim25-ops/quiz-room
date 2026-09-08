import pg from 'pg'
import { env } from '../config/env.js'

export const pool = new pg.Pool({ connectionString: env.SUPABASE_DB_URL ?? env.DATABASE_URL, ssl: env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 5_000, max: 10, idleTimeoutMillis: 30_000 })
