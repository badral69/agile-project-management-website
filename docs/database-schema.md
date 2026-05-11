# Database Schema Diagram

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ ProjectMember : joins
    Project ||--o{ ProjectMember : has
    Project ||--o{ Task : contains
    User ||--o{ Task : reports
    User ||--o{ Task : assigned_to
    Task ||--o{ Comment : has
    User ||--o{ Comment : writes
    User ||--o{ ActivityLog : performs
    Project ||--o{ ActivityLog : tracks
    Task ||--o{ ActivityLog : tracks

    User {
      string id PK
      string fullName
      string email UK
      string passwordHash
      enum role
      string avatarColor
      datetime createdAt
      datetime updatedAt
    }

    Project {
      string id PK
      string key UK
      string name
      string description
      enum status
      datetime startDate
      datetime endDate
      string ownerId FK
      datetime createdAt
      datetime updatedAt
    }

    ProjectMember {
      string id PK
      string projectId FK
      string userId FK
      enum memberRole
      datetime createdAt
    }

    Task {
      string id PK
      string projectId FK
      string assigneeId FK
      string reporterId FK
      string title
      string description
      enum status
      enum priority
      enum type
      int storyPoints
      datetime dueDate
      int position
      datetime createdAt
      datetime updatedAt
    }

    Comment {
      string id PK
      string taskId FK
      string authorId FK
      string body
      datetime createdAt
      datetime updatedAt
    }

    ActivityLog {
      string id PK
      string actorId FK
      string projectId FK
      string taskId FK
      string action
      string entityType
      string entityId
      json metadata
      datetime createdAt
    }
```

## Normalization Summary

- `users`, `projects`, and `tasks` store primary entities only.
- `project_members` resolves the many-to-many relation between users and projects.
- `comments` are separated from tasks to avoid repeated text columns in task rows.
- `activity_logs` store audit-style timeline events independently from business entities.

## Indexing Summary

- `users.email`, `projects.key`, and the `projectId + userId` membership pair are unique.
- Lookup indexes exist for user role, project status, owner, task assignee, task reporter, task status/priority, and activity timestamps.
- These indexes support dashboard counts, filtering, and pagination queries efficiently.
