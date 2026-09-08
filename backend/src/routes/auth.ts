import { randomBytes, createHash } from 'node:crypto'
import { Router, type Request } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { createAccessToken, createRefreshSession, hashPassword, refreshCookieOptions, revokeRefreshSession, rotateRefreshSession, verifyPassword } from '../services/auth.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })
const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email(), password: z.string().min(8).max(128), confirmPassword: z.string().min(8).max(128) }).refine((input) => input.password === input.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
const resetRequestSchema = z.object({ email: z.string().trim().email() })
const resetSchema = z.object({ token: z.string().min(20), password: z.string().min(8).max(128) })
function refreshTokenFrom(request: Request) { const cookie = request.header('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('mentor360_refresh=')); return cookie?.split('=')[1] }
async function findUser(userId: string) { const result = await pool.query<{ id: string; email: string; first_name: string; last_name: string; roles: string[] }>('SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.id = $1 AND u.status = \'ACTIVE\' GROUP BY u.id', [userId]); return result.rows[0] }
function serializeUser(user: { id: string; email: string; first_name: string; last_name: string; roles: string[] }) { return { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, roles: user.roles } }

router.post('/register', async (request, response, next) => {
	try {
		const input = registerSchema.parse(request.body)
		const nameParts = input.name.split(/\s+/)
		const firstName = nameParts.shift() ?? input.name
		const lastName = nameParts.join(' ') || 'Teacher'
		const client = await pool.connect()
		try {
			await client.query('BEGIN')
			const existing = await client.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [input.email])
			if (existing.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'An account with that email already exists' } }) }
			const user = await client.query<{ id: string }>('INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1,$2,$3,$4) RETURNING id', [input.email.toLowerCase(), await hashPassword(input.password), firstName, lastName])
			const role = await client.query<{ id: string }>("SELECT id FROM roles WHERE name = 'MENTOR'")
			await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)', [user.rows[0].id, role.rows[0].id])
			const department = await client.query<{ id: string }>('SELECT id FROM departments ORDER BY code LIMIT 1')
			if (department.rowCount) await client.query('INSERT INTO faculty (user_id, employee_id, department_id, designation) VALUES ($1,$2,$3,$4)', [user.rows[0].id, `FAC-${randomBytes(4).toString('hex').toUpperCase()}`, department.rows[0].id, 'Teacher'])
			await client.query('COMMIT')
			return response.status(201).json({ success: true, data: { email: input.email.toLowerCase() }, message: 'Account created. You can now sign in.' })
		} catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
	} catch (error) { next(error) }
})

router.post('/forgot-password', async (request, response, next) => {
	try {
		const input = resetRequestSchema.parse(request.body)
		const user = await pool.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower($1) AND status = \'ACTIVE\'', [input.email])
		let developmentToken: string | undefined
		if (user.rowCount) {
			const rawToken = randomBytes(32).toString('hex')
			await pool.query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval \'30 minutes\')', [user.rows[0].id, createHash('sha256').update(rawToken).digest('hex')])
			if (process.env.NODE_ENV !== 'production') developmentToken = rawToken
		}
		return response.json({ success: true, data: { developmentToken }, message: 'If an account exists for that email, reset instructions are available.' })
	} catch (error) { next(error) }
})

router.post('/reset-password', async (request, response, next) => {
	const client = await pool.connect()
	try {
		const input = resetSchema.parse(request.body)
		await client.query('BEGIN')
		const token = await client.query<{ user_id: string }>('SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE', [createHash('sha256').update(input.token).digest('hex')])
		if (!token.rowCount) { await client.query('ROLLBACK'); return response.status(400).json({ success: false, error: { code: 'RESET_TOKEN_INVALID', message: 'This reset link is invalid or expired' } }) }
		await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await hashPassword(input.password), token.rows[0].user_id])
		await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1', [createHash('sha256').update(input.token).digest('hex')])
		await client.query('COMMIT')
		return response.json({ success: true, data: null, message: 'Password reset successfully' })
	} catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})

router.post('/login', async (request, response, next) => { try { const input = loginSchema.parse(request.body); const result = await pool.query<{ id: string; email: string; first_name: string; last_name: string; password_hash: string; roles: string[] }>('SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE lower(u.email) = lower($1) AND u.status = \'ACTIVE\' GROUP BY u.id', [input.email]); const user = result.rows[0]; if (!user || !(await verifyPassword(user.password_hash, input.password))) return response.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } }); const safeUser = serializeUser(user); const refresh = await createRefreshSession(user.id); response.cookie('mentor360_refresh', refresh, refreshCookieOptions()); return response.json({ success: true, data: { user: safeUser, accessToken: createAccessToken({ id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, roles: user.roles }) }, message: 'Signed in successfully' }) } catch (error) { next(error) } })
router.post('/refresh', async (request, response, next) => { try { const raw = refreshTokenFrom(request); if (!raw) return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh session required' } }); const rotated = await rotateRefreshSession(raw); const user = await findUser(rotated.userId); if (!user) return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Account is unavailable' } }); response.cookie('mentor360_refresh', rotated.rawToken, refreshCookieOptions()); return response.json({ success: true, data: { user: serializeUser(user), accessToken: createAccessToken({ id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, roles: user.roles }) }, message: 'Session refreshed' }) } catch (error) { return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh session is invalid' } }) } })
router.post('/logout', async (request, response, next) => { try { const raw = refreshTokenFrom(request); if (raw) await revokeRefreshSession(raw); response.clearCookie('mentor360_refresh', refreshCookieOptions()); return response.json({ success: true, data: null, message: 'Signed out successfully' }) } catch (error) { next(error) } })
router.get('/me', requireAuth, async (request, response, next) => { try { const user = await findUser(request.auth!.userId); if (!user) return response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }); return response.json({ success: true, data: serializeUser(user), message: 'Current user loaded' }) } catch (error) { next(error) } })
export default router
