import { config as loadDotEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

loadDotEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('postgresql://mentor360:mentor360@localhost:5432/mentor360'),
  SUPABASE_DB_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  JWT_ACCESS_SECRET: z.string().min(32).default('mentor360-dev-access-secret-change-before-production-2026'),
  JWT_REFRESH_SECRET: z.string().min(32).default('mentor360-dev-refresh-secret-change-before-production-2026'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1).default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1).default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
})
export const env = schema.parse(process.env)
