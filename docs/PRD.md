# Mentor360 Product Requirements Document

**Working name:** Mentor360  
**Subtitle:** College Mentor-Mentee Management and Assessment Platform  
**Status:** Planning baseline  
**Version:** 1.0

## 1. Executive Summary

Mentor360 is a standalone, multi-role web platform for colleges to manage faculty mentor relationships, student progress, assessments, feedback, and meetings in one secure system. Administrators maintain the academic and user structure; mentors manage their assigned mentees and assessments; students access only their own academic and mentoring information.

The product replaces spreadsheets, paper records, disconnected quiz tools, and informal feedback with auditable workflows and server-enforced access control. The MVP is designed for one college tenant, with a tenant boundary retained in the model so multi-tenant deployment can be added later without changing ownership rules.

## 2. Problem Statement

Colleges often lack a reliable source of truth for mentor assignments, student support history, assessment results, and follow-up actions. Manual processes make it difficult to know who owns a student, whether a quiz was completed, which topics need help, and whether mentor meetings produced actionable follow-up. They also create privacy risk when spreadsheets or exports are shared broadly.

Mentor360 addresses this with controlled records, reusable questions, server-authoritative quiz attempts, performance views, feedback, meetings, notifications, reports, and audit history.

## 3. Vision and Goals

**Vision:** Make every student’s academic mentoring relationship visible, structured, and actionable while preserving student privacy.

Goals:
1. Centralize active and historical mentor assignments.
2. Give mentors a focused view of assigned students and their progress.
3. Provide reusable question-bank and quiz workflows.
4. Automate objective scoring and support mentor review of short answers.
5. Give students understandable progress history and feedback.
6. Record meetings, notes, and action items.
7. Give administrators system-wide oversight without weakening least privilege.
8. Produce auditable, responsive, accessible experiences.
9. Support scale through pagination, indexing, background notifications, and modular services.
10. Keep all sensitive decisions server-side.

## 4. Non-Goals

The MVP is not a full ERP, LMS, attendance system, payment system, hostel or transport system, payroll system, library system, video-conferencing platform, admissions system, or AI grading system. It does not provide public student rankings. Integrations, advanced SSO, email/SMS delivery, and additional question types are extension points unless explicitly included in the implementation plan.

## 5. Personas

### Admin
- **Responsibilities:** maintain users, academic structure, assignments, announcements, reports, settings, and audit oversight.
- **Goals:** accurate records, safe access, fast intervention, institution-wide visibility.
- **Pain points:** stale spreadsheets, duplicate records, unclear ownership, manual reports.
- **Primary workflows:** import/create users, configure academic periods, assign or reassign mentors, investigate activity, export reports.
- **Permissions:** system-wide administration subject to audit and configuration constraints.

### Mentor / Faculty
- **Responsibilities:** support assigned students, create assessments, evaluate answers, record feedback and meetings.
- **Goals:** quickly identify needs, reduce administrative work, measure improvement.
- **Pain points:** fragmented student history, manual marking, missed follow-ups.
- **Primary workflows:** review mentees, create and publish quizzes, monitor attempts, evaluate short answers, schedule meetings.
- **Permissions:** assigned students and owned content only; no cross-mentor access.

### Student / Mentee
- **Responsibilities:** complete assigned assessments, read feedback, attend meetings, act on improvement suggestions.
- **Goals:** understand progress, complete work reliably, communicate with mentor.
- **Pain points:** unclear deadlines, scattered feedback, limited visibility into progress.
- **Primary workflows:** view dashboard, open quiz, attempt and submit, read result and feedback, view meetings.
- **Permissions:** own profile, assignments, attempts, results, feedback, meetings, and announcements only.

## 6. MVP Scope

### Included
- Password authentication, logout, password reset, access-token and refresh-token sessions.
- Admin, mentor, and student roles with server-side authorization.
- User, student, faculty, department, program, academic year, and semester management.
- Historical mentor assignment with one active assignment per student.
- Question bank for MCQ, true/false, and short answer.
- Quiz draft, schedule, publish, assign, attempt, auto-score, short-answer review, result, and archive lifecycle.
- Performance summaries and topic trends without public rankings.
- Feedback, meetings, notifications, announcements, reports, and audit logs.
- Responsive accessible web UI and documented REST API.

### Deferred
- Multiple colleges/tenants in one deployment, SSO, mobile native apps, real-time chat, external LMS integration, proctoring, AI marking, email/SMS providers, bulk CSV import, and advanced custom permission administration.

