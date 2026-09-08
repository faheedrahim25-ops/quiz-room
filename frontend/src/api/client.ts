const API_URL = (import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api/v1' : 'http://localhost:4000/api/v1')).replace(/\/$/, '')

export type AuthUser = { id: string; email: string; firstName: string; lastName: string; roles: string[] }
export type MentorDashboard = { mentees: number; averagePerformance: number; pendingEvaluations: number; upcomingMeetings: number }
export type StudentRecord = { id: string; student_register_number: string; first_name: string; last_name: string; latest_score: number | null; status: string }
export type QuizSummary = { id: string; title: string; status: string; start_at: string; end_at: string; total_marks: number; duration_minutes: number; join_code?: string | null }
export type MeetingSummary = { id: string; title: string; scheduled_start: string; scheduled_end: string; student_id: string; status: string; }
export type NotificationSummary = { id: string; title: string; message: string; status: string; }
export type QuestionSummary = { id: string; question_text: string; question_type: string; difficulty: string; marks: number; subject_id: string; }
export type AttemptQuestion = { id: string; text: string; type: string; marks: string; displayOrder: number; options: { id: string; text: string }[] }
export type QuizAttempt = { id: string; quizId: string; startedAt: string; expiresAt: string; questions: AttemptQuestion[] }
export type ResultSummary = { id: string; quiz_id?: string; title: string; student_name?: string; total_questions?: number; total_marks: number; obtained_marks: number; percentage: number; pass_status: boolean | null; evaluated_at: string | null; submitted_at?: string | null; tab_switch_count?: number }
export type LeaderboardRow = { rank: number | string; name: string; obtained_marks: number | string; total_marks: number | string; percentage: number | string }
export type PendingEvaluation = { attempt_id: string; title: string; student_name: string; submitted_at: string }
export type EvaluationAnswer = { id: string; question_id: string; question_text_snapshot: string; marks: number; text_answer: string | null; marks_awarded: number | null; feedback: string | null }
export type AssignmentSummary = { id: string; mentor_id: string; student_id: string; mentor_name: string; student_name: string; student_register_number: string; status: string; effective_from: string; }
export type ReportOverview = { evaluated_attempts: number; average_percentage: number; passed_attempts: number; failed_attempts: number }
export type AnnouncementSummary = { id: string; title: string; content: string; audience: string; priority: string; publish_at: string }
export type AuditSummary = { id: string; action: string; entity_type: string; actor_name: string | null; created_at: string }
export type MentorSummary = { id: string; employee_id: string; first_name: string; last_name: string; designation: string; department: string }

type ApiResponse<T> = { success: boolean; data: T; message?: string; error?: { code: string; message: string } }

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers } })
  const body = await response.json() as ApiResponse<T>
  if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Request failed')
  return body.data
}

