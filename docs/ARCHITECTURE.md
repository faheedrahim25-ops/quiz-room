# Mentor360 Architecture

The browser calls versioned REST endpoints. Express middleware handles security and request context, controllers translate HTTP, services enforce domain rules, repositories execute parameterized SQL, and PostgreSQL stores normalized records. Quiz submission, mentor reassignment, and evaluation are transactional operations.

The frontend is a role-aware React application with shared components and TanStack Query data access. API responses are the source of truth; local state is limited to interaction state and recoverable drafts. Static assets are served independently from the API in production.
