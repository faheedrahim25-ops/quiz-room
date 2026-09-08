# Mentor360 Technical Requirements

## Architecture

`React + Vite -> REST /api/v1 -> Express + TypeScript -> services -> repositories -> PostgreSQL`.

The frontend uses React Router, TanStack Query, React Hook Form, Zod, and Lucide icons. The backend uses Express middleware, Zod validation, Argon2id password hashing, JWT access tokens, hashed server-side refresh sessions, and parameterized PostgreSQL queries. Route handlers only translate HTTP; services own business rules; repositories own SQL.

## Repository Layout

```text
frontend/src/{components,pages,layouts,hooks,services,api,context,routes,utils,types,styles}
backend/src/{config,routes,controllers,services,repositories,middleware,validators,utils,types}
backend/migrations/
docs/
```

## Runtime Requirements

Node.js 22+, PostgreSQL 16+, npm, and a configured `.env`. Frontend development runs on 5173; API runs on 4000. Production uses a built static frontend behind a TLS reverse proxy and stateless API instances backed by PostgreSQL.

## Quality Requirements

All list APIs paginate and bound page size. Critical workflows use transactions and row locks. Request IDs and structured logs are emitted without secrets. Health and readiness endpoints are required. The server uses Helmet, CORS allowlisting, JSON body limits, rate limits, and centralized errors. Frontend states include loading, empty, error, and success states.

## Current Foundation

Implemented: Vite React dashboard slice, responsive navigation, shared visual tokens, Express health/dashboard endpoints, environment validation, PostgreSQL initial migration, objective scoring service, and unit tests. Remaining feature modules follow `IMPLEMENTATION_PLAN.md`.
