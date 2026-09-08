export type Role = 'ADMIN' | 'MENTOR' | 'STUDENT'
export type ApiSuccess<T> = { success: true; data: T; message: string }
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } }
