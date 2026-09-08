import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { calculatePercentage } from '../services/scoring.js'

const router = Router()
const id = z.string().uuid()
const answerSchema = z.object({ selectedOptionId: id.nullable().optional(), textAnswer: z.string().max(10000).nullable().optional(), markedForReview: z.boolean().default(false) })
const eventSchema = z.object({ eventType: z.enum(['TAB_HIDDEN', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'AUTO_SUBMIT']), metadata: z.record(z.string(), z.unknown()).default({}) })

router.post('/quizzes/:quizId/start', requireAuth, requireRole('STUDENT'), async (request, response, next) => {
  try {
    const quizId = id.parse(request.params.quizId)
    const student = await pool.query<{ id: string }>('SELECT id FROM students WHERE user_id = $1 AND status = \'ACTIVE\'', [request.auth!.userId])
    if (!student.rowCount) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Active student profile required' } })
    const studentId = student.rows[0].id
    const quiz = await pool.query<{ duration_minutes: number; end_at: Date; status: string; one_attempt_per_roll: boolean; roll_number: string }>(`SELECT q.duration_minutes, q.end_at, q.status, q.one_attempt_per_roll, s.student_register_number AS roll_number FROM quizzes q JOIN quiz_assignments qa ON qa.quiz_id = q.id AND qa.student_id = $2 AND qa.status = 'ACTIVE' JOIN students s ON s.id = qa.student_id WHERE q.id = $1 AND q.start_at <= now() AND q.end_at > now() AND q.status IN ('PUBLISHED','SCHEDULED','ACTIVE')`, [quizId, studentId])
    if (!quiz.rowCount) return response.status(409).json({ success: false, error: { code: 'QUIZ_UNAVAILABLE', message: 'Quiz is not currently available' } })
    const attempts = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [quizId, studentId])
    if (quiz.rows[0].one_attempt_per_roll) {
      const submitted = await pool.query('SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND roll_number = $2 AND status IN (\'SUBMITTED\',\'EXPIRED\',\'EVALUATED\')', [quizId, quiz.rows[0].roll_number])
      if (submitted.rowCount) return response.status(409).json({ success: false, error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted this exam.' } })
    }
    const attemptNumber = Number(attempts.rows[0].count) + 1
    const limit = await pool.query<{ attempt_limit: number }>('SELECT attempt_limit FROM quizzes WHERE id = $1', [quizId])
    if (attemptNumber > limit.rows[0].attempt_limit) return response.status(409).json({ success: false, error: { code: 'ATTEMPT_LIMIT_REACHED', message: 'No attempts remain for this quiz' } })
    const startedAt = new Date()
    const expiresAt = new Date(Math.min(startedAt.getTime() + quiz.rows[0].duration_minutes * 60_000, new Date(quiz.rows[0].end_at).getTime()))
    const created = await pool.query<{ id: string }>('INSERT INTO quiz_attempts (quiz_id, student_id, attempt_number, roll_number, started_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [quizId, studentId, attemptNumber, quiz.rows[0].roll_number, startedAt, expiresAt])
    const questions = await pool.query<{ id: string; question_text_snapshot: string; question_type_snapshot: string; marks: string; display_order: number; option_id: string | null; option_text: string | null }>(`SELECT qq.id, qq.question_text_snapshot, qq.question_type_snapshot, qq.marks, qq.display_order, qo.id AS option_id, qo.option_text FROM quiz_questions qq LEFT JOIN question_options qo ON qo.question_id = qq.question_id WHERE qq.quiz_id = $1 ORDER BY qq.display_order, qo.display_order`, [quizId])
    const grouped = questions.rows.reduce<Record<string, { id: string; text: string; type: string; marks: string; displayOrder: number; options: { id: string; text: string }[] }>>((items, row) => { const current = items[row.id] ?? { id: row.id, text: row.question_text_snapshot, type: row.question_type_snapshot, marks: row.marks, displayOrder: row.display_order, options: [] }; if (row.option_id && row.option_text) current.options.push({ id: row.option_id, text: row.option_text }); items[row.id] = current; return items }, {})
    return response.status(201).json({ success: true, data: { id: created.rows[0].id, quizId, startedAt, expiresAt, questions: Object.values(grouped) }, message: 'Quiz attempt started' })
  } catch (error) { next(error) }
})

router.put('/attempts/:attemptId/answers/:questionId', requireAuth, requireRole('STUDENT'), async (request, response, next) => {
  try {
    const attemptId = id.parse(request.params.attemptId)
    const questionId = id.parse(request.params.questionId)
    const input = answerSchema.parse(request.body)
    const ownership = await pool.query<{ question_id: string }>(`SELECT qq.id AS question_id FROM quiz_attempts a JOIN students s ON s.id = a.student_id JOIN quiz_questions qq ON qq.quiz_id = a.quiz_id WHERE a.id = $1 AND qq.id = $2 AND s.user_id = $3 AND a.status = 'IN_PROGRESS' AND a.expires_at > now()`, [attemptId, questionId, request.auth!.userId])
    if (!ownership.rowCount) return response.status(403).json({ success: false, error: { code: 'ATTEMPT_UNAVAILABLE', message: 'Attempt is unavailable or expired' } })
    if (input.selectedOptionId) { const option = await pool.query('SELECT 1 FROM quiz_questions qq JOIN question_options qo ON qo.question_id = qq.question_id WHERE qq.id = $1 AND qo.id = $2', [questionId, input.selectedOptionId]); if (!option.rowCount) return response.status(422).json({ success: false, error: { code: 'INVALID_OPTION', message: 'Option does not belong to this question' } }) }
    await pool.query('INSERT INTO quiz_answers (attempt_id, question_id, selected_option_id, text_answer, feedback) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id, text_answer = EXCLUDED.text_answer, feedback = EXCLUDED.feedback, answered_at = now()', [attemptId, questionId, input.selectedOptionId ?? null, input.textAnswer ?? null, input.markedForReview ? 'MARKED_FOR_REVIEW' : null])
    return response.json({ success: true, data: { attemptId, questionId, savedAt: new Date().toISOString() }, message: 'Answer saved' })
  } catch (error) { next(error) }
})

router.post('/attempts/:attemptId/events', requireAuth, requireRole('STUDENT'), async (request, response, next) => {
  try {
    const attemptId = id.parse(request.params.attemptId)
    const input = eventSchema.parse(request.body)
    const ownership = await pool.query('SELECT 1 FROM quiz_attempts a JOIN students s ON s.id = a.student_id JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = $1 AND s.user_id = $2 AND a.status = \'IN_PROGRESS\' AND q.integrity_monitoring = true', [attemptId, request.auth!.userId])
    if (!ownership.rowCount) return response.status(403).json({ success: false, error: { code: 'ATTEMPT_UNAVAILABLE', message: 'Attempt is unavailable' } })
    await pool.query('INSERT INTO exam_events (attempt_id, event_type, metadata) VALUES ($1,$2,$3)', [attemptId, input.eventType, input.metadata])
    if (input.eventType === 'TAB_HIDDEN' || input.eventType === 'WINDOW_BLUR') await pool.query('UPDATE quiz_attempts SET tab_switch_count = tab_switch_count + 1 WHERE id = $1', [attemptId])
    return response.status(201).json({ success: true, data: { attemptId }, message: 'Exam event recorded' })
  } catch (error) { next(error) }
})

router.post('/attempts/:attemptId/submit', requireAuth, requireRole('STUDENT'), async (request, response, next) => {
  const client = await pool.connect()
  try {
    const attemptId = id.parse(request.params.attemptId)
    await client.query('BEGIN')
    const attempt = await client.query<{ quiz_id: string; student_id: string; status: string; expires_at: Date; passing_marks: string; total_marks: string }>(`SELECT a.quiz_id, a.student_id, a.status, a.expires_at, q.passing_marks, q.total_marks FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id JOIN students s ON s.id = a.student_id WHERE a.id = $1 AND s.user_id = $2 FOR UPDATE`, [attemptId, request.auth!.userId])
    if (!attempt.rowCount) { await client.query('ROLLBACK'); return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Attempt is outside your access scope' } }) }
    const current = attempt.rows[0]
    if (current.status !== 'IN_PROGRESS') return response.status(409).json({ success: false, error: { code: 'ALREADY_SUBMITTED', message: 'Attempt has already been submitted' } })
    const expired = new Date(current.expires_at).getTime() <= Date.now()
    const answers = await client.query<{ answer_id: string; selected_option_id: string | null; text_answer: string | null; correct: boolean | null; expected_answer: string | null; marks: string; type: string }>(`SELECT qa.id AS answer_id, qa.selected_option_id, qa.text_answer, qo.is_correct AS correct, q.expected_answer, qq.marks, qq.question_type_snapshot AS type FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id LEFT JOIN quiz_answers qa ON qa.attempt_id = $1 AND qa.question_id = qq.id LEFT JOIN question_options qo ON qo.id = qa.selected_option_id WHERE qq.quiz_id = $2`, [attemptId, current.quiz_id])
    let obtained = 0
    let pendingReview = false
    for (const answer of answers.rows) {
      if (answer.type === 'SHORT_ANSWER') { if (answer.answer_id) pendingReview = true; continue }
      const textCorrect = Boolean(answer.text_answer && answer.expected_answer && answer.text_answer.trim().toLowerCase() === answer.expected_answer.trim().toLowerCase())
      const isCorrect = answer.correct === true || textCorrect
      const marks = isCorrect ? Number(answer.marks) : 0
      obtained += marks
      if (answer.answer_id) await client.query('UPDATE quiz_answers SET marks_awarded = $1, is_correct = $2 WHERE id = $3', [marks, isCorrect, answer.answer_id])
    }
    const status = pendingReview ? 'SUBMITTED' : 'EVALUATED'
    if (expired) await client.query("INSERT INTO exam_events (attempt_id, event_type, metadata) VALUES ($1, 'AUTO_SUBMIT', $2)", [attemptId, { reason: 'expires_at_reached' }])
    await client.query('UPDATE quiz_attempts SET status = $1, submitted_at = now() WHERE id = $2', [expired ? 'EXPIRED' : status, attemptId])
    const percentage = calculatePercentage(obtained, Number(current.total_marks))
    const result = await client.query<{ id: string }>('INSERT INTO quiz_results (attempt_id, student_id, quiz_id, total_marks, obtained_marks, percentage, pass_status, evaluated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8 = \'EVALUATED\' THEN now() ELSE NULL END) ON CONFLICT (attempt_id) DO UPDATE SET obtained_marks = EXCLUDED.obtained_marks, percentage = EXCLUDED.percentage, pass_status = EXCLUDED.pass_status, evaluated_at = EXCLUDED.evaluated_at RETURNING id', [attemptId, current.student_id, current.quiz_id, current.total_marks, obtained, percentage, pendingReview ? null : obtained >= Number(current.passing_marks), status])
    await client.query('COMMIT')
    return response.json({ success: true, data: { resultId: result.rows[0].id, status: expired ? 'EXPIRED' : status, obtainedMarks: obtained, totalMarks: Number(current.total_marks), percentage, pendingReview }, message: expired ? 'Attempt expired and was submitted' : 'Quiz submitted' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})
export default router