export function login(email: string, password: string) { return request<{ user: AuthUser; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
export function refreshSession() { return request<{ user: AuthUser; accessToken: string }>('/auth/refresh', { method: 'POST' }) }
export function registerTeacher(name: string, email: string, password: string, confirmPassword: string) { return request<{ email: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword }) }) }
export function requestPasswordReset(email: string) { return request<{ developmentToken?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }) }
export function resetPassword(token: string, password: string) { return request<null>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }) }
export function joinQuizPublic(code: string, name: string, rollNumber: string) { return request<{ accessToken: string; quizId: string; title: string; joinCode: string; name: string; rollNumber: string }>('/quizzes/join-public', { method: 'POST', body: JSON.stringify({ code, name, rollNumber }) }) }
export function getMe(accessToken: string) { return request<AuthUser>('/auth/me', {}, accessToken) }
export function getMentorDashboard(accessToken: string) { return request<MentorDashboard>('/dashboard/mentor', {}, accessToken) }
export function getStudents(accessToken: string) { return request<{ items: StudentRecord[] }>('/students?page=1&pageSize=100', {}, accessToken) }
export function getQuizzes(accessToken: string) { return request<QuizSummary[]>('/quizzes', {}, accessToken) }
export function getMeetings(accessToken: string) { return request<MeetingSummary[]>('/meetings', {}, accessToken) }
export function getNotifications(accessToken: string) { return request<NotificationSummary[]>('/notifications', {}, accessToken) }
export function getQuestions(accessToken: string) { return request<QuestionSummary[]>('/questions', {}, accessToken) }
export function createQuestion(accessToken: string, input: { questionText: string; questionType: 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER'; marks: number; expectedAnswer?: string; options: { optionText: string; isCorrect: boolean; displayOrder: number }[] }) { return request<{ id: string }>('/questions', { method: 'POST', body: JSON.stringify({ ...input, difficulty: 'MEDIUM' }) }, accessToken) }
export function createQuiz(accessToken: string, input: { title: string; description?: string; instructions?: string; subjectId?: string; durationMinutes: number; passingMarks: number; startAt: string; endAt: string; attemptLimit: number; randomizeQuestions: boolean; questionIds: string[] }) { return request<{ id: string; totalMarks: number; joinCode?: string }>('/quizzes', { method: 'POST', body: JSON.stringify(input) }, accessToken) }
export function publishQuiz(accessToken: string, quizId: string) { return request<{ id: string; status: string }>(`/quizzes/${quizId}/publish`, { method: 'POST' }, accessToken) }
export function assignQuiz(accessToken: string, quizId: string, studentIds: string[]) { return request<{ assigned: number }>(`/quizzes/${quizId}/assign`, { method: 'POST', body: JSON.stringify({ studentIds }) }, accessToken) }
export function joinQuizByCode(accessToken: string, joinCode: string) { return request<{ quizId: string; title: string; joinCode: string }>(`/quizzes/join`, { method: 'POST', body: JSON.stringify({ code: joinCode }) }, accessToken) }
export function startQuiz(accessToken: string, quizId: string) { return request<QuizAttempt>(`/quizzes/${quizId}/start`, { method: 'POST' }, accessToken) }
export function saveAttemptAnswer(accessToken: string, attemptId: string, questionId: string, input: { selectedOptionId?: string | null; textAnswer?: string | null; markedForReview?: boolean }) { return request<{ attemptId: string; questionId: string }>(`/attempts/${attemptId}/answers/${questionId}`, { method: 'PUT', body: JSON.stringify(input) }, accessToken) }
export function recordExamEvent(accessToken: string, attemptId: string, eventType: 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'WINDOW_FOCUS' | 'AUTO_SUBMIT') { return request<{ attemptId: string }>(`/attempts/${attemptId}/events`, { method: 'POST', body: JSON.stringify({ eventType }) }, accessToken) }
export function submitAttempt(accessToken: string, attemptId: string) { return request<{ resultId: string; status: string; obtainedMarks: number; totalMarks: number; percentage: number; pendingReview: boolean }>(`/attempts/${attemptId}/submit`, { method: 'POST' }, accessToken) }
export function getResults(accessToken: string) { return request<ResultSummary[]>('/results', {}, accessToken) }
export function getLeaderboard(accessToken: string, quizId: string) { return request<LeaderboardRow[]>(`/quizzes/${quizId}/leaderboard`, {}, accessToken) }
export function getPendingEvaluations(accessToken: string) { return request<PendingEvaluation[]>('/evaluations/pending', {}, accessToken) }
export function evaluateAttempt(accessToken: string, attemptId: string, answers: { answerId: string; marksAwarded: number; feedback?: string }[]) { return request<{ attemptId: string; obtainedMarks: number; percentage: number; pendingAnswers: number }>(`/attempts/${attemptId}/evaluate`, { method: 'POST', body: JSON.stringify({ answers }) }, accessToken) }
export function getEvaluation(accessToken: string, attemptId: string) { return request<{ answers: EvaluationAnswer[] }>(`/attempts/${attemptId}/evaluation`, {}, accessToken) }
export function getAssignments(accessToken: string) { return request<AssignmentSummary[]>('/mentor-assignments', {}, accessToken) }
export function getReportOverview(accessToken: string) { return request<ReportOverview>('/reports/overview', {}, accessToken) }
export function getAnnouncements(accessToken: string) { return request<AnnouncementSummary[]>('/announcements', {}, accessToken) }
export function getAuditLogs(accessToken: string) { return request<AuditSummary[]>('/audit-logs', {}, accessToken) }
export function getMentors(accessToken: string) { return request<MentorSummary[]>('/mentors', {}, accessToken) }
export function createAssignment(accessToken: string, mentorId: string, studentId: string) { return request<{ id: string }>('/mentor-assignments', { method: 'POST', body: JSON.stringify({ mentorId, studentId, effectiveFrom: new Date().toISOString() }) }, accessToken) }
export function logout() { return request<null>('/auth/logout', { method: 'POST' }) }
