import argon2 from 'argon2'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { pool } from '../db/pool.js'

export type AuthUser = { id: string; email: string; firstName: string; lastName: string; roles: string[] }
type AccessClaims = JwtPayload & { sub: string; roles: string[]; type: 'access' }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const durationToPostgresInterval = (value: string) => {
  const match = /^([0-9]+)(ms|s|m|h|d|w)$/i.exec(value.trim())
  if (!match) return '30 days'

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const labels = { ms: 'milliseconds', s: 'seconds', m: 'minutes', h: 'hours', d: 'days', w: 'weeks' }
  return `${amount} ${labels[unit as keyof typeof labels]}`
}
const parseDurationToMs = (value: string) => {
  const match = /^([0-9]+)(ms|s|m|h|d|w)$/i.exec(value.trim())
  if (!match) return 30 * 24 * 60 * 60 * 1000

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 }
  return amount * multipliers[unit as keyof typeof multipliers]
}
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id })
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)

export function createAccessToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, roles: user.roles, type: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN } as SignOptions)
}

export async function createRefreshSession(userId: string) {
  const rawToken = `${randomUUID()}.${randomBytes(32).toString('hex')}`
  const interval = durationToPostgresInterval(env.REFRESH_TOKEN_EXPIRES_IN)
  await pool.query('INSERT INTO refresh_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3)::interval)', [userId, hashToken(rawToken), interval])
  return rawToken
}

export async function rotateRefreshSession(rawToken: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ id: string; user_id: string }>('SELECT id, user_id FROM refresh_sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() FOR UPDATE', [hashToken(rawToken)])
    if (found.rowCount !== 1) throw new Error('INVALID_REFRESH_TOKEN')
    await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE id = $1', [found.rows[0].id])
    const nextRawToken = `${randomUUID()}.${randomBytes(32).toString('hex')}`
    const interval = durationToPostgresInterval(env.REFRESH_TOKEN_EXPIRES_IN)
    await client.query('INSERT INTO refresh_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3)::interval)', [found.rows[0].user_id, hashToken(nextRawToken), interval])
    await client.query('COMMIT')
    return { userId: found.rows[0].user_id, rawToken: nextRawToken }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function revokeRefreshSession(rawToken: string) { await pool.query('UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(rawToken)]) }
export function verifyAccessToken(token: string) { return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims }
export function refreshCookieOptions() { return { httpOnly: true, sameSite: 'lax' as const, secure: env.NODE_ENV === 'production', maxAge: parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN), path: '/api/v1/auth' } }
