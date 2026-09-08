import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, Check, Clock3, Download, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { createQuestion, createQuiz, getLeaderboard, getMe, getQuizzes, joinQuizPublic, login, publishQuiz, recordExamEvent, refreshSession, registerTeacher, requestPasswordReset, saveAttemptAnswer, startQuiz, submitAttempt, type AttemptQuestion, type AuthUser, type LeaderboardRow, type QuizAttempt, type QuizSummary, type ResultSummary } from './api/client'
import './App.css'
import './quiz.css'
import './interaction.css'
import './redesign.css'
import { AttemptView } from './AttemptView'
import { TeacherWorkspace } from './TeacherWorkspace'

type Mode = 'home' | 'teacher-login' | 'teacher-register' | 'forgot-password' | 'teacher' | 'join' | 'ready' | 'attempt' | 'result'
type TeacherView = 'dashboard' | 'quizzes' | 'results'
type DraftQuestion = { text: string; type: 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER'; options: string[]; correct: number; expectedAnswer: string; marks: number }
const emptyQuestion = (): DraftQuestion => ({ text: '', type: 'MCQ', options: ['', '', '', ''], correct: 0, expectedAnswer: '', marks: 1 })

export default function App() {
  const [mode, setMode] = useState<Mode>('home')
  const [token, setToken] = useState(() => localStorage.getItem('quiz_token') ?? '')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [studentName, setStudentName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [emailAfterRegistration, setEmailAfterRegistration] = useState('')
  const [quizTitle, setQuizTitle] = useState('')
  const [quizInstructions, setQuizInstructions] = useState('Answer all questions. Your exam submits automatically when time expires.')
  const [quizDuration, setQuizDuration] = useState(15)
  const [joinCode, setJoinCode] = useState('')
  const [quizId, setQuizId] = useState('')
  const [joinedTitle, setJoinedTitle] = useState('')
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardRow[]>>({})
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()])
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ResultSummary | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [teacherView, setTeacherView] = useState<TeacherView>('dashboard')
  const [publishedCode, setPublishedCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  useEffect(() => {
    const sharedCode = new URLSearchParams(window.location.search).get('quiz')
    if (sharedCode) { setJoinCode(sharedCode.toUpperCase()); setMode('join') }
  }, [])
  useEffect(() => {
    if (!token || user || mode !== 'home') return
    void getMe(token)
      .catch(async () => {
        const refreshed = await refreshSession()
        localStorage.setItem('quiz_token', refreshed.accessToken)
        setToken(refreshed.accessToken)
        return refreshed.user
      })
      .then((currentUser) => {
        setUser(currentUser)
        if (currentUser.roles.includes('ADMIN') || currentUser.roles.includes('MENTOR')) setMode('teacher')
      })
      .catch(() => {
        localStorage.removeItem('quiz_token')
        setToken('')
        setUser(null)
        setMode('teacher-login')
        setMessage('Your session has expired. Please sign in again.')
      })
  }, [token, user, mode])
  useEffect(() => { if (token && user) void loadTeacherQuizzes() }, [token, user])
  async function loadTeacherQuizzes() { try { const quizList = await getQuizzes(token); const boardEntries = await Promise.all(quizList.filter((quiz) => quiz.status !== 'DRAFT' && quiz.join_code).map(async (quiz) => [quiz.id, await getLeaderboard(token, quiz.id)] as const)); const boardMap = Object.fromEntries(boardEntries); setQuizzes(quizList); setPublishedCode((current) => current || quizList.find((quiz) => quiz.join_code)?.join_code || ''); setLeaderboards(boardMap); const boardQuiz = quizList.find((quiz) => quiz.status !== 'DRAFT' && quiz.join_code); setLeaderboard(boardQuiz ? boardMap[boardQuiz.id] ?? [] : []) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load quiz data') } }
  async function teacherLogin(email: string, password: string) {
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || !trimmedPassword) {
      setMessage('Enter both email and password to continue.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMessage('Please enter a valid email address.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const response = await login(trimmedEmail, trimmedPassword)
      localStorage.setItem('quiz_token', response.accessToken)
      setToken(response.accessToken)
      setUser(response.user)
      setMode('teacher')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }
  async function joinQuiz(event: FormEvent) {
    event.preventDefault()
    const trimmedCode = joinCode.trim()
    const trimmedName = studentName.trim()
    const trimmedRollNumber = rollNumber.trim()
    if (!trimmedCode || !trimmedName || !trimmedRollNumber) {
      setMessage('Enter the quiz code, your name, and your roll number.')
      return
    }
    if (trimmedCode.length < 4 || trimmedCode.length > 6) {
      setMessage('Quiz codes are 4 to 6 characters long.')
      return
    }

    setUser(null)
    setBusy(true)
    setMessage('Joining quiz...')
    try {
      const joined = await joinQuizPublic(trimmedCode, trimmedName, trimmedRollNumber)
      localStorage.setItem('quiz_token', joined.accessToken)
      setToken(joined.accessToken)
      setQuizId(joined.quizId)
      setJoinedTitle(joined.title)
      setMessage('')
      setMode('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not find that quiz. Please check the code.')
    } finally {
      setBusy(false)
    }
  }
  async function beginQuiz() { setBusy(true); setMessage(''); try { setAttempt(await startQuiz(token, quizId)); setActiveQuestion(0); setAnswers({}); setMode('attempt') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start quiz') } finally { setBusy(false) } }
  async function answer(question: AttemptQuestion, optionId: string) { setAnswers((current) => ({ ...current, [question.id]: optionId })); try { await saveAttemptAnswer(token, attempt!.id, question.id, { selectedOptionId: optionId }) } catch (error) { setMessage(error instanceof Error ? error.message : 'Answer could not be saved') } }
  async function textAnswer(question: AttemptQuestion, value: string) { setAnswers((current) => ({ ...current, [question.id]: value })); try { await saveAttemptAnswer(token, attempt!.id, question.id, { textAnswer: value }) } catch (error) { setMessage(error instanceof Error ? error.message : 'Answer could not be saved') } }
  async function submit() { if (!attempt) return; setBusy(true); setConfirmSubmit(false); setMessage('Submitting answers...'); try { const submitted = await submitAttempt(token, attempt.id); setResult({ id: submitted.resultId, title: submitted.status === 'EXPIRED' ? `${joinedTitle || 'Quiz completed'} - Time expired` : joinedTitle || 'Quiz completed', total_marks: submitted.totalMarks, obtained_marks: submitted.obtainedMarks, percentage: submitted.percentage, pass_status: submitted.percentage >= 50, evaluated_at: new Date().toISOString() }); setLeaderboard(await getLeaderboard(token, quizId)); setAttempt(null); setMessage(''); setMode('result') } catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong while submitting. Please try again.') } finally { setBusy(false) } }
  useEffect(() => { if (mode !== 'attempt' || !attempt) return; const hidden = () => { if (document.hidden) { setMessage('Warning: leaving the exam window has been detected.'); void recordExamEvent(token, attempt.id, 'TAB_HIDDEN') } else void recordExamEvent(token, attempt.id, 'WINDOW_FOCUS') }; const blurred = () => { setMessage('Warning: leaving the exam window has been detected.'); void recordExamEvent(token, attempt.id, 'WINDOW_BLUR') }; document.addEventListener('visibilitychange', hidden); window.addEventListener('blur', blurred); return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blurred) } }, [mode, attempt, token])
  async function copyCode() { if (!publishedCode) return; try { await navigator.clipboard.writeText(publishedCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setMessage('Copy failed. Select the code and copy it manually.') } }
  async function shareQuiz() { if (!publishedCode) return; const link = `${window.location.origin}/?quiz=${encodeURIComponent(publishedCode)}`; try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setMessage(link) } }
  async function saveQuiz(publish: boolean) {
    const trimmedTitle = quizTitle.trim()
    if (!trimmedTitle) {
      setMessage('Quiz title is required.')
      return
    }
    const validQuestions = questions.filter((question) => question.text.trim() || question.options.some((option) => option.trim()))
    if (!validQuestions.length) {
      setMessage('Add at least one question before saving the quiz.')
      return
    }

    setBusy(true)
    setMessage(publish ? 'Publishing quiz...' : 'Saving quiz...')
    try {
      const createdQuestions = []
      for (const question of validQuestions) {
        if (!question.text.trim()) throw new Error('Each question must include the question text.')
        if (question.type === 'MCQ' && question.options.length < 2) throw new Error('Each multiple-choice question needs at least two answer options.')
        const cleanedOptions = question.options.map((option) => option.trim())
        if (question.type === 'MCQ' && cleanedOptions.some((option) => !option)) throw new Error('Complete every answer option before saving.')
        if (question.type === 'MCQ' && (question.correct < 0 || question.correct >= cleanedOptions.length)) throw new Error('Select the correct answer for each question.')
        const options = question.type === 'MCQ' ? cleanedOptions.map((optionText, index) => ({ optionText, isCorrect: index === question.correct, displayOrder: index + 1 })) : []
        if ((question.type === 'FILL_BLANK' || question.type === 'TRUE_FALSE') && !question.expectedAnswer.trim()) throw new Error('Each text-based question needs an expected answer.')
        createdQuestions.push((await createQuestion(token, { questionText: question.text.trim(), questionType: question.type, expectedAnswer: question.expectedAnswer.trim() || undefined, marks: question.marks, options })).id)
      }
      const now = new Date()
      const created = await createQuiz(token, { title: trimmedTitle, instructions: quizInstructions.trim() || undefined, durationMinutes: quizDuration, passingMarks: validQuestions.reduce((sum, question) => sum + question.marks, 0) / 2, startAt: now.toISOString(), endAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), attemptLimit: 1, randomizeQuestions: false, questionIds: createdQuestions })
      setQuizId(created.id)
      setPublishedCode(created.joinCode ?? '')
      if (publish) await publishQuiz(token, created.id)
      setMessage(publish ? 'Quiz published. Share this code with students.' : 'Draft saved successfully.')
      setTeacherView('quizzes')
      await loadTeacherQuizzes()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong while saving the quiz. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  function signOut() {
    setToken('')
    setUser(null)
    setQuizId('')
    setJoinedTitle('')
    setJoinCode('')
    setStudentName('')
    setRollNumber('')
    setTeacherView('dashboard')
    localStorage.removeItem('quiz_token')
    setMode('home')
  }

  if (mode === 'teacher-login') return <AuthScreen busy={busy} message={message} initialEmail={emailAfterRegistration} onBack={() => setMode('home')} onLogin={teacherLogin} onRegister={() => { setMessage(''); setEmailAfterRegistration(''); setMode('teacher-register') }} onForgot={() => { setMessage(''); setMode('forgot-password') }} />
  if (mode === 'teacher-register') return <RegisterScreen busy={busy} message={message} onBack={() => setMode('teacher-login')} onCreated={(email) => { setEmailAfterRegistration(email); setMessage('Account created. Sign in to continue.'); setMode('teacher-login') }} />
  if (mode === 'forgot-password') return <ForgotPasswordScreen busy={busy} message={message} onBack={() => setMode('teacher-login')} />
  if (mode === 'join') return <JoinPage onJoin={joinQuiz} busy={busy} message={message} code={joinCode} name={studentName} rollNumber={rollNumber} setCode={setJoinCode} setName={setStudentName} setRollNumber={setRollNumber} />
  if (mode === 'ready') return <JoinReady name={studentName} title={joinedTitle} busy={busy} onStart={beginQuiz} onBack={() => setMode('join')} />
  if (mode === 'attempt' && attempt) return <AttemptView title={joinedTitle} attempt={attempt} active={activeQuestion} answers={answers} busy={busy} message={message} confirmSubmit={confirmSubmit} onAnswer={answer} onTextAnswer={textAnswer} onNext={() => setActiveQuestion((value) => value + 1)} onPrevious={() => setActiveQuestion((value) => value - 1)} onRequestSubmit={() => setConfirmSubmit(true)} onCancelSubmit={() => setConfirmSubmit(false)} onSubmit={submit} />
  if (mode === 'result' && result) return <ResultScreen result={result} leaderboard={leaderboard} onHome={signOut} />
  if (mode === 'teacher' && token && user) return <Layout eyebrow="Teacher workspace"><TeacherWorkspace view={teacherView} quizzes={quizzes} leaderboards={leaderboards} publishedCode={publishedCode} copied={copied} title={quizTitle} instructions={quizInstructions} duration={quizDuration} questions={questions} message={message} busy={busy} setView={setTeacherView} setTitle={setQuizTitle} setInstructions={setQuizInstructions} setDuration={setQuizDuration} setQuestions={setQuestions} onCopy={copyCode} onShare={shareQuiz} onSave={() => saveQuiz(false)} onPublish={() => saveQuiz(true)} onSignOut={signOut} /></Layout>
  return <Home onTeacher={() => setMode('teacher-login')} onStudent={() => setMode('join')} />
}

function Layout({ children, eyebrow = 'Classroom quiz platform' }: { children: ReactNode; eyebrow?: string }) { return <main className="quiz-app"><header className="quiz-header"><button className="brand" onClick={() => window.location.reload()}><span className="brand-mark"><Sparkles size={16} /></span>quiz<span>room</span></button><span className="header-note">{eyebrow}</span></header>{children}<InstallPrompt /></main> }
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('quizroom_install_dismissed') === 'true')
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)) return
    const handleInstallAvailable = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handleInstallAvailable)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallAvailable)
  }, [])
  if (!installEvent || dismissed) return null
  async function install() { await installEvent!.prompt(); const choice = await installEvent!.userChoice; if (choice.outcome === 'accepted') setInstallEvent(null) }
  function dismiss() { sessionStorage.setItem('quizroom_install_dismissed', 'true'); setDismissed(true) }
  return <aside className="install-prompt" role="status"><span className="install-prompt-icon"><Download size={17} /></span><div><strong>Add Quizroom to your home screen</strong><span>Open quizzes faster from your device.</span></div><button type="button" className="button button-primary small" onClick={() => void install()}>Install</button><button type="button" className="install-dismiss" onClick={dismiss} aria-label="Dismiss install suggestion"><X size={16} /></button></aside>
}
function Home({ onTeacher, onStudent }: { onTeacher: () => void; onStudent: () => void }) { return <Layout><section className="hero"><div className="hero-copy"><p className="eyebrow">A clearer way to check understanding</p><h1>Create. Share. <em>Quiz.</em></h1><p className="hero-subtitle">Teachers create quizzes and share a unique code. Students enter the code and their name to join.</p><div className="hero-actions"><button className="button button-primary" onClick={onTeacher}>Create a quiz <span>→</span></button><button className="button button-secondary" onClick={onStudent}>Join a quiz</button></div></div><div className="hero-stamp"><span>01</span><strong>One room.<br />Everyone learning.</strong><small>Fast setup · instant results</small></div></section></Layout> }
function AuthScreen({ onBack, onLogin, onRegister, onForgot, busy, message, initialEmail }: { onBack: () => void; onLogin: (email: string, password: string) => void; onRegister: () => void; onForgot: () => void; busy: boolean; message: string; initialEmail: string }) { const [email, setEmail] = useState(initialEmail); const [password, setPassword] = useState(''); return <Layout eyebrow="Sign in"><section className="auth-panel"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><p className="eyebrow">Sign in</p><h1>Welcome back.</h1><p>Sign in to create quizzes, share codes, and see results.</p><form onSubmit={(event) => { event.preventDefault(); onLogin(email, password) }}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teacher@school.edu" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label>{message && <p className="form-message" role="alert">{message}</p>}<button className="button button-primary" disabled={busy || !email.trim() || !password.trim()}>{busy ? 'Signing in...' : 'Sign in'}</button></form><div className="auth-links"><button type="button" className="back-link" onClick={onRegister}>Create account</button><button type="button" className="back-link" onClick={onForgot}>Forgot password?</button></div></section></Layout> }
function RegisterScreen({ onBack, onCreated, busy, message }: { onBack: () => void; onCreated: (email: string) => void; busy: boolean; message: string }) { const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); setError(''); if (password !== confirm) { setError('Passwords do not match.'); return } try { await registerTeacher(name, email, password, confirm); onCreated(email.trim().toLowerCase()) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to create account') } } return <Layout eyebrow="Create account"><section className="auth-panel"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><p className="eyebrow">Create account</p><h1>Set up your workspace.</h1><form onSubmit={submit}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label><label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} autoComplete="new-password" required /></label>{(error || message) && <p className="form-message" role="alert">{error || message}</p>}<button className="button button-primary" disabled={busy || !name.trim() || !email.trim() || password.length < 8 || !confirm}>{busy ? 'Creating...' : 'Create account'}</button></form></section></Layout> }
function ForgotPasswordScreen({ onBack, busy, message }: { onBack: () => void; busy: boolean; message: string }) { const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); async function request(event: FormEvent) { event.preventDefault(); setError(''); try { await requestPasswordReset(email); setSent(true) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to request reset') } } return <Layout eyebrow="Password recovery"><section className="auth-panel"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button><p className="eyebrow">Password recovery</p><h1>Reset your password.</h1>{!sent ? <form onSubmit={request}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{(error || message) && <p className="form-message" role="alert">{error || message}</p>}<button className="button button-primary" disabled={busy || !email.trim()}>Request reset</button></form> : <p className="form-message" role="status">If an account exists, reset instructions are available. Check your configured email channel.</p>}</section></Layout> }
function JoinPage({ onJoin, busy, message, code, name, rollNumber, setCode, setName, setRollNumber }: { onJoin: (event: FormEvent) => void; busy: boolean; message: string; code: string; name: string; rollNumber: string; setCode: (value: string) => void; setName: (value: string) => void; setRollNumber: (value: string) => void }) { return <Layout eyebrow="Student entry"><section className="join-panel"><p className="eyebrow">Student entry</p><h1>Join quiz</h1><p>Enter the code provided by your teacher and your exam identity.</p><form onSubmit={onJoin}><label>Quiz code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="A7K92P" maxLength={6} required /></label><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Faheed Rahim" required /></label><label>Roll number<input value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} placeholder="25CS101" required /></label>{message && <p className="form-message" role="alert">{message}</p>}<button className="button button-primary" disabled={busy || !code.trim() || !name.trim() || !rollNumber.trim()}>{busy ? 'Joining...' : 'Join quiz'} <span>→</span></button></form></section></Layout> }
function JoinReady({ name, title, busy, onStart, onBack }: { name: string; title: string; busy: boolean; onStart: () => void; onBack: () => void }) { return <Layout eyebrow="Quiz ready"><section className="ready-panel"><span className="success-icon"><Check size={22} /></span><p className="eyebrow">Join successful</p><h1>You’re in, {name.split(' ')[0]}.</h1><p>{title} is ready. Start when you are ready.</p><button className="button button-primary" onClick={onStart} disabled={busy}>Start quiz <span>→</span></button><button className="back-link centered" onClick={onBack}>Use another code</button></section></Layout> }
 function TeacherScreen({ quizzes, results, title, questions, message, busy, setTitle, setQuestions, onSave, onPublish, onSignOut }: { quizzes: QuizSummary[]; results: ResultSummary[]; title: string; questions: DraftQuestion[]; message: string; busy: boolean; setTitle: (value: string) => void; setQuestions: (value: DraftQuestion[]) => void; onSave: () => void; onPublish: () => void; onSignOut: () => void }) { return <Layout eyebrow="Teacher workspace"><section className="teacher-layout"><aside className="teacher-nav"><p className="eyebrow">Teacher workspace</p><h1>Make a room<br />for thinking.</h1><button className="nav-link active">Dashboard</button><button className="nav-link">My quizzes</button><button className="nav-link">Results</button><button className="nav-link" onClick={onSignOut}>Sign out</button></aside><div className="teacher-content"><div className="teacher-heading"><div><p className="eyebrow">Your classroom</p><h2>Build a quiz</h2></div><button className="button button-primary" onClick={onPublish} disabled={busy}><Sparkles size={16} /> Publish quiz</button></div><section className="editor"><label>Quiz title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Java Basics" /></label><div className="section-heading"><div><p className="eyebrow">Questions</p><h3>Add your questions</h3></div><button className="button button-secondary small" onClick={() => setQuestions([...questions, emptyQuestion()])}><Plus size={15} /> Add question</button></div>{questions.map((question, index) => <QuestionEditor key={index} index={index} question={question} onChange={(next) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? next : item))} onDelete={() => setQuestions(questions.filter((_, itemIndex) => itemIndex !== index))} />)}{message && <p className="form-message">{message}</p>}<button className="button button-quiet" onClick={onSave} disabled={busy}>Save draft</button></section><section className="quiz-list"><div className="section-heading"><div><p className="eyebrow">Your quizzes</p><h3>Published rooms</h3></div><span>{quizzes.length} total</span></div>{quizzes.length ? quizzes.map((quiz) => <article className="quiz-list-item" key={quiz.id}><div><strong>{quiz.title}</strong><span>{quiz.total_marks} marks · {quiz.status}</span></div><b>{quiz.join_code ?? 'No code'}</b></article>) : <p className="empty">No quizzes yet. Create your first room above.</p>}</section><section className="quiz-list"><div className="section-heading"><div><p className="eyebrow">Results</p><h3>Student submissions</h3></div><span>{results.length} total</span></div>{results.length ? results.map((item) => <article className="quiz-list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.student_name ? `Submitted by ${item.student_name}` : 'Submitted result'}</span></div><b>{item.obtained_marks}/{item.total_marks} · {item.percentage}%</b></article>) : <p className="empty">No student submissions yet.</p>}</section></div></section></Layout> }
function QuestionEditor({ index, question, onChange, onDelete }: { index: number; question: DraftQuestion; onChange: (question: DraftQuestion) => void; onDelete: () => void }) { return <article className="question-editor"><div className="question-top"><strong>Question {index + 1}</strong><button className="icon-button" onClick={onDelete} aria-label={`Delete question ${index + 1}`}><Trash2 size={16} /></button></div><input value={question.text} onChange={(event) => onChange({ ...question, text: event.target.value })} placeholder="What is Java?" />{question.options.map((option, optionIndex) => <div className="option-row" key={optionIndex}><input type="radio" name={`correct-${index}`} checked={question.correct === optionIndex} onChange={() => onChange({ ...question, correct: optionIndex })} /><input value={option} onChange={(event) => onChange({ ...question, options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} /></div>)}<label className="marks-field">Marks<input type="number" min="1" value={question.marks} onChange={(event) => onChange({ ...question, marks: Number(event.target.value) })} /></label></article> }
function AttemptScreen({ attempt, active, answers, busy, message, onAnswer, onNext, onPrevious, onSubmit }: { attempt: QuizAttempt; active: number; answers: Record<string, string>; busy: boolean; message: string; onAnswer: (question: AttemptQuestion, optionId: string) => void; onNext: () => void; onPrevious: () => void; onSubmit: () => void }) { const question = attempt.questions[active]; const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 60000)); return <Layout eyebrow="Quiz in progress"><section className="attempt-panel"><div className="attempt-meta"><span>Question {active + 1} of {attempt.questions.length}</span><span><Clock3 size={15} /> {remaining} min remaining</span></div><div className="progress"><i style={{ width: `${((active + 1) / attempt.questions.length) * 100}%` }} /></div><h1>{question.text}</h1><div className="attempt-options">{question.options.map((option) => <label key={option.id} className={answers[question.id] === option.id ? 'selected' : ''}><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => onAnswer(question, option.id)} />{option.text}</label>)}</div>{message && <p className="form-message">{message}</p>}<div className="attempt-actions"><button className="button button-secondary" onClick={onPrevious} disabled={active === 0}>Previous</button>{active === attempt.questions.length - 1 ? <button className="button button-primary" onClick={onSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit quiz'}</button> : <button className="button button-primary" onClick={onNext}>Next <span>→</span></button>}</div></section></Layout> }
function ResultScreen({ result, leaderboard, onHome }: { result: ResultSummary; leaderboard: LeaderboardRow[]; onHome: () => void }) { return <Layout eyebrow="Result"><section className="result-panel"><span className="success-icon"><Check size={22} /></span><p className="eyebrow">Result recorded</p><h1>{result.title}</h1><div className="score"><strong>{result.obtained_marks} / {result.total_marks}</strong><span>{result.percentage}%</span></div><p>Your responses were saved and scored by the server.</p><div className="student-leaderboard"><div className="section-heading"><div><p className="eyebrow">Class ranking</p><h2>Leaderboard</h2></div><span>{leaderboard.length} ranked</span></div>{leaderboard.length ? leaderboard.slice(0, 10).map((row) => <div className="leaderboard-row" key={`${row.rank}-${row.name}`}><b>#{row.rank}</b><strong>{row.name}</strong><span>{row.obtained_marks}/{row.total_marks}</span><em>{row.percentage}%</em></div>) : <p className="muted-copy">Leaderboard results will appear after submissions are recorded.</p>}</div><button className="button button-primary" onClick={onHome}>Back home</button></section></Layout> }
void TeacherScreen
void AttemptScreen
