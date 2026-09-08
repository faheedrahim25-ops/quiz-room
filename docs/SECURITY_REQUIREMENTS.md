# Mentor360 Security Requirements

Use Argon2id for passwords, short-lived JWT access tokens, secure httpOnly same-site refresh cookies, server-side hashed refresh sessions, rotation and revocation. Keep secrets in environment/secret manager only. Never log credentials, tokens, hashes, or database URLs.

Enforce authentication, role checks, and resource ownership in middleware/services. Derive student and mentor identities from authenticated records; never trust client role, marks, score, student ID, mentor ID, quiz ownership, or timer. Use parameterized queries, Zod input validation, output serializers that omit answer keys, Helmet, strict CORS, CSRF protection appropriate to cookie strategy, body limits, and rate limits for login/reset/refresh/mutations.

Use generic login/reset errors, account status checks, transaction locks for submission and assignment, immutable audit records for security-sensitive actions, structured request IDs, dependency scanning, TLS in deployment, backups, retention policy, and incident response documentation.

Security tests must cover IDOR for every student resource, cross-mentor quiz mutation, role escalation, refresh replay, expired attempts, malformed IDs, SQL injection payloads, XSS strings, CSRF, rate limiting, and secret redaction.
