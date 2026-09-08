import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { calculatePercentage } from '../services/scoring.js'

const router = Router()
const id = z.string().uuid()
const evaluationSchema = z.object({ answers: z.array(z.object({ answerId: id, marksAwarded: z.number().nonnegative().max(100), feedback: z.string().trim().max(2000).optional() })).min(1) })

async function mentorCanAccess(mentorUserId: string, studentId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const access = await pool.query('SELECT 1 FROM mentor_assignments ma JOIN faculty f ON f.id = ma.mentor_id WHERE ma.student_id = $1 AND f.user_id = $2 AND ma.status = \'ACTIVE\'', [studentId, mentorUserId])
  return Boolean(access.rowCount)
}

router.get('/evaluations/pending', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const values: string[] = []
    let scope = ''
    if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); scope = `JOIN mentor_assignments ma ON ma.student_id = a.student_id AND ma.status = 'ACTIVE' JOIN faculty f ON f.id = ma.mentor_id AND f.user_id = $${values.length}` }
    const result = await pool.query(`SELECT DISTINCT a.id AS attempt_id, q.title, u.first_name || ' ' || u.last_name AS student_name, a.submitted_at FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id JOIN quiz_answers qa ON qa.attempt_id = a.id JOIN quiz_questions qq ON qq.id = qa.question_id ${scope} WHERE a.status = 'SUBMITTED' AND qq.question_type_snapshot = 'SHORT_ANSWER' AND qa.marks_awarded IS NULL ORDER BY a.submitted_at ASC LIMIT 100`, values)
    return response.json({ success: true, data: result.rows, message: 'Pending evaluations loaded' })
  } catch (error) { next(error) }
})

router.get('/results', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const values: string[] = []
    let scope = ''
    if (request.auth!.roles.includes('STUDENT')) { values.push(request.auth!.userId); scope = `AND s.user_id = $${values.length}` }
    else if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); scope = `AND (q.created_by = $${values.length} OR EXISTS (SELECT 1 FROM mentor_assignments ma JOIN faculty f ON f.id = ma.mentor_id WHERE ma.student_id = r.student_id AND ma.status = 'ACTIVE' AND f.user_id = $${values.length}))` }
    const result = await pool.query(`SELECT r.id, r.quiz_id, q.title, u.first_name || ' ' || u.last_name AS student_name, count(qq.id)::int AS total_questions, r.total_marks, r.obtained_marks, r.percentage, r.pass_status, r.evaluated_at, a.submitted_at, a.tab_switch_count FROM quiz_results r JOIN quizzes q ON q.id = r.quiz_id JOIN students s ON s.id = r.student_id JOIN users u ON u.id = s.user_id JOIN quiz_attempts a ON a.id = r.attempt_id JOIN quiz_questions qq ON qq.quiz_id = r.quiz_id WHERE true ${scope} GROUP BY r.id, r.quiz_id, q.title, u.first_name, u.last_name, a.submitted_at, a.tab_switch_count ORDER BY r.evaluated_at DESC NULLS LAST LIMIT 100`, values)
    return response.json({ success: true, data: result.rows, message: 'Results loaded' })
  } catch (error) { next(error) }
})

router.get('/results/:resultId', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const resultId = id.parse(request.params.resultId)
    const result = await pool.query<{ student_id: string; quiz_id: string; id: string; title: string; total_marks: string; obtained_marks: string; percentage: string; pass_status: boolean | null; evaluated_at: Date | null }>('SELECT r.student_id, r.quiz_id, r.id, q.title, r.total_marks, r.obtained_marks, r.percentage, r.pass_status, r.evaluated_at FROM quiz_results r JOIN quizzes q ON q.id = r.quiz_id WHERE r.id = $1', [resultId])
    if (!result.rowCount) return response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } })
    const row = result.rows[0]
    let allowed = request.auth!.roles.includes('ADMIN')
    if (request.auth!.roles.includes('STUDENT')) { const own = await pool.query('SELECT 1 FROM students WHERE id = $1 AND user_id = $2', [row.student_id, request.auth!.userId]); allowed = Boolean(own.rowCount) }
    if (request.auth!.roles.includes('MENTOR')) allowed = await mentorCanAccess(request.auth!.userId, row.student_id, request.auth!.roles.includes('ADMIN'))
    if (!allowed) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Result is outside your access scope' } })
    return response.json({ success: true, data: row, message: 'Result loaded' })
  } catch (error) { next(error) }
})

