# Mentor360 Testing Strategy

## Unit

Test Zod schemas, score calculations, quiz transitions, time-window calculations, ownership predicates, pagination, and notification deduplication. Tests run in CI without production services.

## Integration

Run against an isolated PostgreSQL database and migration set. Cover login/refresh/logout, user and academic CRUD, assignment transaction/history, question snapshots, quiz publish/assign, attempt timing/autosave/submit, objective scoring, short-answer review, results, feedback, meetings, notifications, reports, and audit events.

## E2E

Admin creates mentor/student and assignment -> mentor creates questions and quiz -> assigns/publishes -> student starts and answers -> submits -> automatic result -> mentor evaluates short answer -> feedback -> student views result and analytics.

## Edge and Security

Expired/not-started/closed quizzes, attempt limits, refresh, network retry, double submit, concurrent submissions, inactive users, reassignment, deleted source question, invalid IDs, malformed bodies, unauthorized resources, XSS/SQLi, CSRF, rate limits, responsive breakpoints, keyboard-only navigation, and screen-reader labels.

Definition of test completion: unit, integration, E2E, authorization, migration, frontend build, backend build, and accessibility smoke checks pass with no known critical findings.
