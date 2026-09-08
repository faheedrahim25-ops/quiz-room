import { describe, expect, it } from 'vitest'
import { generateQuizCode, isValidQuizCode } from './quizCodes.js'

describe('quiz code utilities', () => {
  it('creates a valid classroom code with uppercase letters and digits', () => {
    const code = generateQuizCode()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    expect(isValidQuizCode(code)).toBe(true)
  })

  it('rejects invalid codes', () => {
    expect(isValidQuizCode('abc')).toBe(false)
    expect(isValidQuizCode('ABCD-123')).toBe(false)
  })
})
