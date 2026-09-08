# Mentor360 Application Flow

## Authentication

Login -> server validates credentials -> access token in memory and refresh token in secure httpOnly cookie -> role-aware route -> dashboard. Logout revokes the refresh session. Expired access token uses one-time refresh rotation; reuse is rejected.

## Admin

Dashboard -> Students / Faculty / academic structure -> Mentor assignments -> Quiz monitoring -> Reports / announcements / audit logs / settings. Assignment changes close the current record and create a new effective record in one transaction.

## Mentor

Dashboard -> My mentees -> mentee profile tabs (overview, academics, quiz history, performance, feedback, meetings) -> Question bank -> Quiz wizard (basic info, questions, settings, preview, assign, publish) -> attempts/evaluations -> results -> feedback and meetings.

## Student

Dashboard -> mentor and upcoming work -> quiz instructions -> server-authoritative attempt -> answer/autosave/review -> submit transaction -> result or pending review -> performance, feedback, meetings, notifications, announcements.

## Failure and Recovery

Unauthorized requests route to a role-safe error state. Network failures preserve local draft answer state where possible and retry idempotent writes. Expired attempts are closed by the server. Empty collections explain the next action rather than showing blank screens.
