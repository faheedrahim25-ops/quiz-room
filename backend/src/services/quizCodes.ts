const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateQuizCode() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function isValidQuizCode(value: string) {
  return /^[A-Z0-9]{6}$/.test(value)
}
