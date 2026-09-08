# Mentor360 Acceptance Criteria

- **Authentication:** valid users can log in; passwords use Argon2id; logout revokes refresh sessions; refresh rotation rejects replay.
- **Assignment:** an admin can assign and reassign a student; active ownership is unique; history retains actor and effective dates.
- **Ownership:** a student requesting another student's profile, result, feedback, meeting, attempt, or analytics receives 403/404 without data leakage. A mentor cannot access another mentor's mentees or quizzes.
- **Question bank:** valid MCQ, true/false, and short-answer records save; invalid option/mark rules are rejected; source edits do not alter quiz snapshots.
- **Quiz lifecycle:** a mentor can draft, configure, preview, assign, publish, close, and archive; invalid transitions and invalid windows fail.
- **Attempt:** only assigned students can start; server sets start/expiry; answer keys never appear in active payloads; autosave is ownership-checked; duplicate submission is prevented transactionally.
- **Evaluation:** objective questions score automatically; short answers remain pending; authorized mentors can award bounded marks and publish a final result with audit event.
- **Analytics:** role-scoped history, completion, pass rate, topic trends, and improvement data match stored results; no public ranking is exposed.
- **Feedback/meetings:** authorized mentors can create records; students can read intended content only; notifications are generated and can be read/archived.
- **UI quality:** each major screen has loading, empty, error, success, responsive, keyboard, focus, and accessible-label behavior.
