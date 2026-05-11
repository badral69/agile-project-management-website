import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "SprintFlow API",
      version: "1.0.0",
      description:
        "REST API for SprintFlow — an agile project management platform. Supports JWT cookie auth and CSRF protection.",
      contact: { name: "SprintFlow" },
    },
    servers: [{ url: "/api", description: "Current environment" }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description: "JWT token set as HttpOnly cookie on login.",
        },
        csrfHeader: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
          description: "CSRF token. Read from `csrf_token` cookie and echo back in this header.",
        },
      },
      schemas: {
        // ── Enums ──────────────────────────────────────────────────────────
        Role: { type: "string", enum: ["ADMIN", "MODERATOR", "USER"] },
        BillingPlan: { type: "string", enum: ["STARTER", "PROFESSIONAL", "ENTERPRISE"] },
        ProjectStatus: { type: "string", enum: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] },
        ProjectMemberRole: { type: "string", enum: ["OWNER", "MANAGER", "CONTRIBUTOR", "VIEWER"] },
        TaskStatus: { type: "string", enum: ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] },
        TaskPriority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        TaskType: { type: "string", enum: ["EPIC", "STORY", "TASK", "BUG"] },
        SprintStatus: { type: "string", enum: ["PLANNING", "ACTIVE", "COMPLETED"] },

        // ── Core models ────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            fullName: { type: "string" },
            email: { type: "string", format: "email" },
            role: { $ref: "#/components/schemas/Role" },
            billingPlan: { $ref: "#/components/schemas/BillingPlan" },
            avatarColor: { type: "string" },
            avatarUrl: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            key: { type: "string", example: "SF" },
            name: { type: "string" },
            description: { type: "string" },
            status: { $ref: "#/components/schemas/ProjectStatus" },
            startDate: { type: "string", format: "date-time", nullable: true },
            endDate: { type: "string", format: "date-time", nullable: true },
            ownerId: { type: "string", format: "uuid" },
            companyId: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            projectId: { type: "string", format: "uuid" },
            assigneeId: { type: "string", format: "uuid", nullable: true },
            reporterId: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string" },
            status: { $ref: "#/components/schemas/TaskStatus" },
            priority: { $ref: "#/components/schemas/TaskPriority" },
            type: { $ref: "#/components/schemas/TaskType" },
            storyPoints: { type: "integer", nullable: true },
            dueDate: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Sprint: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            projectId: { type: "string", format: "uuid" },
            name: { type: "string" },
            goal: { type: "string", nullable: true },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            status: { $ref: "#/components/schemas/SprintStatus" },
            retrospective: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            body: { type: "string" },
            author: { $ref: "#/components/schemas/User" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        TimeLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            hours: { type: "number" },
            note: { type: "string", nullable: true },
            loggedAt: { type: "string", format: "date-time" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        Company: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ActivityLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            action: { type: "string", example: "TASK_CREATED" },
            entityType: { type: "string", example: "task" },
            entityId: { type: "string", format: "uuid" },
            metadata: { type: "object", nullable: true },
            actor: { $ref: "#/components/schemas/User" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Shared response shapes ─────────────────────────────────────────
        PaginatedMeta: {
          type: "object",
          properties: {
            page: { type: "integer" },
            limit: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        MessageResponse: {
          type: "object",
          properties: { message: { type: "string" } },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string" },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Not authenticated",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        Forbidden: {
          description: "Authenticated but insufficient permissions",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        NotFound: {
          description: "Resource not found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        ValidationError: {
          description: "Invalid request body or params",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
      },
    },
    security: [{ cookieAuth: [], csrfHeader: [] }],
    tags: [
      { name: "Auth", description: "Registration, login, password reset, OAuth" },
      { name: "Projects", description: "Project CRUD and member management" },
      { name: "Tasks", description: "Task CRUD, bulk operations, comments, time logs" },
      { name: "Sprints", description: "Sprint lifecycle and task assignment" },
      { name: "Users", description: "User profile and directory" },
      { name: "Companies", description: "Company and membership management" },
      { name: "Dashboard", description: "Aggregated workspace metrics" },
      { name: "Activity", description: "Audit activity feed" },
      { name: "Performance", description: "Worker performance metrics" },
      { name: "Billing", description: "Stripe subscription management" },
      { name: "Assistant", description: "AI task generation and voice parsing" },
      { name: "Public", description: "Unauthenticated endpoints (contact, CSRF)" },
    ],
    paths: {
      // ── Health ────────────────────────────────────────────────────────────
      "/health": {
        get: {
          summary: "Health check",
          tags: ["Public"],
          security: [],
          responses: {
            200: { description: "Service is running", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, service: { type: "string" } } } } } },
          },
        },
      },

      // ── Auth ──────────────────────────────────────────────────────────────
      "/auth/register": {
        post: {
          summary: "Register a new user",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fullName", "email", "password"],
                  properties: {
                    fullName: { type: "string", minLength: 2, maxLength: 80 },
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8, maxLength: 72 },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "User registered and logged in", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            409: { description: "Email already in use" },
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Login with email and password",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Logged in — JWT set as HttpOnly cookie", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
            401: { description: "Invalid credentials" },
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Logout — clears JWT cookie",
          tags: ["Auth"],
          responses: {
            200: { description: "Logged out", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
          },
        },
      },
      "/auth/me": {
        get: {
          summary: "Get current authenticated user",
          tags: ["Auth"],
          responses: {
            200: { description: "Current user", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/auth/google": {
        post: {
          summary: "Login or register via Google OAuth",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["credential"], properties: { credential: { type: "string", description: "Google ID token from GSI" } } },
              },
            },
          },
          responses: {
            200: { description: "Logged in via Google", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
            401: { description: "Invalid Google credential" },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request a password reset code",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
          },
          responses: {
            200: { description: "Reset code emailed if account exists", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
          },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset password using emailed code",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "code", "newPassword"],
                  properties: {
                    email: { type: "string", format: "email" },
                    code: { type: "string", minLength: 6, maxLength: 6 },
                    newPassword: { type: "string", minLength: 8, maxLength: 72 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Password reset successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            400: { description: "Invalid or expired code" },
          },
        },
      },

      // ── Projects ──────────────────────────────────────────────────────────
      "/projects": {
        get: {
          summary: "List projects accessible to the current user",
          tags: ["Projects"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { $ref: "#/components/schemas/ProjectStatus" } },
          ],
          responses: {
            200: {
              description: "Paginated project list",
              content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Project" } }, meta: { $ref: "#/components/schemas/PaginatedMeta" } } } } },
            },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          summary: "Create a project",
          tags: ["Projects"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "key", "description"],
                  properties: {
                    name: { type: "string", minLength: 2, maxLength: 80 },
                    key: { type: "string", minLength: 2, maxLength: 8, description: "Unique project key e.g. SF" },
                    description: { type: "string", maxLength: 500 },
                    status: { $ref: "#/components/schemas/ProjectStatus" },
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                    companyId: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Project created", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Project" } } } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/projects/{id}": {
        get: {
          summary: "Get a project with members, tasks, and activities",
          tags: ["Projects"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Project detail", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Project" } } } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
        put: {
          summary: "Update a project",
          tags: ["Projects"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          responses: {
            200: { description: "Updated project", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Project" } } } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          summary: "Delete a project",
          tags: ["Projects"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            403: { $ref: "#/components/responses/Forbidden" },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/projects/{id}/members": {
        post: {
          summary: "Add a member to a project",
          tags: ["Projects"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId"],
                  properties: {
                    userId: { type: "string", format: "uuid" },
                    memberRole: { $ref: "#/components/schemas/ProjectMemberRole" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Member added", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/projects/{id}/members/{userId}": {
        delete: {
          summary: "Remove a member from a project",
          tags: ["Projects"],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Member removed", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ── Tasks ─────────────────────────────────────────────────────────────
      "/tasks": {
        get: {
          summary: "List tasks (scoped to accessible projects)",
          tags: ["Tasks"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "status", in: "query", schema: { $ref: "#/components/schemas/TaskStatus" } },
            { name: "priority", in: "query", schema: { $ref: "#/components/schemas/TaskPriority" } },
            { name: "assigneeId", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Paginated task list", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Task" } }, meta: { $ref: "#/components/schemas/PaginatedMeta" } } } } } },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          summary: "Create a task",
          tags: ["Tasks"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["projectId", "title", "description", "status", "priority", "type"],
                  properties: {
                    projectId: { type: "string", format: "uuid" },
                    title: { type: "string", minLength: 3, maxLength: 140 },
                    description: { type: "string", minLength: 3, maxLength: 1200 },
                    status: { $ref: "#/components/schemas/TaskStatus" },
                    priority: { $ref: "#/components/schemas/TaskPriority" },
                    type: { $ref: "#/components/schemas/TaskType" },
                    storyPoints: { type: "integer", minimum: 1, maximum: 21, nullable: true },
                    assigneeId: { type: "string", format: "uuid", nullable: true },
                    dueDate: { type: "string", format: "date", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Task created", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Task" } } } } } },
            400: { $ref: "#/components/responses/ValidationError" },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/tasks/bulk": {
        patch: {
          summary: "Bulk update tasks (status or priority)",
          tags: ["Tasks"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ids"],
                  properties: {
                    ids: { type: "array", items: { type: "string", format: "uuid" }, minItems: 1, maxItems: 100 },
                    status: { $ref: "#/components/schemas/TaskStatus" },
                    priority: { $ref: "#/components/schemas/TaskPriority" },
                    assigneeId: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Tasks updated", content: { "application/json": { schema: { type: "object", properties: { updated: { type: "integer" } } } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/tasks/{id}": {
        get: {
          summary: "Get a task with comments, blockers, and attachments",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Task detail", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Task" } } } } } },
            404: { $ref: "#/components/responses/NotFound" },
          },
        },
        put: {
          summary: "Full update a task",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
          responses: {
            200: { description: "Updated task", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Task" } } } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
        patch: {
          summary: "Partial update a task",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
          responses: {
            200: { description: "Updated task", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Task" } } } } } },
          },
        },
        delete: {
          summary: "Delete a task",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/tasks/{id}/comments": {
        post: {
          summary: "Add a comment to a task",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["body"], properties: { body: { type: "string", minLength: 2, maxLength: 800 } } } } },
          },
          responses: {
            201: { description: "Comment added", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Comment" } } } } } },
          },
        },
      },
      "/tasks/{taskId}/timelogs": {
        get: {
          summary: "List time logs for a task",
          tags: ["Tasks"],
          parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Time logs and total hours", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/TimeLog" } }, totalHours: { type: "number" } } } } } },
          },
        },
        post: {
          summary: "Log time on a task",
          tags: ["Tasks"],
          parameters: [{ name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["hours"], properties: { hours: { type: "number", minimum: 0.1, maximum: 24 }, note: { type: "string", maxLength: 200 } } } } },
          },
          responses: {
            201: { description: "Time logged", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/TimeLog" } } } } } },
          },
        },
      },
      "/tasks/{taskId}/timelogs/{logId}": {
        delete: {
          summary: "Delete a time log (own logs only, unless ADMIN)",
          tags: ["Tasks"],
          parameters: [
            { name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "logId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            200: { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/tasks/{id}/blockers": {
        post: {
          summary: "Add a blocking task relationship",
          tags: ["Tasks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["blockerId"], properties: { blockerId: { type: "string", format: "uuid" } } } } },
          },
          responses: { 200: { description: "Blocker added" } },
        },
      },
      "/tasks/{id}/blockers/{blockerId}": {
        delete: {
          summary: "Remove a blocking task relationship",
          tags: ["Tasks"],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "blockerId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { 200: { description: "Blocker removed" } },
        },
      },

      // ── Sprints ───────────────────────────────────────────────────────────
      "/sprints/projects/{projectId}/sprints": {
        get: {
          summary: "List sprints for a project",
          tags: ["Sprints"],
          parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Sprint list", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Sprint" } } } } } } },
          },
        },
        post: {
          summary: "Create a sprint",
          tags: ["Sprints"],
          parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "startDate", "endDate"],
                  properties: {
                    name: { type: "string", minLength: 1, maxLength: 80 },
                    goal: { type: "string", maxLength: 300 },
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Sprint created", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Sprint" } } } } } } },
        },
      },
      "/sprints/sprints/{id}": {
        put: {
          summary: "Update a sprint (name, dates, status, retrospective)",
          tags: ["Sprints"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    goal: { type: "string" },
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                    status: { $ref: "#/components/schemas/SprintStatus" },
                    retrospective: { type: "string", maxLength: 2000, description: "Sprint retrospective notes (saved when completing the sprint)" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Updated sprint", content: { "application/json": { schema: { type: "object", properties: { item: { $ref: "#/components/schemas/Sprint" } } } } } } },
        },
        delete: {
          summary: "Delete a sprint",
          tags: ["Sprints"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } } },
        },
      },
      "/sprints/sprints/{id}/tasks": {
        post: {
          summary: "Add a task to a sprint",
          tags: ["Sprints"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["taskId"], properties: { taskId: { type: "string", format: "uuid" } } } } } },
          responses: { 200: { description: "Task added to sprint" } },
        },
      },
      "/sprints/sprints/{id}/tasks/{taskId}": {
        delete: {
          summary: "Remove a task from a sprint",
          tags: ["Sprints"],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "taskId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { 200: { description: "Task removed from sprint" } },
        },
      },

      // ── Users ─────────────────────────────────────────────────────────────
      "/users/me": {
        patch: {
          summary: "Update own profile (name, avatar)",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fullName: { type: "string", minLength: 2, maxLength: 80 },
                    avatarColor: { type: "string" },
                    avatarUrl: { type: "string", nullable: true },
                    language: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Updated user", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } } },
        },
      },
      "/users/directory": {
        get: {
          summary: "Get user directory (ADMIN only)",
          tags: ["Users"],
          responses: {
            200: { description: "User list", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/User" } } } } } } },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ── Companies ─────────────────────────────────────────────────────────
      "/companies": {
        get: {
          summary: "List companies (ADMIN) or own companies",
          tags: ["Companies"],
          responses: {
            200: { description: "Company list", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Company" } } } } } } },
          },
        },
        post: {
          summary: "Create a company",
          tags: ["Companies"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["name", "slug"], properties: { name: { type: "string" }, slug: { type: "string" }, description: { type: "string" } } } } },
          },
          responses: { 201: { description: "Company created" } },
        },
      },
      "/companies/{id}/members": {
        post: {
          summary: "Add a member to a company",
          tags: ["Companies"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["userId"], properties: { userId: { type: "string", format: "uuid" }, memberRole: { type: "string", enum: ["SUPERVISOR", "WORKER"] } } } } },
          },
          responses: { 201: { description: "Member added" } },
        },
      },

      // ── Dashboard ─────────────────────────────────────────────────────────
      "/dashboard": {
        get: {
          summary: "Get workspace dashboard metrics",
          tags: ["Dashboard"],
          responses: {
            200: {
              description: "Dashboard stats",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      projectCount: { type: "integer" },
                      taskCount: { type: "integer" },
                      overdueCount: { type: "integer" },
                      memberCount: { type: "integer" },
                      tasksByStatus: { type: "object" },
                      recentActivity: { type: "array", items: { $ref: "#/components/schemas/ActivityLog" } },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── Activity ──────────────────────────────────────────────────────────
      "/activity": {
        get: {
          summary: "Get activity feed for accessible projects",
          tags: ["Activity"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 30 } },
          ],
          responses: {
            200: { description: "Activity log", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/ActivityLog" } }, meta: { $ref: "#/components/schemas/PaginatedMeta" } } } } } },
          },
        },
      },

      // ── Performance ───────────────────────────────────────────────────────
      "/performance": {
        get: {
          summary: "Get worker performance metrics",
          tags: ["Performance"],
          parameters: [{ name: "projectId", in: "query", schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "Performance data per worker" },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ── Billing ───────────────────────────────────────────────────────────
      "/billing/checkout": {
        post: {
          summary: "Create a Stripe checkout session",
          tags: ["Billing"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["plan"], properties: { plan: { $ref: "#/components/schemas/BillingPlan" } } } } },
          },
          responses: {
            200: { description: "Stripe client secret", content: { "application/json": { schema: { type: "object", properties: { clientSecret: { type: "string" } } } } } },
          },
        },
      },
      "/billing/{sessionId}": {
        get: {
          summary: "Verify a completed Stripe checkout session",
          tags: ["Billing"],
          parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Session status and billing details" },
          },
        },
      },

      // ── Assistant ─────────────────────────────────────────────────────────
      "/assistant/generate-plan": {
        post: {
          summary: "Generate sprint tasks using AI",
          tags: ["Assistant"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["projectId", "projectName", "description"],
                  properties: {
                    projectId: { type: "string", format: "uuid" },
                    projectName: { type: "string" },
                    description: { type: "string", minLength: 10 },
                    teamSize: { type: "integer", minimum: 1, maximum: 20 },
                    durationDays: { type: "integer", minimum: 3, maximum: 90 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Generated task list" },
            403: { description: "AI entitlement required" },
          },
        },
      },
      "/assistant/parse-voice": {
        post: {
          summary: "Parse a voice transcript into a structured task",
          tags: ["Assistant"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["transcript"], properties: { transcript: { type: "string", minLength: 3 } } } } },
          },
          responses: {
            200: { description: "Parsed task fields" },
            403: { description: "Voice task entitlement required" },
          },
        },
      },

      // ── Public ────────────────────────────────────────────────────────────
      "/public/contact": {
        post: {
          summary: "Submit a contact form message",
          tags: ["Public"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "message"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    company: { type: "string" },
                    teamSize: { type: "string" },
                    message: { type: "string", minLength: 10, maxLength: 1000 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Message sent", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
