# Mentor360 Deployment

Build frontend and backend separately, inject environment secrets through the deployment platform, run migrations before serving traffic, expose `/api/v1/health` for liveness, and use a readiness check that verifies database connectivity. Terminate TLS at the reverse proxy, allow only the deployed frontend origin, rotate secrets through the secret manager, and configure backups plus restore drills.

Before building the frontend, set `VITE_API_URL` to the public backend URL ending in `/api/v1`. The frontend defaults to `http://localhost:4000/api/v1` only for local development; leaving it unset in a deployed build causes browser requests to fail. Set backend `CORS_ORIGIN` to the frontend's HTTPS origin. Multiple allowed origins can be supplied as a comma-separated value.

Run `npm run build --prefix frontend` and `npm run build --prefix backend`; serve `frontend/dist` as static assets and `backend/dist/app.js` as the API process. Add graceful shutdown for HTTP and database pools when repositories are introduced.
