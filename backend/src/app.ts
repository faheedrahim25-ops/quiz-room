import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { ZodError } from 'zod'
import { env } from './config/env.js'
import authRoutes from './routes/auth.js'
import questionRoutes from './routes/questions.js'
import quizRoutes from './routes/quizzes.js'
import attemptRoutes from './routes/attempts.js'
import resultRoutes from './routes/results.js'
import { pool } from './db/pool.js'

const app = express()
const require = createRequire(import.meta.url)
const helmet = require('helmet') as (...options: unknown[]) => RequestHandler
const rateLimit = require('express-rate-limit') as (...options: unknown[]) => RequestHandler
app.use(helmet())
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('CORS origin is not allowed')) }, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => { response.setHeader('X-Request-Id', randomUUID()); next() })
const apiLimiter = rateLimit({ windowMs: env.RATE_LIMIT_WINDOW, limit: env.RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false })
const authLimiter = rateLimit({ windowMs: env.RATE_LIMIT_WINDOW, limit: 50, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please wait a moment and retry.' } } })

app.get('/api/v1/health', async (_request, response) => { try { await pool.query('SELECT 1'); return response.json({ success: true, data: { status: 'ok', service: 'mentor360-api', database: 'ok' }, message: 'Service is healthy' }) } catch { return response.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is unavailable' } }) } })
app.use('/api/v1', apiLimiter)
app.use('/api/v1/auth', authLimiter)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/questions', questionRoutes)
app.use('/api/v1/quizzes', quizRoutes)
app.use('/api/v1', attemptRoutes)
app.use('/api/v1', resultRoutes)
app.use((_request, response) => response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } }))
app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
	if (error instanceof ZodError) return response.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ') } })
	console.error(error.message)
	return response.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
})

if (process.env.NODE_ENV !== 'test') app.listen(env.PORT, () => console.log(`Mentor360 API listening on ${env.PORT}`))
export default app
