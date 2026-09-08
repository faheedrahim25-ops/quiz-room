import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../services/auth.js'

declare global { namespace Express { interface Request { auth?: { userId: string; roles: string[] } } } }

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
  try {
    const claims = verifyAccessToken(header.slice(7))
    request.auth = { userId: claims.sub, roles: claims.roles }
    next()
  } catch { return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }) }
}
export function requireRole(...roles: string[]) { return (request: Request, response: Response, next: NextFunction) => roles.some((role) => request.auth?.roles.includes(role)) ? next() : response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }) }
