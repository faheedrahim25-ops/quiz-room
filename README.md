# Mentor360

Standalone college mentor-mentee and quiz management platform.

## Current status

The repository contains a production-oriented foundation: responsive React mentor dashboard, Express TypeScript API, PostgreSQL migration, environment validation, server-side scoring utility, tests, and complete product/technical planning documents. Feature modules are tracked in `docs/IMPLEMENTATION_PLAN.md`.

## Prerequisites

Node.js 22+, npm, PostgreSQL 16+.

## Run locally

1. Copy `.env.example` to `.env` and set strong secrets.
2. Run `npm run seed --prefix backend` to create the database role, initialize the schema, and seed default admin/mentor/student users.
3. Start the API with `npm run dev --prefix backend`.
4. Start the frontend with `npm run dev --prefix frontend`.

For a deployed frontend, set `VITE_API_URL` in the frontend deployment environment to the public API URL, including `/api/v1` (for example, `https://api.example.com/api/v1`). Do not leave it unset in production because the fallback is `localhost`. Set the backend `CORS_ORIGIN` to the deployed frontend origin; multiple origins may be comma-separated.

### Development login

- Admin: `admin@college.edu` / `Admin@123`
- Mentor: `mentor@college.edu` / `Mentor@123`
- Student: `student@college.edu` / `Student@123`

## Verify

`npm run build --prefix frontend`  
`npm run build --prefix backend`  
`npm test --prefix backend`

Do not use seed identities or development data in production. See `docs/SECURITY_REQUIREMENTS.md` and `docs/DEPLOYMENT.md` before deployment.
