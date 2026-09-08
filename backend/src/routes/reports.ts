import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.get('/reports/overview', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const values: string[] = []
    let scope = ''
    if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); scope = `JOIN quiz_assignments qa ON qa.quiz_id = r.quiz_id AND qa.student_id = r.student_id JOIN mentor_assignments ma ON ma.student_id = r.student_id AND ma.status = 'ACTIVE' JOIN faculty f ON f.id = ma.mentor_id AND f.user_id = $${values.length}` }
    const result = await pool.query(`SELECT count(*)::int AS evaluated_attempts, COALESCE(round(avg(r.percentage), 2), 0)::numeric AS average_percentage, count(*) FILTER (WHERE r.pass_status = true)::int AS passed_attempts, count(*) FILTER (WHERE r.pass_status = false)::int AS failed_attempts FROM quiz_results r ${scope}`, values)
    return response.json({ success: true, data: result.rows[0], message: 'Report loaded' })
  } catch (error) { next(error) }
})
router.get('/reports/participation', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try { const values: string[] = []; let scope = ''; if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); scope = `JOIN mentor_assignments ma ON ma.student_id = qa.student_id AND ma.status = 'ACTIVE' JOIN faculty f ON f.id = ma.mentor_id AND f.user_id = $${values.length}` } const result = await pool.query(`SELECT q.id, q.title, count(qa.id)::int AS assigned, count(a.id)::int AS started, count(a.id) FILTER (WHERE a.status IN ('SUBMITTED','EVALUATED'))::int AS completed FROM quizzes q LEFT JOIN quiz_assignments qa ON qa.quiz_id = q.id ${scope} LEFT JOIN quiz_attempts a ON a.quiz_id = q.id AND a.student_id = qa.student_id GROUP BY q.id, q.title ORDER BY q.start_at DESC LIMIT 100`, values); return response.json({ success: true, data: result.rows, message: 'Participation report loaded' }) } catch (error) { next(error) }
})
export default router
