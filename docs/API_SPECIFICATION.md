# Mentor360 API Specification

Base path: `/api/v1`. Success: `{ success: true, data, message }`. Error: `{ success: false, error: { code, message, details? } }`. List endpoints return `{ items, page, pageSize, total }`.

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Validate credentials and create session |
| POST | `/auth/logout` | Authenticated | Revoke refresh session |
| POST | `/auth/refresh` | Refresh cookie | Rotate session and access token |
| GET | `/auth/me` | Authenticated | Current sanitized user |
| GET/POST/PATCH | `/students`, `/students/:id` | Admin; mentor assigned read | Student management/profile |
| GET | `/mentors`, `/mentors/:id/mentees` | Admin; mentor own | Faculty and mentees |
| POST/PATCH | `/mentor-assignments` | Admin | Assign/reassign with history |
| GET/POST/PATCH | `/questions`, `/questions/:id` | Admin/mentor owner | Question bank |
| GET/POST/PATCH | `/quizzes`, `/quizzes/:id` | Admin/mentor owner | Quiz lifecycle |
| POST | `/quizzes/:id/publish` | Admin/mentor owner | Validate and publish |
| POST | `/quizzes/:id/assign` | Admin/mentor owner | Assign all/selected permitted students |
| POST | `/quizzes/:id/start` | Student assigned | Create server-timed attempt |
| PUT | `/attempts/:id/answers/:questionId` | Attempt owner | Save sanitized answer |
| POST | `/attempts/:id/submit` | Attempt owner | Lock, score, result transaction |
| GET | `/results/:id` | Student own; mentor assigned; admin | Read result by policy |
| POST/GET | `/feedback`, `/students/:id/feedback` | Mentor assigned; admin; student own read | Feedback |
| POST/GET/PATCH | `/meetings`, `/meetings/:id` | Mentor assigned; admin; student own read | Meeting lifecycle |
| GET/PATCH | `/notifications` | Own user | Read/mark/archive notifications |
| CRUD | `/announcements` | Admin write; audience read | Announcements |
| GET | `/reports` | Admin; mentor scoped | Paginated analytics |
| GET | `/audit-logs` | Admin | Filtered immutable audit events |
| GET | `/health` | Public | Liveness |

Every protected request validates authentication, role, resource ownership, operation, entity status, and effective assignment. Invalid bodies return 422; missing auth 401; ownership 403; missing resource 404; conflicts 409; rate limits 429.