router.get('/quizzes/:quizId/leaderboard', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const quizId = id.parse(request.params.quizId)
    const quiz = await pool.query<{ leaderboard_enabled: boolean }>('SELECT leaderboard_enabled FROM quizzes WHERE id = $1', [quizId])
    if (!quiz.rowCount) return response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quiz not found' } })
    if (!quiz.rows[0].leaderboard_enabled && !request.auth!.roles.some((role) => role === 'ADMIN' || role === 'MENTOR')) return response.status(403).json({ success: false, error: { code: 'LEADERBOARD_DISABLED', message: 'Leaderboard is disabled for this quiz' } })
    const leaderboard = await pool.query('SELECT row_number() OVER (ORDER BY r.obtained_marks DESC, a.submitted_at ASC) AS rank, u.first_name || \' \' || u.last_name AS name, r.obtained_marks, r.total_marks, r.percentage FROM quiz_results r JOIN quiz_attempts a ON a.id = r.attempt_id JOIN students s ON s.id = r.student_id JOIN users u ON u.id = s.user_id WHERE r.quiz_id = $1 AND a.status IN (\'SUBMITTED\',\'EXPIRED\',\'EVALUATED\') ORDER BY rank LIMIT 100', [quizId])
    return response.json({ success: true, data: leaderboard.rows, message: 'Leaderboard loaded' })
  } catch (error) { next(error) }
})

router.get('/attempts/:attemptId/evaluation', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const attemptId = id.parse(request.params.attemptId)
    const attempt = await pool.query<{ student_id: string; quiz_id: string; title: string }>('SELECT a.student_id, a.quiz_id, q.title FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = $1', [attemptId])
    if (!attempt.rowCount || !(await mentorCanAccess(request.auth!.userId, attempt.rows[0]?.student_id, request.auth!.roles.includes('ADMIN')))) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Attempt is outside your access scope' } })
    const answers = await pool.query('SELECT qa.id, qa.question_id, qq.question_text_snapshot, qq.marks, qa.text_answer, qa.marks_awarded, qa.feedback, qa.answered_at FROM quiz_answers qa JOIN quiz_questions qq ON qq.id = qa.question_id WHERE qa.attempt_id = $1 AND qq.question_type_snapshot = \'SHORT_ANSWER\' ORDER BY qq.display_order', [attemptId])
    return response.json({ success: true, data: { attempt: attempt.rows[0], answers: answers.rows }, message: 'Pending answers loaded' })
  } catch (error) { next(error) }
})

router.post('/attempts/:attemptId/evaluate', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  const client = await pool.connect()
  try {
    const attemptId = id.parse(request.params.attemptId)
    const input = evaluationSchema.parse(request.body)
    await client.query('BEGIN')
    const attempt = await client.query<{ student_id: string; quiz_id: string; total_marks: string; passing_marks: string }>('SELECT a.student_id, a.quiz_id, q.total_marks, q.passing_marks FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = $1 FOR UPDATE', [attemptId])
    if (!attempt.rowCount || !(await mentorCanAccess(request.auth!.userId, attempt.rows[0]?.student_id, request.auth!.roles.includes('ADMIN')))) { await client.query('ROLLBACK'); return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Attempt is outside your access scope' } }) }
    for (const answer of input.answers) {
      const valid = await client.query<{ marks: string }>('SELECT qq.marks FROM quiz_answers qa JOIN quiz_questions qq ON qq.id = qa.question_id WHERE qa.id = $1 AND qa.attempt_id = $2 AND qq.question_type_snapshot = \'SHORT_ANSWER\'', [answer.answerId, attemptId])
      if (!valid.rowCount || answer.marksAwarded > Number(valid.rows[0].marks)) throw new Error('INVALID_EVALUATION_MARKS')
      await client.query('UPDATE quiz_answers SET marks_awarded = $1, feedback = $2 WHERE id = $3 AND attempt_id = $4', [answer.marksAwarded, answer.feedback ?? null, answer.answerId, attemptId])
    }
    const summary = await client.query<{ obtained: string; pending: string; result_id: string | null }>(`SELECT COALESCE(SUM(qa.marks_awarded), 0)::text AS obtained, count(*) FILTER (WHERE qa.marks_awarded IS NULL)::text AS pending, max(qr.id)::text AS result_id FROM quiz_answers qa LEFT JOIN quiz_results qr ON qr.attempt_id = $1 WHERE qa.attempt_id = $1`, [attemptId])
    const obtained = Number(summary.rows[0].obtained)
    const pending = Number(summary.rows[0].pending)
    const percentage = calculatePercentage(obtained, Number(attempt.rows[0].total_marks))
    await client.query('UPDATE quiz_attempts SET status = $1 WHERE id = $2', [pending ? 'SUBMITTED' : 'EVALUATED', attemptId])
    await client.query('UPDATE quiz_results SET obtained_marks = $1, percentage = $2, pass_status = $3, evaluated_at = CASE WHEN $4 = 0 THEN now() ELSE NULL END, evaluated_by = CASE WHEN $4 = 0 THEN $5 ELSE NULL END WHERE attempt_id = $6', [obtained, percentage, pending ? null : obtained >= Number(attempt.rows[0].passing_marks), pending, request.auth!.userId, attemptId])
    await client.query('COMMIT')
    return response.json({ success: true, data: { attemptId, obtainedMarks: obtained, percentage, pendingAnswers: pending }, message: pending ? 'Evaluation saved' : 'Evaluation finalized' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})
export default router
