import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const announcementSchema = z.object({ title: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(10000), audience: z.enum(['ALL', 'STUDENTS', 'MENTORS', 'SPECIFIC_DEPARTMENT', 'SPECIFIC_PROGRAM']), priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'), publishAt: z.coerce.date(), expiresAt: z.coerce.date().optional(), departmentId: z.string().uuid().optional(), programId: z.string().uuid().optional() }).refine((input) => !input.expiresAt || input.expiresAt > input.publishAt, { message: 'expiresAt must be after publishAt' })
router.get('/', requireAuth, async (request, response, next) => { try { const result = await pool.query(`SELECT id, title, content, audience, priority, publish_at, expires_at, status FROM announcements WHERE status = 'PUBLISHED' AND publish_at <= now() AND (expires_at IS NULL OR expires_at > now()) ORDER BY priority DESC, publish_at DESC LIMIT 100`); return response.json({ success: true, data: result.rows, message: 'Announcements loaded' }) } catch (error) { next(error) } })
router.post('/', requireAuth, requireRole('ADMIN'), async (request, response, next) => { try { const input = announcementSchema.parse(request.body); const result = await pool.query<{ id: string }>('INSERT INTO announcements (created_by, title, content, audience, priority, publish_at, expires_at, department_id, program_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,\'PUBLISHED\') RETURNING id', [request.auth!.userId, input.title, input.content, input.audience, input.priority, input.publishAt, input.expiresAt ?? null, input.departmentId ?? null, input.programId ?? null]); return response.status(201).json({ success: true, data: { id: result.rows[0].id }, message: 'Announcement published' }) } catch (error) { next(error) } })
export default router
