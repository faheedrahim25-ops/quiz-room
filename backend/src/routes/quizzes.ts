import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateQuizCode, isValidQuizCode } from '../services/quizCodes.js'
import { createAccessToken, hashPassword } from '../services/auth.js'

const router = Router()
const id = z.string().uuid()
const joinCodeSchema = z.object({ code: z.string().trim().transform((value) => value.toUpperCase()).refine(isValidQuizCode, { message: 'Invalid join code' }) })
const quizSchema = z.object({
  title: z.string().trim().min(1).max(180), description: z.string().trim().max(5000).optional(), instructions: z.string().trim().max(5000).optional(), subjectId: id.optional(),
  durationMinutes: z.number().int().positive().max(480), passingMarks: z.number().nonnegative(), startAt: z.coerce.date(), endAt: z.coerce.date(), attemptLimit: z.number().int().positive().max(10).default(1), randomizeQuestions: z.boolean().default(false),
  questionIds: z.array(id).min(1).max(100),
}).refine((input) => input.endAt > input.startAt, { message: 'endAt must be after startAt' })

router.get('/', requireAuth, requireRole('ADMIN', 'MENTOR', 'STUDENT'), async (request, response, next) => {
  try {
    const values: string[] = []
    let scope = ''
    if (request.auth!.roles.includes('STUDENT')) { values.push(request.auth!.userId); scope = `JOIN students st ON st.user_id = $${values.length} JOIN quiz_assignments qa ON qa.student_id = st.id AND qa.quiz_id = q.id AND qa.status = 'ACTIVE'` }
    if (request.auth!.roles.includes('MENTOR') && !request.auth!.roles.includes('ADMIN')) { values.push(request.auth!.userId); scope = `WHERE q.created_by = $${values.length}` }
    const result = await pool.query(`SELECT q.id, q.title, q.description, q.subject_id, q.duration_minutes, q.total_marks, q.passing_marks, q.start_at, q.end_at, q.attempt_limit, q.status, q.published_at, q.join_code FROM quizzes q ${scope} ORDER BY q.start_at DESC LIMIT 100`, values)
    return response.json({ success: true, data: result.rows, message: 'Quizzes loaded' })
  } catch (error) { next(error) }
})
const assignmentSchema = z.object({ studentIds: z.array(id).min(1).max(500) })

