import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { env } from '../config/env.js'
import { createAccessToken, durationToPostgresInterval } from './auth.js'

describe('auth token config', () => {
  it('uses the configured access token lifetime', () => {
    const original = env.ACCESS_TOKEN_EXPIRES_IN
    env.ACCESS_TOKEN_EXPIRES_IN = '1h'

    try {
      const token = createAccessToken({
        id: 'user-1',
        email: 'student@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        roles: ['STUDENT'],
      })

      const payload = jwt.decode(token) as { exp?: number }
      expect(payload.exp).toBeTypeOf('number')
      expect(Math.abs((payload.exp ?? 0) - Math.floor(Date.now() / 1000 + 3600))).toBeLessThan(5)
    } finally {
      env.ACCESS_TOKEN_EXPIRES_IN = original
    }
  })

  it('converts refresh durations to valid postgres intervals', () => {
    expect(durationToPostgresInterval('15m')).toBe('15 minutes')
    expect(durationToPostgresInterval('30d')).toBe('30 days')
    expect(durationToPostgresInterval('2w')).toBe('2 weeks')
  })
})
