import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const querySchema = z.object({ action: z.string().trim().max(80).optional(), entityType: z.string().trim().max(80).optional() })
router.get('/', requireAuth, requireRole('ADMIN'), async (request, response, next) => { try { const query = querySchema.parse(request.query); const values: string[] = []; const filters: string[] = []; if (query.action) { values.push(query.action); filters.push(`a.action = $${values.length}`) } if (query.entityType) { values.push(query.entityType); filters.push(`a.entity_type = $${values.length}`) } const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''; const result = await pool.query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip_address, a.created_at, u.first_name || ' ' || u.last_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ${where} ORDER BY a.created_at DESC LIMIT 200`, values); return response.json({ success: true, data: result.rows, message: 'Audit logs loaded' }) } catch (error) { next(error) } })
export default router
