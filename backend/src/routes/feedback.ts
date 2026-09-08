import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const id = z.string().uuid()
const feedbackSchema = z.object({ studentId: id, quizId: id.optional(), meetingId: id.optional(), feedbackType: z.enum(['GENERAL', 'QUIZ', 'ACADEMIC', 'PERFORMANCE', 'IMPROVEMENT']), content: z.string().trim().min(1).max(5000) })

async function facultyIdForUser(userId: string) { const result = await pool.query<{ id: string }>('SELECT id FROM faculty WHERE user_id = $1 AND status = \'ACTIVE\'', [userId]); return result.rows[0]?.id }
async function canAccessStudent(userId: string, studentId: string, isAdmin: boolean) { if (isAdmin) return true; const result = await pool.query('SELECT 1 FROM mentor_assignments ma JOIN faculty f ON f.id = ma.mentor_id WHERE ma.student_id = $1 AND f.user_id = $2 AND ma.status = \'ACTIVE\'', [studentId, userId]); return Boolean(result.rowCount) }

router.post('/', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const input = feedbackSchema.parse(request.body)
    if (!(await canAccessStudent(request.auth!.userId, input.studentId, request.auth!.roles.includes('ADMIN')))) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Student is outside your access scope' } })
    const mentorId = request.auth!.roles.includes('ADMIN') ? (await facultyIdForUser(request.auth!.userId)) : await facultyIdForUser(request.auth!.userId)
    if (!mentorId) return response.status(422).json({ success: false, error: { code: 'FACULTY_PROFILE_REQUIRED', message: 'An active faculty profile is required' } })
    const result = await pool.query<{ id: string }>('INSERT INTO feedback (mentor_id, student_id, quiz_id, meeting_id, feedback_type, content) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [mentorId, input.studentId, input.quizId ?? null, input.meetingId ?? null, input.feedbackType, input.content])
    return response.status(201).json({ success: true, data: { id: result.rows[0].id }, message: 'Feedback created' })
  } catch (error) { next(error) }
})

router.get('/students/:studentId/feedback', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const studentId = id.parse(request.params.studentId)
    let allowed = request.auth!.roles.includes('ADMIN')
    if (request.auth!.roles.includes('STUDENT')) { const own = await pool.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [studentId, request.auth!.userId]); allowed = Boolean(own.rowCount) }
    if (request.auth!.roles.includes('MENTOR')) allowed = await canAccessStudent(request.auth!.userId, studentId, request.auth!.roles.includes('ADMIN'))
    if (!allowed) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Feedback is outside your access scope' } })
    const result = await pool.query('SELECT f.id, f.feedback_type, f.content, f.quiz_id, f.meeting_id, f.created_at, u.first_name || \' \' || u.last_name AS mentor_name FROM feedback f JOIN faculty fac ON fac.id = f.mentor_id JOIN users u ON u.id = fac.user_id WHERE f.student_id = $1 ORDER BY f.created_at DESC', [studentId])
    return response.json({ success: true, data: result.rows, message: 'Feedback loaded' })
  } catch (error) { next(error) }
})
export default router
