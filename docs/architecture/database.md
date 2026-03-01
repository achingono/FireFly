# Database Schema

FireFly uses PostgreSQL as its primary database, managed through Prisma ORM with the `@prisma/adapter-pg` adapter. The schema defines models for users, curriculum content, code execution jobs, and mastery tracking.

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    User       │     │     Concept       │     │     Lesson        │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)          │     │ id (PK)          │
│ oidcSub      │     │ name             │     │ title            │
│ email        │     │ slug             │     │ description      │
│ displayName  │     │ description      │     │ content          │
│ role         │     │ order            │     │ order            │
│ age          │     │ prerequisites [] │     │ conceptId (FK)   │
│ ageProfile   │     │ createdAt        │     │ createdAt        │
│ avatarUrl    │     │ updatedAt        │     │ updatedAt        │
│ onboarded    │     └────────┬─────────┘     └────────┬─────────┘
│ createdAt    │              │                         │
│ updatedAt    │              │ conceptId               │ lessonId
└──────┬───────┘              │                         │
       │                      ▼                         ▼
       │              ┌──────────────────┐     ┌──────────────────┐
       │              │    Exercise       │     │ Lesson_Exercise   │
       │              ├──────────────────┤     ├──────────────────┤
       │              │ id (PK)          │     │ lessonId (FK)    │
       │              │ title            │     │ exerciseId (FK)  │
       │              │ description      │◄────│ order            │
       │              │ difficulty       │     └──────────────────┘
       │              │ language         │
       │              │ starterCode      │
       │              │ solutionCode     │
       │              │ testCases []     │
       │              │ conceptId (FK)   │
       │              │ createdAt        │
       │              │ updatedAt        │
       │              └──────────────────┘
       │
       │ userId
       ▼
┌──────────────────┐     ┌──────────────────┐
│  ExecutionJob     │     │  MasteryRecord    │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │
│ userId (FK)      │     │ userId (FK)      │
│ exerciseId (FK)  │     │ conceptId (FK)   │
│ language         │     │ score            │
│ sourceCode       │     │ history []       │
│ status           │     │ createdAt        │
│ judge0Id         │     │ updatedAt        │
│ stdout           │     └──────────────────┘
│ stderr           │
│ trace            │     ┌──────────────────┐
│ exitCode         │     │ LearningSession   │
│ createdAt        │     ├──────────────────┤
│ updatedAt        │     │ id (PK)          │
└──────────────────┘     │ userId (FK)      │
                         │ startedAt        │
                         │ endedAt          │
                         │ events []        │
                         │ createdAt        │
                         │ updatedAt        │
                         └──────────────────┘