router.post('/', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  const client = await pool.connect()
  try {
    const input = quizSchema.parse(request.body)
    await client.query('BEGIN')
    const subject = input.subjectId ? { rows: [{ id: input.subjectId }] } : await client.query<{ id: string }>('SELECT id FROM subjects ORDER BY code LIMIT 1')
    if (!subject.rows[0]) throw new Error('SUBJECT_REQUIRED')
    const questions = await client.query<{ id: string; question_text: string; question_type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER'; marks: string }>('SELECT id, question_text, question_type, marks FROM questions WHERE id = ANY($1::uuid[]) AND status = \'ACTIVE\' ORDER BY array_position($1::uuid[], id)', [input.questionIds])
    if (questions.rowCount !== input.questionIds.length) throw new Error('QUESTION_SET_INVALID')
    const totalMarks = questions.rows.reduce((sum, question) => sum + Number(question.marks), 0)
    if (input.passingMarks > totalMarks) throw new Error('PASSING_MARKS_EXCEED_TOTAL')
    let joinCode = ''
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateQuizCode()
      const existing = await client.query('SELECT 1 FROM quizzes WHERE join_code = $1', [candidate])
      if (!existing.rowCount) { joinCode = candidate; break }
    }
    if (!joinCode) throw new Error('QUIZ_CODE_GENERATION_FAILED')
    const quiz = await client.query<{ id: string }>('INSERT INTO quizzes (created_by, title, description, instructions, subject_id, duration_minutes, total_marks, passing_marks, start_at, end_at, attempt_limit, randomize_questions, status, join_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,\'DRAFT\', $13) RETURNING id', [request.auth!.userId, input.title, input.description ?? null, input.instructions ?? null, subject.rows[0].id, input.durationMinutes, totalMarks, input.passingMarks, input.startAt, input.endAt, input.attemptLimit, input.randomizeQuestions, joinCode])
    for (const [index, question] of questions.rows.entries()) await client.query('INSERT INTO quiz_questions (quiz_id, question_id, question_text_snapshot, question_type_snapshot, marks, display_order) VALUES ($1,$2,$3,$4,$5,$6)', [quiz.rows[0].id, question.id, question.question_text, question.question_type, question.marks, index + 1])
    await client.query('COMMIT')
    return response.status(201).json({ success: true, data: { id: quiz.rows[0].id, totalMarks, joinCode }, message: 'Quiz saved as draft' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})

router.post('/join-public', async (request, response, next) => {
  const client = await pool.connect()
  try {
    const input = joinCodeSchema.extend({ name: z.string().trim().min(2).max(120), rollNumber: z.string().trim().min(2).max(40) }).parse(request.body)
    await client.query('BEGIN')
    const result = await client.query<{ id: string; title: string; join_code: string }>(`SELECT q.id, q.title, q.join_code FROM quizzes q WHERE q.join_code = $1 AND q.status IN ('PUBLISHED', 'SCHEDULED', 'ACTIVE') AND q.start_at <= now() AND q.end_at > now()`, [input.code])
    if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ success: false, error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found or no longer accepting responses' } }) }
    const guestRegisterNumber = `GUEST-${result.rows[0].id.slice(0, 8)}-${input.rollNumber.toUpperCase()}`
    const duplicate = await client.query('SELECT 1 FROM students s WHERE s.student_register_number = $1 OR EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.quiz_id = $2 AND a.roll_number = $3)', [guestRegisterNumber, result.rows[0].id, input.rollNumber.toUpperCase()])
    if (duplicate.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ success: false, error: { code: 'DUPLICATE_ROLL_NUMBER', message: 'This roll number has already joined this quiz.' } }) }

    const department = await client.query<{ id: string }>('SELECT id FROM departments ORDER BY code LIMIT 1')
    const departmentId = department.rowCount ? department.rows[0].id : (await client.query<{ id: string }>("INSERT INTO departments (name, code) VALUES ('Computer Science', 'CS') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id")).rows[0].id

    const program = await client.query<{ id: string; department_id: string }>('SELECT id, department_id FROM programs ORDER BY code LIMIT 1')
    const programId = program.rowCount ? program.rows[0].id : (await client.query<{ id: string; department_id: string }>("INSERT INTO programs (department_id, name, code) VALUES ($1, 'B.Sc. Computer Science', 'BSCS') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id, department_id", [departmentId])).rows[0].id

    const year = await client.query<{ id: string }>('SELECT id FROM academic_years ORDER BY starts_on DESC LIMIT 1')
    const academicYearId = year.rowCount ? year.rows[0].id : (await client.query<{ id: string }>("INSERT INTO academic_years (label, starts_on, ends_on) VALUES ('2026-2027', '2026-06-01', '2027-05-31') ON CONFLICT (label) DO NOTHING RETURNING id")).rows[0]?.id ?? (await client.query<{ id: string }>("SELECT id FROM academic_years WHERE label = '2026-2027'")).rows[0].id

    const semester = await client.query<{ id: string; academic_year_id: string }>('SELECT id, academic_year_id FROM semesters ORDER BY sequence_no LIMIT 1')
    const semesterId = semester.rowCount ? semester.rows[0].id : (await client.query<{ id: string }>("INSERT INTO semesters (academic_year_id, name, sequence_no) VALUES ($1, 'Semester 1', 1) ON CONFLICT (academic_year_id, sequence_no) DO NOTHING RETURNING id", [academicYearId])).rows[0]?.id ?? (await client.query<{ id: string }>("SELECT id FROM semesters WHERE academic_year_id = $1 AND sequence_no = 1", [academicYearId])).rows[0].id

    const nameParts = input.name.split(/\s+/)
    const firstName = nameParts.shift() ?? input.name
    const lastName = nameParts.join(' ') || 'Participant'
    const guestEmail = `quiz-${randomUUID()}@participant.local`
    const passwordHash = await hashPassword(randomUUID())
    const user = await client.query<{ id: string }>('INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1,$2,$3,$4) RETURNING id', [guestEmail, passwordHash, firstName, lastName])
    const student = await client.query<{ id: string }>('INSERT INTO students (user_id, student_register_number, department_id, program_id, academic_year_id, semester_id, admission_year) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [user.rows[0].id, guestRegisterNumber, departmentId, programId, academicYearId, semesterId, new Date().getUTCFullYear()])
    await client.query('INSERT INTO quiz_assignments (quiz_id, student_id, assigned_by) VALUES ($1,$2,$3) ON CONFLICT (quiz_id, student_id) DO NOTHING', [result.rows[0].id, student.rows[0].id, user.rows[0].id])
    await client.query('COMMIT')
    const accessToken = createAccessToken({ id: user.rows[0].id, email: guestEmail, firstName, lastName, roles: ['STUDENT'] })
    return response.status(201).json({ success: true, data: { accessToken, quizId: result.rows[0].id, title: result.rows[0].title, joinCode: result.rows[0].join_code, name: input.name, rollNumber: input.rollNumber }, message: 'Quiz joined successfully' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})

router.post('/join', requireAuth, requireRole('STUDENT'), async (request, response, next) => {
  try {
    const input = joinCodeSchema.parse(request.body)
    const student = await pool.query<{ id: string }>('SELECT id FROM students WHERE user_id = $1 AND status = \'ACTIVE\'', [request.auth!.userId])
    if (!student.rowCount) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Active student profile required' } })
    const result = await pool.query<{ id: string; title: string; status: string; join_code: string }>(`SELECT q.id, q.title, q.status, q.join_code FROM quizzes q WHERE q.join_code = $1 AND q.status IN ('PUBLISHED', 'SCHEDULED', 'ACTIVE') AND q.start_at <= now() AND q.end_at > now()`, [input.code])
    if (!result.rowCount) return response.status(404).json({ success: false, error: { code: 'QUIZ_NOT_FOUND', message: 'No quiz is currently active for that code' } })
    const assignment = await pool.query('SELECT 1 FROM quiz_assignments WHERE quiz_id = $1 AND student_id = $2 AND status = \'ACTIVE\'', [result.rows[0].id, student.rows[0].id])
    if (!assignment.rowCount) {
      await pool.query('INSERT INTO quiz_assignments (quiz_id, student_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT (quiz_id, student_id) DO NOTHING', [result.rows[0].id, student.rows[0].id, request.auth!.userId])
    }
    return response.json({ success: true, data: { quizId: result.rows[0].id, title: result.rows[0].title, joinCode: result.rows[0].join_code }, message: 'Quiz code accepted' })
  } catch (error) { next(error) }
})

router.post('/:id/publish', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const quizId = id.parse(request.params.id)
    const result = await pool.query(`UPDATE quizzes SET status = CASE WHEN start_at > now() THEN 'SCHEDULED'::quiz_status ELSE 'ACTIVE'::quiz_status END, published_at = now(), updated_at = now() WHERE id = $1 AND status = 'DRAFT' AND ($2 = true OR created_by = $3) AND EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = quizzes.id) RETURNING id, status`, [quizId, request.auth!.roles.includes('ADMIN'), request.auth!.userId])
    if (!result.rowCount) return response.status(409).json({ success: false, error: { code: 'QUIZ_NOT_PUBLISHABLE', message: 'Quiz is missing required questions or is outside your access scope' } })
    return response.json({ success: true, data: result.rows[0], message: 'Quiz published' })
  } catch (error) { next(error) }
})

router.post('/:id/assign', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  const client = await pool.connect()
  try {
    const quizId = id.parse(request.params.id)
    const input = assignmentSchema.parse(request.body)
    await client.query('BEGIN')
    const quiz = await client.query<{ title: string }>('SELECT title FROM quizzes WHERE id = $1 AND status IN (\'PUBLISHED\', \'SCHEDULED\', \'ACTIVE\') AND ($2 = true OR created_by = $3) FOR UPDATE', [quizId, request.auth!.roles.includes('ADMIN'), request.auth!.userId])
    if (!quiz.rowCount) { await client.query('ROLLBACK'); return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Quiz is unpublished or outside your access scope' } }) }
    const permitted = await client.query<{ id: string; user_id: string }>(`SELECT s.id, s.user_id FROM students s WHERE s.id = ANY($1::uuid[]) AND s.status = 'ACTIVE' AND ($2 = true OR EXISTS (SELECT 1 FROM mentor_assignments ma WHERE ma.student_id = s.id AND ma.status = 'ACTIVE' AND ma.mentor_id = (SELECT id FROM faculty WHERE user_id = $3)))`, [input.studentIds, request.auth!.roles.includes('ADMIN'), request.auth!.userId])
    if (permitted.rowCount !== input.studentIds.length) throw new Error('STUDENT_ASSIGNMENT_SCOPE_INVALID')
    let assigned = 0
    for (const student of permitted.rows) { const inserted = await client.query('INSERT INTO quiz_assignments (quiz_id, student_id, assigned_by) VALUES ($1,$2,$3) ON CONFLICT (quiz_id, student_id) DO NOTHING RETURNING id', [quizId, student.id, request.auth!.userId]); if (inserted.rowCount) { assigned += 1; await client.query('INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES ($1, \'QUIZ_ASSIGNED\', $2, $3, \'QUIZ\', $4)', [student.user_id, 'New quiz assigned', `You have been assigned ${quiz.rows[0].title}.`, quizId]) } }
    await client.query('COMMIT')
    return response.status(201).json({ success: true, data: { assigned }, message: 'Quiz assignments created' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})
export default router
