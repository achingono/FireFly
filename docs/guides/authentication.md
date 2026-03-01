# Authentication Guide

FireFly uses OpenID Connect (OIDC) for identity management, with JWT tokens for session management. This guide explains the full authentication flow, from initial login through token refresh and logout.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Browser  │     │  Server   │     │ OIDC Provider │
│  (Client) │     │ (Fastify) │     │  (Port 9000)  │
└─────┬─────┘     └─────┬─────┘     └──────┬───────┘
      │                  │                   │
      │  1. Click Login  │                   │
      ├─────────────────▶│                   │
      │                  │  2. Build OIDC URL │
      │                  │  (PKCE + state)   │
      │  3. Redirect     │                   │
      │◄─────────────────│                   │
      │                  │                   │
      │  4. Login at OIDC Provider          │
      ├──────────────────────────────────────▶│
      │                                      │
      │  5. Redirect with auth code          │
      │◄─────────────────────────────────────│
      │                  │                   │
      │  6. Callback     │                   │
      ├─────────────────▶│                   │
      │                  │  7. Exchange code  │
      │                  ├──────────────────▶│
      │                  │  8. ID Token      │
      │                  │◄──────────────────│
      │                  │                   │
      │                  │  9. Upsert user   │
      │                  │  10. Sign JWT     │
      │                  │  11. Set cookies  │
      │  12. Redirect    │                   │
      │◄─────────────────│                   │
      │                  │                   │
      │  13. Extract token, load user        │
      │                  │                   │
```

## Login Flow (Step by Step)

### Step 1: User Clicks Login

The client calls `api.auth.login()` which navigates the browser to:
```
GET /api/v1/auth/login
```

### Step 2: Server Builds OIDC Authorization URL

The server generates:
- **Random state** — CSRF protection token
- **PKCE code verifier** — Random 128-character string
- **PKCE code challenge** — SHA-256 hash of verifier, base64url-encoded

The code verifier is stored in Redis with key `pkce:<state>` and 10-minute TTL. If Redis is unavailable, falls back to an in-memory Map.

### Step 3: Browser Redirected to OIDC Provider

The server responds with HTTP 302 to the OIDC authorization URL:
```
http://localhost:9000/auth?
  response_type=code&
  client_id=firefly&
  redirect_uri=http://localhost:3000/api/v1/auth/callback&
  scope=openid email profile&
  state=<random>&
  code_challenge=<sha256-hash>&
  code_challenge_method=S256
```

### Step 4: User Authenticates

The user logs in at the OIDC provider. Default credentials:
- **Email**: `admin@localhost`
- **Password**: `Rays-93-Accident`

### Step 5: OIDC Provider Redirects Back

After successful login, the OIDC provider redirects to:
```
GET /api/v1/auth/callback?code=<authorization-code>&state=<state>
```

### Step 6–8: Code Exchange

The server:
1. Retrieves the stored code verifier from Redis using the `state` parameter
2. Sends a POST to the OIDC token endpoint with:
   - `grant_type=authorization_code`
   - `code=<authorization-code>`
   - `redirect_uri=<callback-url>`
   - `client_id=firefly`
   - `client_secret=firefly-secret`
   - `code_verifier=<stored-verifier>`
3. Receives an ID token (JWT) containing user claims

### Step 9: User Upsert

The server decodes the ID token and extracts:
- `sub` — OIDC subject identifier (stable user ID from provider)
- `email` — User's email address
- `name` — User's display name

It then upserts the user in the database:
- **Existing user** (matching `oidcSub`): Updates email and display name if changed
- **New user**: Creates a new record with default role (`student`), default age profile (`balanced`), and `onboarded: false`

### Step 10–11: JWT Tokens

The server signs two JWT tokens:

**Access Token** (15-minute lifetime):
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "student",
  "ageProfile": "balanced"
}
```

**Refresh Token** (7-day lifetime):
```json
{
  "sub": "user-uuid",
  "type": "refresh"
}
```

Both tokens are set as httpOnly cookies:
- `token` — Access token
- `refreshToken` — Refresh token

### Step 12: Client Redirect

The server redirects the browser to:
```
http://localhost:5173/auth/callback?token=<access-token>&onboarded=true|false
```

