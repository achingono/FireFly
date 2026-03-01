# Authentication API

The authentication system uses OpenID Connect (OIDC) for identity, with JWT access and refresh tokens for session management. After initial login, users complete an onboarding step to configure their profile.

## Endpoints

### `GET /api/v1/auth/login`

Initiates the OIDC login flow by redirecting the browser to the identity provider.

**Authentication**: None

**Query Parameters**: None

**Response**: HTTP 302 redirect to the OIDC authorization endpoint.

**Flow**:
1. Generates a random `state` parameter
2. Creates a PKCE code verifier and computes the S256 code challenge
3. Stores the code verifier in Redis with a 10-minute TTL (falls back to in-memory map)
4. Builds the OIDC authorization URL with parameters:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`
   - `scope=openid email profile`
   - `state`
   - `code_challenge` (S256)
   - `code_challenge_method=S256`
5. Redirects the browser to the authorization URL

---

### `GET /api/v1/auth/callback`

Handles the OIDC authorization code callback. Exchanges the code for tokens, creates/updates the user, and issues JWT cookies.

**Authentication**: None

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | Authorization code from OIDC provider |
| `state` | `string` | Yes | State parameter for CSRF protection |

**Response**: HTTP 302 redirect to the client application.

**Flow**:
1. Extracts `code` and `state` from query parameters
2. Retrieves the stored code verifier from Redis using `state` as key
3. Exchanges the authorization code at the OIDC token endpoint:
   - Sends `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier`
4. Decodes the ID token (JWT) to extract claims: `sub`, `email`, `name`
5. Upserts the user in the database:
   - Matches on `oidcSub`
   - Creates new user if not found
   - Updates email and display name if changed
6. Signs JWT access token (15min) and refresh token (7d) containing:
   ```json
   { "sub": "user-id", "email": "...", "role": "...", "ageProfile": "..." }
   ```
7. Sets tokens as httpOnly cookies (`token`, `refreshToken`)
8. Redirects to `CLIENT_ORIGIN/auth/callback?token=<accessToken>&onboarded=<bool>`

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 400 | `AuthenticationError` | Missing code or state parameter |
| 401 | `AuthenticationError` | Code verifier not found (expired or invalid state) |
| 401 | `AuthenticationError` | Token exchange failed |

---

### `GET /api/v1/auth/me`

Returns the authenticated user's profile.

**Authentication**: Required

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "uuid",
    "oidcSub": "oidc-subject-id",
    "email": "user@example.com",
    "displayName": "Alice",
    "role": "student",
    "age": 12,
    "ageProfile": "balanced",
    "avatarUrl": null,
    "onboarded": true,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 401 | `AuthenticationError` | Missing or invalid JWT |
| 404 | `NotFoundError` | User not found in database |

---

### `POST /api/v1/auth/refresh`

Refreshes the access token using the refresh token cookie.

**Authentication**: None (uses refresh token cookie)

**Request Body**: None

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "token": "new-access-token"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Flow**:
1. Reads `refreshToken` from cookies
2. Verifies the refresh token JWT
3. Looks up the user in the database
4. Signs a new access token
5. Sets the new access token as an httpOnly cookie
6. Returns the new token in the response body

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 401 | `AuthenticationError` | Missing or invalid refresh token |
| 404 | `NotFoundError` | User not found |

---

### `POST /api/v1/auth/onboard`

Completes user onboarding by setting profile details.

**Authentication**: Required

**Request Body**:
```json
{
  "displayName": "Alice",
  "role": "student",
  "age": 12,
  "ageProfile": "balanced"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | `string` | Yes | User's chosen display name |
| `role` | `string` | Yes | One of: `student`, `teacher`, `parent`, `admin` |
| `age` | `number` | Yes | User's age |
| `ageProfile` | `string` | Yes | One of: `fun`, `balanced`, `pro` |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Alice",
    "role": "student",
    "age": 12,
    "ageProfile": "balanced",
    "onboarded": true
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Flow**:
1. Validates request body
2. Updates user record: `displayName`, `role`, `age`, `ageProfile`, `onboarded=true`
3. Signs new JWT tokens with updated claims
4. Sets updated cookies
5. Returns updated user profile

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 400 | `ValidationError` | Invalid or missing fields |
| 401 | `AuthenticationError` | Not authenticated |

---

### `POST /api/v1/auth/logout`

Clears authentication cookies to end the session.

**Authentication**: None

**Request Body**: None

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": { "message": "Logged out" },
  "meta": { "schemaVersion": "1.0" }
}
```

**Flow**:
1. Clears the `token` cookie
2. Clears the `refreshToken` cookie

## Cookie Configuration

Both JWT cookies are set with these attributes:

| Attribute | Value | Description |
|-----------|-------|-------------|
| `httpOnly` | `true` | Not accessible via JavaScript |
| `secure` | `false` (dev) / `true` (prod) | HTTPS only in production |
| `sameSite` | `lax` | CSRF protection |
| `path` | `/` | Available on all paths |

## Related Documentation

- [API Overview](./overview.md)
- [Authentication Guide](../guides/authentication.md)
- [Backend Architecture](../architecture/backend.md)