```

## Enums

### Role

Defines user roles with different access levels:

```prisma
enum Role {
  student    // Default role for learners
  teacher    // Can view class progress, create content
  parent     // Can view child's progress
  admin      // Full access, can seed data, manage content
}
```

### AgeProfile

Determines which adaptive theme mode to use:

```prisma
enum AgeProfile {
  fun        // Ages 8–10: bright colors, large fonts, playful
  balanced   // Ages 11–13: clean design, moderate complexity
  pro        // Ages 14+: dark IDE theme, compact, technical
}
```

### Difficulty

Exercise difficulty levels:

```prisma
enum Difficulty {
  beginner
  intermediate
  advanced
}
```

### ExecStatus

Execution job lifecycle states:

```prisma
enum ExecStatus {
  queued      // Submitted to Judge0, waiting
  running     // Currently executing
  completed   // Finished successfully
  failed      // Execution error
  timeout     // Exceeded time limit
}
```

## Models

### User

Represents all platform users (students, teachers, parents, admins).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `oidcSub` | `String` (unique) | OIDC subject identifier from identity provider |
| `email` | `String` (unique) | User's email address |
| `displayName` | `String?` | Display name (set during onboarding) |
| `role` | `Role` | User role (default: `student`) |
| `age` | `Int?` | User's age (set during onboarding) |
| `ageProfile` | `AgeProfile` | Theme mode (default: `balanced`) |
| `avatarUrl` | `String?` | Profile picture URL |
| `onboarded` | `Boolean` | Whether onboarding is complete (default: `false`) |
| `createdAt` | `DateTime` | Account creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Relations**: `executionJobs`, `masterRecords`, `learningSessions`

### Concept

A curriculum topic (e.g., Variables, Loops, Functions). Concepts form a prerequisite chain.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `name` | `String` (unique) | Concept name (e.g., "Variables") |
| `slug` | `String` (unique) | URL-safe identifier |
| `description` | `String` | Explanation of the concept |
| `order` | `Int` | Display ordering |
| `prerequisites` | `String[]` | Array of prerequisite concept IDs |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Relations**: `lessons`, `exercises`, `masteryRecords`

**Note**: Prerequisites are stored as an array of concept IDs rather than a join table, simplifying queries for the BKT mastery system which needs to check "are all prerequisites mastered?"

### Lesson

Educational content associated with a concept.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `title` | `String` | Lesson title |
| `description` | `String` | Brief summary |
| `content` | `String` | Full lesson content (Markdown) |
| `order` | `Int` | Display ordering within concept |
| `conceptId` | `String` | Foreign key to Concept |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Relations**: `concept`, `exercises` (via `Lesson_Exercise`)

### Exercise

A coding exercise that students complete to build mastery.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `title` | `String` | Exercise title |
| `description` | `String` | Instructions |
| `difficulty` | `Difficulty` | beginner / intermediate / advanced |
| `language` | `String` | Programming language (default: `"python"`) |
| `starterCode` | `String` | Initial code template |
| `solutionCode` | `String?` | Reference solution (hidden from students) |
| `testCases` | `Json` | Array of `{ input, expectedOutput }` objects |
| `conceptId` | `String` | Foreign key to Concept |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Relations**: `concept`, `executionJobs`, `lessons` (via `Lesson_Exercise`)

### Lesson_Exercise

Join table linking lessons to exercises with ordering.

| Field | Type | Description |
|-------|------|-------------|
| `lessonId` | `String` | Foreign key to Lesson |
| `exerciseId` | `String` | Foreign key to Exercise |
| `order` | `Int` | Exercise order within lesson (default: `0`) |

**Primary key**: Composite `(lessonId, exerciseId)`

### ExecutionJob

Tracks code execution jobs submitted to Judge0.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `userId` | `String` | Foreign key to User |
| `exerciseId` | `String?` | Foreign key to Exercise (null for free-run) |
| `language` | `String` | Programming language |
| `sourceCode` | `String` | Submitted source code |
| `status` | `ExecStatus` | Job lifecycle state (default: `queued`) |
| `judge0Id` | `String?` | Judge0 submission token |
| `stdout` | `String?` | Standard output |
| `stderr` | `String?` | Standard error output |
| `trace` | `Json?` | Parsed execution trace (array of frames) |
| `exitCode` | `Int?` | Process exit code |
| `createdAt` | `DateTime` | Submission timestamp |
| `updatedAt` | `DateTime` | Last status update |

**Relations**: `user`, `exercise`

### MasteryRecord

Tracks per-concept mastery for each user using Bayesian Knowledge Tracing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `userId` | `String` | Foreign key to User |
| `conceptId` | `String` | Foreign key to Concept |
| `score` | `Float` | Current BKT probability of mastery (0.0–1.0, default: `0.1`) |
| `history` | `Json` | Array of attempt records (see below) |
| `createdAt` | `DateTime` | Record creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Unique constraint**: `(userId, conceptId)` — one record per user per concept.

**History entry shape**:
```json
{
  "date": "2025-01-15T10:30:00.000Z",
  "correct": true,
  "scoreBefore": 0.35,
  "scoreAfter": 0.52,
  "delta": 0.17,
  "exerciseId": "uuid"
}
```

### LearningSession

Tracks learning sessions for analytics.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID) | Primary key |
| `userId` | `String` | Foreign key to User |
| `startedAt` | `DateTime` | Session start time |
| `endedAt` | `DateTime?` | Session end time (null if active) |
| `events` | `Json` | Array of session events |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update timestamp |

**Relations**: `user`

## Indexes

- `User.oidcSub` — Unique index for OIDC subject lookup
- `User.email` — Unique index for email lookup
- `Concept.name` — Unique index
- `Concept.slug` — Unique index
- `MasteryRecord.(userId, conceptId)` — Unique composite index
- `Lesson_Exercise.(lessonId, exerciseId)` — Composite primary key

## Migrations

Prisma migrations are stored in `code/server/prisma/migrations/`. The server Dockerfile runs `npx prisma migrate deploy` on startup to apply pending migrations.

To create a new migration:

```bash
cd code/server
npx prisma migrate dev --name <description>
```

To apply migrations in production:

```bash
npx prisma migrate deploy
```

## Seed Data

The `POST /api/v1/admin/seed` endpoint creates initial data idempotently:

- **5 users**: 3 students (ages 9, 12, 15 with fun/balanced/pro profiles), 1 teacher, 1 admin
- **8 concepts**: Variables → Data Types → Operators → Conditionals → Loops → Functions → Lists → Dictionaries (with prerequisite chains)
- **5 lessons**: One per early concept
- **10 exercises**: Distributed across concepts with varying difficulty levels

## Related Documentation

- [Architecture Overview](./overview.md)
- [Backend Architecture](./backend.md)
- [Mastery API](../api/mastery.md)
- [Curriculum API](../api/curriculum.md)
