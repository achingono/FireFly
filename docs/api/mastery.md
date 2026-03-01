# Mastery API

The mastery API tracks student progress using Bayesian Knowledge Tracing (BKT). Each student has a per-concept mastery score (0.0–1.0) that updates with every exercise attempt. When a concept's score crosses the mastery threshold (0.80), prerequisite-dependent concepts may become unlocked.

## BKT Parameters

The server uses these fixed BKT parameters:

| Parameter | Symbol | Value | Description |
|-----------|--------|-------|-------------|
| Initial knowledge | pL0 | 0.10 | Prior probability of knowing a concept |
| Transition | pT | 0.20 | Probability of learning on each attempt |
| Guess | pG | 0.25 | Probability of correct answer despite not knowing |
| Slip | pS | 0.10 | Probability of incorrect answer despite knowing |
| Mastery threshold | — | 0.80 | Score at which a concept is considered mastered |

### BKT Update Algorithm

On each attempt (correct or incorrect):

1. **Compute posterior** using Bayes' theorem:
   - If **correct**: `posterior = pL * (1 - pS) / (pL * (1 - pS) + (1 - pL) * pG)`
   - If **incorrect**: `posterior = pL * pS / (pL * pS + (1 - pL) * (1 - pG))`
   - Where `pL` is the current knowledge probability (score)

2. **Apply learning transition**:
   - `pL_next = posterior + (1 - posterior) * pT`

3. **Clamp** to range `[0.01, 0.99]` to avoid extreme values

4. **Check mastery**: If `pL_next >= 0.80` and the previous score was below threshold → concept is "just mastered"

5. **Check unlocks**: Find all concepts whose prerequisites are ALL now mastered by this user → return as `newlyUnlocked`

## Endpoints

### `GET /api/v1/progress/:userId`

Get the full mastery map for a user — all concepts with their current mastery scores.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "userId": "uuid",
    "concepts": [
      {
        "conceptId": "uuid",
        "conceptName": "Variables",
        "score": 0.85,
        "mastered": true,
        "history": [
          {
            "date": "2025-01-15T10:30:00.000Z",
            "correct": true,
            "scoreBefore": 0.65,
            "scoreAfter": 0.85,
            "delta": 0.20,
            "exerciseId": "uuid"
          }
        ]
      },
      {
        "conceptId": "uuid",
        "conceptName": "Data Types",
        "score": 0.10,
        "mastered": false,
        "history": []
      }
    ]
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Notes**:
- Returns entries for ALL concepts, not just those the user has attempted
- Concepts without a `MasteryRecord` return `score: 0.10` (pL0 default) and empty history
- `mastered` is `true` when `score >= 0.80`

---

### `POST /api/v1/progress/:userId/update`

Submit an exercise attempt and update the BKT mastery score.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User UUID |

**Request Body**:
```json
{
  "conceptId": "uuid",
  "exerciseId": "uuid",
  "correct": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conceptId` | `string` | Yes | Concept being practiced |
| `exerciseId` | `string` | Yes | Exercise attempted |
| `correct` | `boolean` | Yes | Whether the attempt was correct |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "conceptId": "uuid",
    "scoreBefore": 0.35,
    "scoreAfter": 0.52,
    "delta": 0.17,
    "mastered": false,
    "justMastered": false,
    "newlyUnlocked": []
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `conceptId` | `string` | The concept that was updated |
| `scoreBefore` | `number` | Mastery score before this attempt |
| `scoreAfter` | `number` | Mastery score after BKT update |
| `delta` | `number` | Score change (`scoreAfter - scoreBefore`) |
| `mastered` | `boolean` | Whether the concept is now mastered (≥0.80) |
| `justMastered` | `boolean` | Whether this attempt caused the concept to cross the mastery threshold |
| `newlyUnlocked` | `array` | Concept IDs that became available because all their prerequisites are now mastered |

**Flow**:
1. Finds or creates a `MasteryRecord` for the user + concept pair
2. Applies BKT update formula
3. Appends attempt to history array:
   ```json
   { "date": "ISO-8601", "correct": true, "scoreBefore": 0.35, "scoreAfter": 0.52, "delta": 0.17, "exerciseId": "uuid" }
   ```
4. Saves updated record
5. If just mastered: queries all concepts to find newly unlockable ones
6. Returns update summary

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 400 | `ValidationError` | Missing required fields |
| 404 | `NotFoundError` | Concept not found |

---

### `GET /api/v1/progress/:userId/concept/:conceptId`

Get detailed mastery information for a single concept.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User UUID |
| `conceptId` | `string` | Concept UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "conceptId": "uuid",
    "conceptName": "Loops",
    "score": 0.62,
    "mastered": false,
    "attempts": 5,
    "history": [
      {
        "date": "2025-01-15T10:00:00.000Z",
        "correct": false,
        "scoreBefore": 0.10,
        "scoreAfter": 0.12,
        "delta": 0.02,
        "exerciseId": "uuid"
      },
      {
        "date": "2025-01-15T10:15:00.000Z",
        "correct": true,
        "scoreBefore": 0.12,
        "scoreAfter": 0.35,
        "delta": 0.23,
        "exerciseId": "uuid"
      }
    ]
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Concept or mastery record not found |

## Mastery Progression Example

Here's how BKT scores progress over multiple attempts for a concept:

```
Attempt 1 (correct):  0.10 → 0.35  (+0.25)  — Big jump from correct answer
Attempt 2 (correct):  0.35 → 0.56  (+0.21)  — Continued improvement
Attempt 3 (incorrect): 0.56 → 0.48 (-0.08)  — Small decrease
Attempt 4 (correct):  0.48 → 0.65  (+0.17)  — Recovery
Attempt 5 (correct):  0.65 → 0.78  (+0.13)  — Approaching threshold
Attempt 6 (correct):  0.78 → 0.86  (+0.08)  — MASTERED! ✓
```

**Key characteristics**:
- Correct answers always increase the score
- Incorrect answers decrease the score, but less dramatically (due to slip probability)
- The learning transition (`pT=0.20`) ensures scores always trend upward over time
- Mastery requires consistent correct answers, not just one lucky guess

## Related Documentation

- [API Overview](./overview.md)
- [Database Schema](../architecture/database.md) — MasteryRecord model
- [Dashboard](../architecture/frontend.md) — How mastery data is visualized
