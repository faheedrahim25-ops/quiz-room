# Mentor360 Implementation Plan

1. Foundation: repository, env validation, frontend shell, API health, logging, CI.
2. Database: migrations, seed command, repositories, transaction helpers.
3. Identity: users, roles, Argon2id, JWT, refresh rotation, reset architecture.
4. Academic: departments, programs, academic years, semesters, subjects, topics.
5. People: students, faculty, profiles, admin management.
6. Assignments: active ownership, reassignment history, scoped queries.
7. Questions: CRUD, validation, option rules, archive, preview.
8. Quizzes: wizard APIs, snapshots, lifecycle, assignment and notifications.
9. Attempts: server timing, autosave, navigation state, submission lock, scoring.
10. Evaluation/results: pending review, bounded marking, publication, audit.
11. Analytics: role-scoped aggregates, topic trends, reports and exports.
12. Feedback/meetings: CRUD, intended visibility, reminders.
13. Announcements/notifications: targeting, read/archive, delivery abstraction.
14. Frontend integration: replace dashboard fixtures with TanStack Query APIs; add role routes and all required pages.
15. Verification: unit/integration/E2E/security/accessibility/performance audits.
16. Deployment: migration runbook, health checks, graceful shutdown, TLS/reverse proxy, monitoring, backup/restore.

## Completed Foundation Slices

- Foundation: Vite React dashboard shell, Express API, validated environment, security middleware, health endpoint.
- Database: normalized initial migration plus refresh-session migration.
- Authentication: Argon2id password verification, JWT access tokens, rotated/revoked server-side refresh sessions, login/refresh/logout/me routes.
- Authorization: bearer middleware, role middleware, and ownership-scoped student list/profile routes for admin, mentor, and student identities.
- Assessment foundation: question-bank listing/creation/archive, quiz creation with immutable question snapshots, role-scoped quiz listing, and publish validation.
- Attempt engine: server-timed student start, sanitized question payloads, ownership-checked autosave, expiry enforcement, duplicate-submit protection, objective scoring, and provisional/final result creation.
- Evaluation and feedback: scoped result reads, mentor-only short-answer review, bounded marks, final result recalculation, and student feedback create/read APIs.
- Operations: ownership-scoped meetings, per-user notifications, admin announcements, overview reports, and quiz participation reports.
- Frontend integration milestone: login screen, API client, access-token storage, authenticated mentor dashboard gate, and API-backed KPI cards.
- Data-backed dashboard: mentor KPI aggregates and assigned-student rows with latest evaluated scores and an explicit empty state.
- Live dashboard collections: quizzes, meetings, and notifications now load from authenticated APIs with unread and empty states.
- Interactive mentor navigation: Overview remains the dashboard, while quizzes, meetings, notifications, mentees, question bank, and feedback render focused workspace views.
- Quiz delivery: published quizzes can be assigned to selected active mentees with server-side ownership checks, duplicate-safe inserts, and assignment notifications.
- Quiz builder: mentor UI loads the question bank, supports question selection and quiz settings, and saves server-validated draft quizzes.
- Quiz delivery UI: mentors can select mentees, publish a saved draft, assign it, and receive the server-reported assignment count.
- Student attempt UI: student-role routing, assigned quiz list, server-timed attempt screen, autosaved answers, navigation, submission, and result state.
- Student history foundation: `/auth/me` session restoration and role-scoped `/results` history API wired into the student dashboard summary.
- Student result history UI: recent evaluated results with dates and percentage summaries.
- Mentor evaluation UI: pending-answer queue, answer review, bounded marks, feedback entry, and finalization through protected APIs.
- Admin foundation: role-aware admin navigation plus transactional mentor assignment list, assign/reassign, and end-assignment APIs with preserved history.
- Admin workspace UI: live student directory and mentor-assignment history panels backed by authenticated APIs.
- Admin operations UI: report metrics, published announcements, and protected audit-log viewing backed by authenticated APIs.
- Assignment creation UI: active mentor/student selectors, protected assignment submission, success/error feedback, and preserved assignment history.
- Security hardening: configurable API rate limiting with stricter authentication limits and environment validation.
- Verification: frontend/backend builds and backend scoring tests pass.

Each remaining phase is complete only when its UI/API/database/validation/authorization/error handling/tests are integrated and the previous phase remains green.
