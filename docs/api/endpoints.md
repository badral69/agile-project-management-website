# API Documentation

Base URL:

```text
http://localhost:5000/api
```

Authentication is cookie-based JWT with optional bearer-token fallback.

## Auth

- `POST /auth/register`
  Creates a new user account.
- `POST /auth/login`
  Authenticates a user and sets the JWT cookie.
- `POST /auth/logout`
  Clears the auth cookie.
- `GET /auth/me`
  Returns the authenticated user.

## Dashboard

- `GET /dashboard/overview`
  Returns role-aware dashboard statistics, recent projects, status breakdown, and personal tasks.

## Users

- `GET /users`
  Admin-only paginated user list with search and role filter.
- `PATCH /users/:id/role`
  Admin-only role update.
- `DELETE /users/:id`
  Admin-only delete operation.

## Projects

- `GET /projects`
  Paginated projects with `search`, `status`, `page`, `limit`.
- `GET /projects/:id`
  Single project with members, tasks, counts, and activities.
- `GET /projects/:id/board`
  Kanban-style task grouping by status.
- `POST /projects`
  Create a new project.
- `PUT /projects/:id`
  Update a project.
- `DELETE /projects/:id`
  Delete a project.
- `POST /projects/:id/members`
  Add a project member.
- `DELETE /projects/:id/members/:memberId`
  Remove a project member.

## Tasks

- `GET /tasks`
  Paginated tasks with `search`, `status`, `priority`, `type`, `projectId`, `assigneeId`, `page`, `limit`.
- `GET /tasks/:id`
  Task detail including comments.
- `POST /tasks`
  Create a task.
- `PUT /tasks/:id`
  Update a task.
- `DELETE /tasks/:id`
  Delete a task.
- `POST /tasks/:id/comments`
  Add a comment to a task.

## Example Payloads

### Login

```json
{
  "email": "admin@agilepm.local",
  "password": "Password123!"
}
```

### Create Project

```json
{
  "key": "MOB",
  "name": "Mobile Release Train",
  "description": "Coordinate features, risks, and delivery milestones for the mobile program.",
  "status": "ACTIVE",
  "startDate": "2026-04-18",
  "endDate": "2026-07-30"
}
```

### Create Task

```json
{
  "projectId": "project-uuid",
  "title": "Implement release burndown widget",
  "description": "Add dashboard visualization for sprint completion pace.",
  "status": "TODO",
  "priority": "HIGH",
  "type": "STORY",
  "storyPoints": 5,
  "dueDate": "2026-05-05"
}
```

## Security Controls

- bcrypt password hashing
- JWT authentication
- protected routes
- Zod input validation
- Prisma query safety against SQL injection
- sanitized plain text input for basic XSS reduction
- Helmet security headers
- HPP protection
- express-rate-limit throttling
