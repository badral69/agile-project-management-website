# AgilePM

AgilePM is an OpenProject-inspired fullstack diploma project for agile project management. It includes secure authentication, role-based access control, REST APIs, PostgreSQL relational modeling, dashboards, work packages, filtering, pagination, Docker deployment, and documentation.

## Stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form
- Backend: Node.js, Express, TypeScript, Prisma ORM, JWT, bcrypt
- Database: PostgreSQL
- DevOps: Docker, Docker Compose, Nginx

## Core Features

- User authentication: register, login, logout, current-user session
- RBAC: `ADMIN`, `MODERATOR`, `USER`
- Project CRUD with member management and activity tracking
- Work package CRUD with filtering, search, comments, and board view
- Admin dashboard and user dashboard views
- Pagination for project and task datasets
- Secure backend with hashing, rate limit, validation, Helmet, HPP, sanitized text input, and env-based configuration

## Folder Structure

```text
agile/
├── backend/
│   ├── prisma/
│   └── src/
├── frontend/
│   └── src/
├── docs/
│   ├── api/
│   ├── architecture.md
│   └── database-schema.md
├── docker-compose.yml
└── README.md
```

## Database Design

The relational schema is normalized and centered around six connected tables:

- `users`
- `projects`
- `project_members`
- `tasks`
- `comments`
- `activity_logs`

It uses:

- Foreign keys for ownership, membership, assignees, reporting, comments, and activities
- Unique constraints for `users.email`, `projects.key`, and `project_members(projectId, userId)`
- Indexes on roles, statuses, ownership, date fields, task lookup patterns, and activity relations

## Local Development

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 3. Database

Run PostgreSQL locally or use Docker Compose below.

## Docker Run

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000/api`
- PostgreSQL: `localhost:5432`

## Gmail Assignment Emails

Task assignment notifications are configured for Gmail SMTP using `badral.munh@gmail.com`.

Update [backend/.env](/Users/tg/Desktop/agile/backend/.env:1) with your Gmail app password:

```env
SMTP_PASS=your-16-character-google-app-password
```

Current mailer settings:

- `MAIL_FROM=badral.munh@gmail.com`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=badral.munh@gmail.com`
- `SMTP_SECURE=false`

After adding the app password, restart the backend container:

```bash
docker compose up -d --build backend
```

Until `SMTP_PASS` is filled, SprintFlow logs assignment emails instead of sending them.

## Stripe Billing

The pricing flow now routes into a dedicated Stripe checkout page instead of jumping straight into the workspace.

Configure these keys before using paid plans:

- [backend/.env](/Users/tg/Desktop/agile/backend/.env:1)
  - `STRIPE_SECRET_KEY=...`
- [frontend/.env](/Users/tg/Desktop/agile/frontend/.env:1)
  - `VITE_STRIPE_PUBLISHABLE_KEY=...`

The app uses Stripe Checkout in embedded mode for subscription payments and supports:

- `Starter`: free path with no payment required
- `Professional`: fixed monthly subscription
- `Custom`: monthly subscription with dynamic pricing based on selected seats and add-ons

After updating Stripe keys, rebuild both apps:

```bash
docker compose up -d --build backend frontend
```

## Seeded Demo Accounts

- `admin@agilepm.local` / `Password123!`
- `moderator@agilepm.local` / `Password123!`
- `user@agilepm.local` / `Password123!`

## API Documentation

See [docs/api/endpoints.md](./docs/api/endpoints.md)

## Architecture Diagram

See [docs/architecture.md](./docs/architecture.md)

## Database Schema Diagram

See [docs/database-schema.md](./docs/database-schema.md)

## Notes

- The product is intentionally OpenProject-inspired rather than a literal one-to-one clone of the full OpenProject enterprise feature set.
- Prisma client generation and database push happen automatically in the backend Docker container for easier evaluation.
