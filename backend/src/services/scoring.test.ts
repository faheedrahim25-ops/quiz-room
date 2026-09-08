import { describe, expect, it } from 'vitest'
import { calculatePercentage, scoreObjectiveAnswers } from './scoring.js'

describe('quiz scoring', () => {
  it('scores only matching objective answers', () => expect(scoreObjectiveAnswers([{ selectedOptionId: 'a', correctOptionId: 'a', marks: 2 }, { selectedOptionId: 'b', correctOptionId: 'a', marks: 3 }])).toBe(2))
  it('avoids division by zero', () => expect(calculatePercentage(0, 0)).toBe(0))
})
