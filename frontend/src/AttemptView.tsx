import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, X } from 'lucide-react'
import type { AttemptQuestion, QuizAttempt } from './api/client'
import './interaction.css'

type Props = {
  title: string
  attempt: QuizAttempt
  active: number
  answers: Record<string, string>
  busy: boolean
  message: string
  confirmSubmit: boolean
  onAnswer: (question: AttemptQuestion, optionId: string) => void
  onTextAnswer?: (question: AttemptQuestion, value: string) => void
  onNext: () => void
  onPrevious: () => void
  onRequestSubmit: () => void
  onCancelSubmit: () => void
  onSubmit: () => void
}

export function AttemptView({ title, attempt, active, answers, busy, message, confirmSubmit, onAnswer, onTextAnswer, onNext, onPrevious, onRequestSubmit, onCancelSubmit, onSubmit }: Props) {
  const submitted = useRef(false)
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)))

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(timer)
  }, [attempt.expiresAt])

  useEffect(() => {
    if (seconds === 0 && !submitted.current && !busy) {
      submitted.current = true
      onSubmit()
    }
  }, [seconds, busy, onSubmit])

  const question = attempt.questions[active]
  const answeredCount = Object.keys(answers).length
  const remaining = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  return <main className="quiz-app">
    <header className="quiz-header"><strong className="brand">quiz<span>room</span></strong><span className="header-note">Quiz in progress</span></header>
    <section className="attempt-panel">
      <p className="eyebrow attempt-title">{title}</p>
      <div className="attempt-meta"><span>Question {active + 1} of {attempt.questions.length}</span><span aria-label="Time remaining"><Clock3 size={15} /> {remaining}</span></div>
      <div className="progress"><i style={{ width: `${((active + 1) / attempt.questions.length) * 100}%` }} /></div>
      <h1>{question.text}</h1>
      <div className="attempt-options">
        {question.options.length ? question.options.map((option) => <label key={option.id} className={answers[question.id] === option.id ? 'selected' : ''}><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => onAnswer(question, option.id)} />{option.text}</label>) : <label>Answer<textarea value={answers[question.id] ?? ''} onChange={(event) => onTextAnswer?.(question, event.target.value)} rows={question.type === 'SHORT_ANSWER' ? 6 : 2} /></label>}
      </div>
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="attempt-actions"><button type="button" className="button button-secondary" onClick={onPrevious} disabled={active === 0}>Previous</button>{active === attempt.questions.length - 1 ? <button type="button" className="button button-primary" onClick={onRequestSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit quiz'}</button> : <button type="button" className="button button-primary" onClick={onNext}>Next <span>→</span></button>}</div>
    </section>
    {confirmSubmit && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title"><button type="button" className="icon-button modal-close" onClick={onCancelSubmit} aria-label="Cancel submission"><X size={18} /></button><Check size={22} className="modal-icon" /><p className="eyebrow">Ready to finish?</p><h2 id="submit-title">Submit quiz?</h2><p>You have answered {answeredCount} of {attempt.questions.length} questions.</p><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancelSubmit}>Keep working</button><button type="button" className="button button-primary" onClick={onSubmit}>Submit now</button></div></section></div>}
  </main>
}