## 7. Roles and Permission Summary

| Capability | Admin | Mentor | Student |
|---|---:|---:|---:|
| Manage users/academic structure | Yes | No | No |
| Manage student/faculty records | Yes | Read assigned students | Own profile read |
| Assign/reassign mentors | Yes | No | No |
| Create/manage own questions | Yes | Yes | No |
| Create/manage quizzes | Yes | Own quizzes | No |
| Assign quizzes | Yes | Assigned mentees only | No |
| Attempt assigned quizzes | No | No | Yes |
| Evaluate short answers | Yes | Assigned students only | No |
| View results/analytics | Institution | Assigned students | Own only |
| Create feedback/meetings | Yes | Assigned students | No |
| Manage announcements | Yes | No | Read |
| Audit logs/reports/settings | Yes | Limited reports | No |

Every read and write is additionally checked for resource ownership, status, and effective dates.

## 8. Core User Stories

- As an admin, I want to assign a student to a mentor with an effective date so that ownership is explicit and historical changes remain traceable.
- As an admin, I want to reassign a student without deleting the old assignment so that reports remain accurate.
- As a mentor, I want to filter my mentees by performance and status so that I can prioritize support.
- As a mentor, I want to create reusable questions and quizzes so that assessment preparation is efficient.
- As a mentor, I want to assign a published quiz to all or selected mentees so that only intended students receive it.
- As a mentor, I want to review short answers and leave feedback so that mixed-format assessments are complete.
- As a student, I want to see my mentor and upcoming work so that I know what to do next.
- As a student, I want the quiz timer and score to be enforced by the server so that results are trustworthy.
- As a student, I want to view my history and topic trends so that I can improve without being publicly ranked.
- As an admin, I want reports and audit logs so that institutional decisions are evidence-based.

## 9. Functional Requirements

Each requirement uses the format: **ID | Actor | Preconditions | Main behavior | Alternatives/errors | Acceptance**.

### Authentication and identity
- **AUTH-01 | All users | Active account exists | User submits valid credentials; API creates a short-lived JWT access token and server-side refresh-token record. | Invalid credentials return 401 without revealing which field failed; locked/inactive accounts cannot sign in. | Access token authorizes permitted requests; password is never returned.**
- **AUTH-02 | All users | Active session | User logs out; refresh token is revoked and current session ends. | Repeated logout is idempotent. | Revoked token cannot refresh.**
- **AUTH-03 | All users | Registered email | User requests reset; a single-use expiring token is sent through configured delivery. | Unknown email returns a generic response; expired/reused token fails. | New password is Argon2id-hashed and prior sessions are revocable.**
- **AUTH-04 | All users | Access token expired | Client uses refresh token; server rotates it and revokes the old token. | Reuse or revoked token returns 401 and can revoke the token family. | New access token works; old refresh token does not.**

### Administration and academic structure
- **ADMIN-01 | Admin | Admin authenticated | Create, update, deactivate users, students, faculty, departments, programs, academic years, and semesters with validated unique identifiers. | Conflicts return 409; records referenced by history are deactivated rather than deleted. | Changes are audited.**
- **ADMIN-02 | Admin | Student and mentor active | Select one or more students and create active assignments with effective dates. | Student with overlapping active assignment is rejected; invalid mentor/student status is rejected. | Assignment and audit record exist.**
- **ADMIN-03 | Admin | Existing assignment | Close current assignment and create replacement in one transaction. | Failure rolls back both changes. | History preserves actor, dates, and status.**

### Mentor operations
- **MENTOR-01 | Mentor | Assigned student | List, search, filter, and open assigned mentee data. | Unassigned ID returns 403 or an indistinguishable 404 per API policy. | No unrelated student data is returned.**
- **MENTOR-02 | Mentor | Mentor authenticated | Create/edit/archive own question-bank questions and options. | Published quiz snapshots remain unchanged when source question changes. | Valid question types enforce their option rules.**
- **MENTOR-03 | Mentor | Draft quiz | Create quiz, attach questions with mark snapshots, configure schedule/settings, preview, save draft, assign, and publish. | Invalid dates, marks, missing options, or empty quiz block publish. | Published quiz is immutable in result-affecting fields once an attempt exists.**
- **MENTOR-04 | Mentor | Assigned quiz has attempts | View participation/results and evaluate pending short answers. | Marks outside question limits or evaluation of unrelated student is rejected. | Result recalculates server-side and evaluation is audited.**
- **MENTOR-05 | Mentor | Assigned student | Create feedback and schedule/update meetings. | Overlapping or ended meeting rules are validated; unauthorized student is rejected. | Student receives notification and can view permitted content.**