### Step 13: Client Token Handling

The `AuthContext` on the client side:
1. Detects `token` query parameter in the URL
2. Stores the token in `localStorage`
3. Cleans the URL (removes query parameters)
4. Calls `GET /api/v1/auth/me` to load the full user profile
5. If `onboarded=false`: Redirects to `/onboarding`
6. If `onboarded=true`: Proceeds to the requested page

## Onboarding

New users must complete onboarding before accessing protected pages:

1. User lands on `/onboarding`
2. Fills in: display name, age, role, age profile (fun/balanced/pro)
3. Client sends `POST /api/v1/auth/onboard` with the profile data
4. Server updates the user record, sets `onboarded: true`
5. Server issues new JWT tokens with updated claims (role, ageProfile)
6. Client updates the stored token and user state
7. User is redirected to the dashboard

## Token Refresh

Access tokens expire after 15 minutes. The client can refresh them:

```
POST /api/v1/auth/refresh
```

The server:
1. Reads the `refreshToken` cookie
2. Verifies the refresh token JWT
3. Looks up the user in the database
4. Signs a new access token
5. Sets the new access token cookie
6. Returns the new token in the response

## Logout

```
POST /api/v1/auth/logout
```

The server clears both the `token` and `refreshToken` cookies. The client also clears the token from `localStorage`.

## Protected Routes

### Client-Side Protection

The React router checks authentication and onboarding status:

- **Public pages**: Home, Auth (callback), Onboarding — accessible without login
- **Protected pages**: All others (Visualizer, Curriculum, Exercise, Dashboard, etc.)
  - If not authenticated → redirect to Home
  - If authenticated but not onboarded → redirect to Onboarding

### Server-Side Protection

Routes use Fastify decorators:

```typescript
// Requires valid JWT
fastify.get("/endpoint", {
  preHandler: [fastify.authenticate],
}, handler);

// Requires valid JWT + specific role
fastify.post("/admin-endpoint", {
  preHandler: [fastify.authenticate, fastify.requireRole("admin")],
}, handler);
```

The `authenticate` decorator:
1. Extracts JWT from the `token` cookie
2. Verifies the signature and expiration
3. Attaches the decoded payload to `request.user`
4. Returns 401 if invalid

The `requireRole` decorator:
1. Checks `request.user.role` against the allowed roles
2. Returns 403 if the user's role is not in the list

## OIDC Provider

FireFly uses `ghcr.io/plainscope/simple-oidc-provider` in Docker Compose. This is a lightweight OIDC provider suitable for development.

**Configuration** (via docker-compose.yml environment):

| Variable | Value | Description |
|----------|-------|-------------|
| Port | 9000 | OIDC provider port |
| Client ID | `firefly` | Registered client |
| Client Secret | `firefly-secret` | Client authentication |

**Default User**:
- Email: `admin@localhost`
- Password: `Rays-93-Accident`

For production, replace with a proper OIDC provider (Auth0, Azure AD, Keycloak, etc.) by updating the `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `OIDC_REDIRECT_URI` environment variables.

## Security Details

### PKCE (Proof Key for Code Exchange)

PKCE prevents authorization code interception attacks:
- The server generates a random code verifier (128 bytes, base64url)
- Computes the SHA-256 code challenge
- Only the challenge is sent to the OIDC provider
- The verifier is stored server-side (Redis with 10-minute TTL)
- During code exchange, the verifier must match the challenge

### Cookie Security

| Attribute | Development | Production |
|-----------|------------|------------|
| `httpOnly` | `true` | `true` |
| `secure` | `false` | `true` |
| `sameSite` | `lax` | `lax` |
| `path` | `/` | `/` |

### Token Storage

- **Server side**: JWT tokens are set as httpOnly cookies (not accessible to JavaScript)
- **Client side**: The access token is also stored in `localStorage` for the API client to use
- The `localStorage` token is a convenience for the SPA — the httpOnly cookie is the authoritative session

## Related Documentation

- [Auth API Reference](../api/auth.md)
- [Backend Architecture](../architecture/backend.md)
- [Getting Started](./getting-started.md) — First login instructions
