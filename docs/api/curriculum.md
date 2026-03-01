# Curriculum API

The curriculum API manages the educational content hierarchy: **Concepts** → **Lessons** → **Exercises**. Concepts form a prerequisite chain, lessons contain educational content, and exercises are coding challenges students complete to build mastery.

## Concepts

### `GET /api/v1/concepts`

List all concepts with their prerequisites.

**Authentication**: Required

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": [
    {
      "id": "uuid",
      "name": "Variables",
      "slug": "variables",
      "description": "Learn how to store and use data with variables",
      "order": 1,
      "prerequisites": [],
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "Data Types",
      "slug": "data-types",
      "description": "Understand different types of data",
      "order": 2,
      "prerequisites": ["variables-concept-id"],
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "schemaVersion": "1.0" }
}
```

Concepts are returned ordered by the `order` field. The `prerequisites` array contains IDs of concepts that must be mastered before this concept is unlocked.

---

### `GET /api/v1/concepts/:id`

Get a single concept by ID.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Concept UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "uuid",
    "name": "Loops",
    "slug": "loops",
    "description": "Repeat actions with for and while loops",
    "order": 5,
    "prerequisites": ["conditionals-concept-id"],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Concept not found |

---

### `POST /api/v1/concepts`

Create a new concept.

**Authentication**: Required (admin role)

**Request Body**:
```json
{
  "name": "Recursion",
  "slug": "recursion",
  "description": "Functions that call themselves",
  "order": 9,
  "prerequisites": ["functions-concept-id"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique concept name |
| `slug` | `string` | Yes | Unique URL-safe identifier |
| `description` | `string` | Yes | Concept description |
| `order` | `number` | Yes | Display order |
| `prerequisites` | `string[]` | No | Array of prerequisite concept IDs |

**Response**: `201` with the created concept.

---

## Lessons

### `GET /api/v1/lessons`

List lessons, optionally filtered by concept.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conceptId` | `string` | No | Filter lessons by concept |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": [
    {
      "id": "uuid",
      "title": "Introduction to Variables",
      "description": "Learn what variables are and how to use them",
      "content": "# Variables\n\nA variable is like a labeled box...",
      "order": 1,
      "conceptId": "uuid",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "schemaVersion": "1.0" }
}
```

---

### `GET /api/v1/lessons/:id`

Get a single lesson with its linked exercises.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Lesson UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "uuid",
    "title": "Introduction to Variables",
    "description": "Learn what variables are",
    "content": "# Variables\n\n...",
    "order": 1,
    "conceptId": "uuid",
    "exercises": [
      {
        "exercise": {
          "id": "uuid",
          "title": "Create a Variable",
          "description": "Create a variable called name...",
          "difficulty": "beginner",
          "language": "python"
        },
        "order": 1
      }
    ],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Lesson not found |

---

### `POST /api/v1/lessons`

Create a new lesson.

**Authentication**: Required (admin role)

**Request Body**:
```json
{
  "title": "Working with Lists",
  "description": "Learn to store collections of data",
  "content": "# Lists\n\nA list is an ordered collection...",
  "order": 1,
  "conceptId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Lesson title |
| `description` | `string` | Yes | Brief summary |
| `content` | `string` | Yes | Full content (Markdown) |
| `order` | `number` | Yes | Order within concept |
| `conceptId` | `string` | Yes | Parent concept ID |

**Response**: `201` with the created lesson.

---

## Exercises

### `GET /api/v1/exercises`

List exercises with optional filtering.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conceptId` | `string` | No | Filter by concept |
| `difficulty` | `string` | No | Filter by difficulty: `beginner`, `intermediate`, `advanced` |
| `language` | `string` | No | Filter by programming language |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": [
    {
      "id": "uuid",
      "title": "Hello Variables",
      "description": "Create a variable and print its value",
      "difficulty": "beginner",
      "language": "python",
      "starterCode": "# Create a variable called greeting\n",
      "solutionCode": "greeting = 'Hello, World!'\nprint(greeting)",
      "testCases": [
        {
          "input": "",
          "expectedOutput": "Hello, World!"
        }
      ],
      "conceptId": "uuid",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "schemaVersion": "1.0" }
}
```

---

### `GET /api/v1/exercises/:id`

Get a single exercise by ID.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Exercise UUID |

**Response**: Same shape as list item above, single object in `data`.

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Exercise not found |

---

### `POST /api/v1/exercises`

Create a new exercise.

**Authentication**: Required (admin role)

**Request Body**:
```json
{
  "title": "Sum Two Numbers",
  "description": "Write a function that adds two numbers",
  "difficulty": "beginner",
  "language": "python",
  "starterCode": "def add(a, b):\n    # Your code here\n    pass",
  "solutionCode": "def add(a, b):\n    return a + b",
  "testCases": [
    { "input": "add(2, 3)", "expectedOutput": "5" },
    { "input": "add(-1, 1)", "expectedOutput": "0" }
  ],
  "conceptId": "uuid",
  "lessonId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Exercise title |
| `description` | `string` | Yes | Instructions |
| `difficulty` | `string` | Yes | `beginner`, `intermediate`, or `advanced` |
| `language` | `string` | No | Language (default: `"python"`) |
| `starterCode` | `string` | Yes | Initial code template |
| `solutionCode` | `string` | No | Reference solution |
| `testCases` | `array` | Yes | Array of `{ input, expectedOutput }` |
| `conceptId` | `string` | Yes | Parent concept ID |
| `lessonId` | `string` | No | Lesson to link via join table |

**Response**: `201` with the created exercise. If `lessonId` is provided, also creates a `Lesson_Exercise` join record.

## Related Documentation

- [API Overview](./overview.md)
- [Database Schema](../architecture/database.md)
- [Execution API](./execution.md)
