export type ObjectiveAnswer = { selectedOptionId: string | null; correctOptionId: string | null; marks: number }
export function scoreObjectiveAnswers(answers: ObjectiveAnswer[]) { return answers.reduce((total, answer) => total + (answer.selectedOptionId && answer.selectedOptionId === answer.correctOptionId ? answer.marks : 0), 0) }
export function calculatePercentage(obtainedMarks: number, totalMarks: number) { return totalMarks === 0 ? 0 : Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) }
