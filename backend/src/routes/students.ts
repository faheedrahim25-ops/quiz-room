import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const idSchema = z.string().uuid()
const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(80).optional() })
const fields = `s.id, s.student_register_number, u.first_name, u.last_name, u.email, d.name AS department, p.name AS program, s.semester_id, s.status, (SELECT r.percentage FROM quiz_results r WHERE r.student_id = s.id AND r.evaluated_at IS NOT NULL ORDER BY r.evaluated_at DESC LIMIT 1) AS latest_score`

router.get('/', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const query = listSchema.parse(request.query)
    const values: unknown[] = []
    const filters: string[] = []
    if (request.auth!.roles.includes('STUDENT')) { values.push(request.auth!.userId); filters.push(`s.user_id = $${values.length}`) }
    if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); filters.push(`EXISTS (SELECT 1 FROM mentor_assignments ma JOIN faculty f ON f.id = ma.mentor_id WHERE ma.student_id = s.id AND ma.status = 'ACTIVE' AND f.user_id = $${values.length})`) }
    if (query.search) { values.push(`%${query.search}%`); filters.push(`(u.first_name ILIKE $${values.length} OR u.last_name ILIKE $${values.length} OR s.student_register_number ILIKE $${values.length})`) }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const count = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM students s JOIN users u ON u.id = s.user_id ${where}`, values)
    const offset = (query.page - 1) * query.pageSize
    values.push(query.pageSize, offset)
    const rows = await pool.query(`SELECT ${fields} FROM students s JOIN users u ON u.id = s.user_id JOIN departments d ON d.id = s.department_id JOIN programs p ON p.id = s.program_id ${where} ORDER BY u.last_name, u.first_name LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
    return response.json({ success: true, data: { items: rows.rows, page: query.page, pageSize: query.pageSize, total: Number(count.rows[0].total) }, message: 'Students loaded' })
  } catch (error) { next(error) }
})

router.get('/:id', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const id = idSchema.parse(request.params.id)
    const values: unknown[] = [id]
    let ownership = ''
    if (request.auth!.roles.includes('STUDENT')) { values.push(request.auth!.userId); ownership = `AND s.user_id = $${values.length}` }
    if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); ownership = `AND EXISTS (SELECT 1 FROM mentor_assignments ma JOIN faculty f ON f.id = ma.mentor_id WHERE ma.student_id = s.id AND ma.status = 'ACTIVE' AND f.user_id = $${values.length})` }
    const result = await pool.query(`SELECT ${fields} FROM students s JOIN users u ON u.id = s.user_id JOIN departments d ON d.id = s.department_id JOIN programs p ON p.id = s.program_id WHERE s.id = $1 ${ownership}`, values)
    if (!result.rowCount) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Student is outside your access scope' } })
    return response.json({ success: true, data: result.rows[0], message: 'Student loaded' })
  } catch (error) { next(error) }
})
export default router
