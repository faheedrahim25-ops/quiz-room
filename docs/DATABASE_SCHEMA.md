# Mentor360 Database Schema

PostgreSQL uses UUID primary keys, UTC `timestamptz`, enums/check constraints, foreign keys, partial unique indexes, and migration files. The authoritative implementation is `backend/migrations/001_initial.sql`.

## Relationships

`users -> user_roles -> roles`; users optionally become one student or faculty record. Faculty and students connect through historical `mentor_assignments`, with one active assignment per student. Departments contain programs and subjects; subjects contain topics. Questions contain options; quizzes contain immutable question snapshots. Quizzes assign to students, who create attempts and answers; attempts produce server-generated results. Faculty create feedback and meetings for students. Notifications target users; announcements target audiences; audit logs record actor and entity.

## Important Constraints

Emails, registration numbers, employee IDs, codes, and scoped names are unique. Assignment history is retained; a partial unique index prevents two active assignments for one student. Quiz windows and meeting windows require end after start. Marks are positive and passing marks cannot exceed total marks. Result and answer tables are not writable by students. Correct options are only queried by scoring services, never active-attempt serializers.

## Migration Policy

Migrations are append-only and run in order in CI/deployment. No undocumented manual database changes are allowed. Destructive changes require a backup, compatibility migration, and rollback plan. Seed data is development-only and must use a separate command.
