const baseUrl = (process.env.SMOKE_BASE_URL ?? `http://localhost:${process.env.PORT ?? '4000'}/api/v1`).replace(/\/$/, '')
const email = process.env.SMOKE_EMAIL ?? 'admin@college.edu'
const password = process.env.SMOKE_PASSWORD ?? 'Admin@123'

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  const body = await response.json() as { success: boolean; data: T; error?: { message?: string } }
  if (!response.ok || !body.success) throw new Error(`${path}: ${body.error?.message ?? `HTTP ${response.status}`}`)
  return body.data
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const health = await request<{ status: string; database: string }>('/health')
  check(health.status === 'ok' && health.database === 'ok', 'Health check did not report an available database')

  const session = await request<{ user: { email: string }; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  check(Boolean(session.accessToken), 'Login did not return an access token')
  check(session.user.email.toLowerCase() === email.toLowerCase(), 'Login returned an unexpected user')

  const authenticatedHeaders = { Authorization: `Bearer ${session.accessToken}` }
  const currentUser = await request<{ email: string }>('/auth/me', { headers: authenticatedHeaders })
  check(currentUser.email.toLowerCase() === email.toLowerCase(), 'Authenticated user lookup failed')

  const quizzes = await request<unknown[]>('/quizzes', { headers: authenticatedHeaders })
  const results = await request<unknown[]>('/results', { headers: authenticatedHeaders })
  console.log(`SMOKE PASS: health, login, auth/me, quizzes (${quizzes.length}), results (${results.length})`)
}

main().catch((error) => {
  console.error(`SMOKE FAIL: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})