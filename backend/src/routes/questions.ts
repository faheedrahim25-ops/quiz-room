import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const id = z.string().uuid()
const questionSchema = z.object({
  subjectId: id.optional(),
  topicId: id.optional(),
  questionText: z.string().trim().min(1).max(5000),
  questionType: z.enum(['MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'SHORT_ANSWER']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  marks: z.number().positive().max(100),
  explanation: z.string().trim().max(5000).optional(),
  expectedAnswer: z.string().trim().max(5000).optional(),
  options: z.array(z.object({ optionText: z.string().trim().min(1).max(1000), isCorrect: z.boolean(), displayOrder: z.number().int().positive() })).max(10).default([]),
})

function validateOptions(input: z.infer<typeof questionSchema>) {
  if (input.questionType === 'MCQ' && (input.options.length < 2 || input.options.filter((option) => option.isCorrect).length !== 1)) throw new Error('MCQ_REQUIRES_ONE_CORRECT_OPTION')
  if (input.questionType === 'TRUE_FALSE' && input.options.length !== 0) throw new Error('TRUE_FALSE_DOES_NOT_ACCEPT_OPTIONS')
  if (input.questionType === 'SHORT_ANSWER' && input.options.length !== 0) throw new Error('SHORT_ANSWER_DOES_NOT_ACCEPT_OPTIONS')
  if (input.questionType === 'FILL_BLANK' && (!input.expectedAnswer || input.options.length !== 0)) throw new Error('FILL_BLANK_REQUIRES_EXPECTED_ANSWER')
  if (input.questionType === 'TRUE_FALSE' && !input.expectedAnswer) throw new Error('TRUE_FALSE_REQUIRES_EXPECTED_ANSWER')
}

router.get('/', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const result = await pool.query(`SELECT q.id, q.question_text, q.question_type, q.difficulty, q.marks, q.explanation, q.status, q.created_by, q.subject_id, q.topic_id, q.created_at FROM questions q WHERE ($1::text IS NULL OR q.question_type::text = $1) AND ($2::text IS NULL OR q.difficulty = $2) AND ($3::uuid IS NULL OR q.subject_id = $3) ORDER BY q.created_at DESC LIMIT 100`, [typeof request.query.type === 'string' ? request.query.type : null, typeof request.query.difficulty === 'string' ? request.query.difficulty : null, typeof request.query.subjectId === 'string' ? request.query.subjectId : null])
    return response.json({ success: true, data: result.rows, message: 'Questions loaded' })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  const client = await pool.connect()
  try {
    const input = questionSchema.parse(request.body)
    validateOptions(input)
    await client.query('BEGIN')
    const subject = input.subjectId ? { rows: [{ id: input.subjectId }] } : await client.query<{ id: string }>('SELECT id FROM subjects ORDER BY code LIMIT 1')
    if (!subject.rows[0]) throw new Error('SUBJECT_REQUIRED')
    const question = await client.query<{ id: string }>('INSERT INTO questions (created_by, subject_id, topic_id, question_text, question_type, difficulty, marks, explanation, expected_answer, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,\'ACTIVE\') RETURNING id', [request.auth!.userId, subject.rows[0].id, input.topicId ?? null, input.questionText, input.questionType, input.difficulty, input.marks, input.explanation ?? null, input.expectedAnswer ?? null])
    const options = input.questionType === 'TRUE_FALSE' ? ['True', 'False'].map((optionText, index) => ({ optionText, isCorrect: input.expectedAnswer?.toLowerCase() === optionText.toLowerCase(), displayOrder: index + 1 })) : input.options
    for (const option of options) await client.query('INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES ($1,$2,$3,$4)', [question.rows[0].id, option.optionText, option.isCorrect, option.displayOrder])
    await client.query('COMMIT')
    return response.status(201).json({ success: true, data: { id: question.rows[0].id }, message: 'Question created' })
  } catch (error) { await client.query('ROLLBACK'); next(error) } finally { client.release() }
})

router.patch('/:id/archive', requireAuth, requireRole('ADMIN', 'MENTOR'), async (request, response, next) => {
  try {
    const questionId = id.parse(request.params.id)
    const ownership = request.auth!.roles.includes('ADMIN') ? '' : 'AND created_by = $2'
    const values = request.auth!.roles.includes('ADMIN') ? [questionId] : [questionId, request.auth!.userId]
    const result = await pool.query(`UPDATE questions SET status = 'ARCHIVED', updated_at = now() WHERE id = $1 ${ownership} RETURNING id`, values)
    if (!result.rowCount) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Question is outside your access scope' } })
    return response.json({ success: true, data: { id: questionId }, message: 'Question archived' })
  } catch (error) { next(error) }
})
export default router
