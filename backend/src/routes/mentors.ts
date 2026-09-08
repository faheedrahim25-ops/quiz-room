import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.get('/', requireAuth, requireRole('ADMIN'), async (_request, response, next) => { try { const result = await pool.query('SELECT f.id, f.employee_id, u.first_name, u.last_name, u.email, f.designation, d.name AS department FROM faculty f JOIN users u ON u.id = f.user_id JOIN departments d ON d.id = f.department_id WHERE f.status = \'ACTIVE\' ORDER BY u.last_name, u.first_name'); return response.json({ success: true, data: result.rows, message: 'Mentors loaded' }) } catch (error) { next(error) } })
export default router