### Student operations
- **STUDENT-01 | Student | Authenticated | View own dashboard, mentor, announcements, upcoming quizzes, meetings, and notifications. | Missing mentor or empty lists show explicit empty states. | No other student identifier or analytics is exposed.**
- **STUDENT-02 | Student | Assigned quiz is available | View sanitized instructions, start attempt, navigate questions, autosave answers, and submit. | Before/after window, attempt limit, duplicate submission, and invalid answer are rejected. | Correct answers are never sent to the client.**
- **STUDENT-03 | Student | Submitted/evaluated attempt | View result only when policy permits publication. | Pending short-answer evaluation shows pending state; prohibited review hides answer key. | Score is read-only and server-generated.**

### Analytics, notifications, reports, audit
- **PLAT-01 | Admin/Mentor/Student | Authorized data | System calculates role-specific score, completion, pass, topic, and trend summaries. | No-data periods return empty chart state, not fake zeros. | Aggregates match source records and respect ownership.**
- **PLAT-02 | System | Trigger event | System creates an in-app notification with read/archive state and reference. | Duplicate delivery is prevented by idempotency key. | Recipient can mark it read without changing source data.**
- **PLAT-03 | Admin/Mentor | Authorized report | System returns paginated/filterable report data and export-safe fields. | Large requests are bounded; unauthorized report returns 403. | Report results match current permissions and filters.**
- **PLAT-04 | Admin | Authenticated | View immutable audit events with filters. | Secrets are redacted; ordinary users cannot access logs. | Security-relevant mutations have an actor and timestamp.**

## 10. Quiz Rules

- A quiz moves `DRAFT -> SCHEDULED -> PUBLISHED/ACTIVE -> CLOSED -> ARCHIVED`; invalid transitions are rejected.
- `start_at` and `end_at` are UTC instants; availability is calculated by the server.
- An attempt receives a server-calculated `expires_at` equal to the earlier of duration expiry and quiz end time.
- MCQ and true/false are scored automatically. Short answer remains `PENDING_REVIEW` until a permitted evaluator finalizes it.
- Attempt and answer writes are idempotent where practical. Submission is a transaction that locks the attempt, rejects duplicates, scores objective answers, and creates/updates the result.
- Quiz question text, type, and marks are snapshotted into the quiz-question record or immutable revision so later edits cannot change historical scores.

## 11. Non-Functional Requirements

- **Security:** OWASP-aligned validation, Argon2id, JWT access tokens, rotated server-side refresh tokens, RBAC and ownership checks, rate limiting, secure headers, redacted logs, and audit events.
- **Performance:** p95 read API under 500 ms for normal paginated requests; p95 write API under 800 ms excluding external delivery; no unbounded list endpoints.
- **Availability:** graceful loading/error states; database transactions for critical workflows; health/readiness endpoints.
- **Accessibility:** semantic HTML, keyboard support, visible focus, labels, contrast, accessible dialogs/tables/charts, and non-color status cues.
- **Scalability:** PostgreSQL indexes, connection pooling, background notification jobs, code splitting, and stateless API nodes.
- **Privacy:** least privilege, minimal personal data, retention and export/deletion policies defined by institution configuration.

## 12. Success Metrics

- 100% of active students have at most one active mentor assignment.
- 90% of mentor assignment changes are completed without spreadsheet intervention.
- 80% of objective quiz submissions are scored automatically within one minute.
- 95% of authorized resource requests pass ownership tests in automated security suites.
- Mentor dashboard p95 load is under 2 seconds on seeded MVP data.
- All critical mutations have an audit event.

## 13. Open Decisions Before Build

1. Institution retention period and legal/privacy policy.
2. Email/SMS provider and delivery templates.
3. Whether students may review correct answers after quiz close, configurable per quiz.
4. Time zone display policy for colleges spanning regions.
5. Bulk import format and SSO provider for post-MVP.

## 14. Release Gate

The MVP is ready for implementation only when the open decisions are approved, documents in `docs/` agree on identifiers and lifecycle states, security tests cover ownership boundaries, and the acceptance criteria are signed off.
