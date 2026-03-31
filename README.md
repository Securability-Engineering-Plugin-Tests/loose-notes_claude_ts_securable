# Loose Notes

A full-stack multi-user note-taking web application built with TypeScript, React, Vite, Tailwind CSS, and Recharts. Deployed on Vercel using serverless API routes.

## Features

- **Authentication** — Register, login, logout, password reset via time-limited tokens
- **Notes** — Create, edit, delete notes with public/private visibility
- **Search** — Full-text search across public notes and your own private notes
- **Ratings** — Rate notes 1–5 stars with optional comments
- **Sharing** — Generate unique share links for notes (no auth required to view)
- **Top Rated** — Browse highest-rated public notes (minimum 3 ratings)
- **Admin Dashboard** — User management, activity audit log, Recharts analytics
- **Profile** — Update username, email, and password

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Recharts 2, Zustand 4, React Router 6 |
| Backend | Vercel serverless functions (Node.js), TypeScript |
| Auth | JWT via `jose`, httpOnly cookies |
| Validation | Zod (shared client + server) |
| Passwords | bcryptjs (cost factor 12) |

## Setup & Running

### Prerequisites

- Node.js 18+
- npm or pnpm

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Edit .env.local — set a strong JWT_SECRET (32+ chars)

# 4. Start Vite dev server (frontend only)
npm run dev
# App runs at http://localhost:5173

# 5. For full-stack local dev with API routes, use Vercel CLI:
npm install -g vercel
vercel dev
# App runs at http://localhost:3000
```

### Build & Deploy

```bash
# Build production frontend bundle
npm run build

# Deploy to Vercel
vercel deploy
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing secret — minimum 32 random chars |
| `JWT_EXPIRES_IN` | No | Token lifetime, default `7d` |
| `PASSWORD_RESET_EXPIRES` | No | Reset token TTL in seconds, default `3600` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `NODE_ENV` | No | `production` enables Secure cookie flag |

### Demo Credentials

The app is seeded with demo data on startup:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin123!` | Admin |
| `alice` | `Alice123!` | User |
| `bob` | `Bob12345!` | User |

> **Note**: The in-memory store resets on each serverless function cold start. For production, replace `api/_lib/store.ts` with a real database (Vercel Postgres, PlanetScale, Supabase, etc.).

---

## SSEM Attribute Coverage Summary

The nine SSEM attributes are organized across three pillars. Here's how each is addressed:

### Maintainability Pillar

#### Analyzability
Code is structured for low cognitive overhead:
- All functions are ≤ 30 LoC with cyclomatic complexity < 10
- Single-responsibility components and services — each file does one thing
- API route handlers are thin: validate → authorize → call store → respond
- Trust boundaries are explicitly commented (`// Trust boundary: validate at entry`)
- `api/notes/_noteHelpers.ts` centralizes note-to-response mapping to eliminate duplication
- Discriminated union types (`ApiResponse<T>`, `AuditAction`) make data flow self-documenting

#### Modifiability
The data layer is cleanly separated from business logic:
- `api/_lib/store.ts` is the sole data access module — swap it for a real DB without touching route logic
- Validation schemas in `src/utils/validation.ts` and `api/_lib/validate.ts` are centralized, not scattered
- Security controls (JWT, rate limiting, CORS) live in dedicated `api/_lib/` modules
- Frontend services (`src/services/`) decouple React components from API implementation details
- Configuration is externalized to environment variables (JWT secret, allowed origins, TTLs)

#### Testability
Every layer is injectable and testable in isolation:
- `useApi(asyncFn)` hook accepts any async function — mock services without touching components
- `useFormValidation(schema)` is a pure hook — pass any Zod schema, test independently
- API route handlers receive `VercelRequest`/`VercelResponse` — easily stubbed in unit tests
- Store operations (`userStore`, `noteStore`, etc.) are plain functions on exported objects
- `audit()` in `api/_lib/audit.ts` is non-throwing and mockable

---

### Trustworthiness Pillar

#### Confidentiality
Sensitive data is classified and protected at every layer:
- `passwordHash` field lives only in `UserRecord` (server-side only) — the `User` type exported to the client never includes it
- JWT secrets come from environment variables only — never hardcoded
- Logs use structured JSON and explicitly avoid logging passwords, tokens, or PII (`logger.ts` comment: "CRITICAL: Never log passwords, tokens, or PII")
- httpOnly cookies prevent JavaScript access to auth tokens (XSS mitigation)
- Error responses return generic messages for auth failures to prevent enumeration
- Data minimization: API responses include only the fields the caller needs

#### Accountability
Every security-sensitive action produces an audit trail:
- `api/_lib/audit.ts` records: who (`userId`, `username`), what (`AuditAction`), when (`timestamp`), where (`ipAddress`), and outcome (`success`/`failure`)
- All auth events are logged: `user.register`, `user.login`, `user.login_failed`, `user.logout`, `user.password_reset_*`
- All admin actions are logged: `admin.view_users`, `admin.reassign_note`
- Authorization failures are logged with `outcome: 'failure'`
- Audit log is append-only (entries are never modified)
- Admin dashboard surfaces the last 20 audit events via Recharts + table

#### Authenticity
Authentication uses established mechanisms with proper validation:
- Passwords hashed with bcrypt at cost factor 12 (ASVS V2.4 compliant)
- JWT tokens signed with HS256 via `jose` (standards-compliant RFC 7519)
- Token verification in `verifyToken()` returns `null` on any failure — no detail leaked to caller
- Timing-safe bcrypt comparison runs even when user doesn't exist (prevents username enumeration)
- JWT extracted from both `Authorization: Bearer` header and httpOnly cookie — dual-channel resilience
- `requireAuth()` and `requireAdmin()` centralize all auth checks — no ad-hoc checks scattered in routes
- Password reset tokens are 256-bit random values (32 bytes hex), expire after 1 hour, invalidated on use

---

### Reliability Pillar

#### Availability
Resource limits and circuit-breakers prevent DoS conditions:
- In-memory rate limiter in `api/_lib/cors.ts` limits auth endpoints to 10 requests per 15-minute window per IP
- Audit log capped at 1000 in-memory entries to prevent unbounded growth
- Request body size validated by Zod schemas (title ≤ 200, content ≤ 50,000, comment ≤ 1000 chars)
- Password max length 128 chars prevents bcrypt DoS via oversized inputs
- Search query sanitized and capped at 200 chars before processing
- Frontend `useApi` hook cancels requests when components unmount (prevents memory leaks)
- AbortSignal support in `apiRequest()` for request cancellation

#### Integrity
Input is validated at every trust boundary using the canonicalize → sanitize → validate pattern:
- `src/utils/sanitize.ts` implements `canonicalize()` (NFC normalization + trim) → `sanitizeText()` (HTML escape) → validation via Zod
- `api/_lib/validate.ts` applies Zod schemas server-side at each route entry point
- All Vercel route handlers call `parseBody()` before touching `req.body` — no raw input ever processed directly
- URL parameters extracted with explicit type checks: `typeof req.query.id === 'string' ? req.query.id : null`
- **Derived Integrity Principle**: server-owned state (ownerId, role, createdAt) is never accepted from client input — derived server-side only
- **Request Surface Minimization**: route handlers extract only the fields defined in their Zod schema
- Output is always plain text rendered via React's default text escaping — no `dangerouslySetInnerHTML`
- SQL injection is N/A (no SQL) but parameterized-equivalent pattern applied: no string concatenation in queries

#### Resilience
The codebase is defensively structured against unexpected conditions:
- Specific error handling everywhere — `ApiError` class in services, typed `ZodError` in validators
- `audit()` is wrapped in try/catch — audit failure never blocks the business operation
- `verifyToken()` catches all JWT exceptions and returns `null` — callers don't need to know why it failed
- `useApi` hook catches all async errors and surfaces them as user-friendly strings
- Frontend components handle `null`/`undefined` data via loading states and empty states
- `onRehydrateStorage` in Zustand safely handles missing/corrupt persisted auth state
- `createRoot()` in `main.tsx` throws a clear error if the DOM root element is missing
- Cascade deletes on note deletion: ratings, attachments, and share links cleaned up atomically

---

## Project Structure

```
.
├── api/                        # Vercel serverless API routes
│   ├── _lib/                   # Shared API utilities
│   │   ├── audit.ts            # Structured audit logging
│   │   ├── auth.ts             # JWT helpers, cookie management
│   │   ├── cors.ts             # CORS, security headers, rate limiter
│   │   ├── store.ts            # In-memory data store (replace for production)
│   │   ├── types.ts            # Server-only types (UserRecord with passwordHash)
│   │   └── validate.ts         # Zod-based request body validation
│   ├── auth/                   # Auth endpoints
│   ├── notes/                  # Notes CRUD + search + top-rated + sharing
│   ├── ratings/                # Note rating endpoint
│   ├── share/                  # Public share link endpoint
│   ├── admin/                  # Admin dashboard, users, reassign
│   └── profile.ts              # User profile GET/PUT
├── src/
│   ├── types/index.ts          # All domain + API types
│   ├── utils/                  # cn, logger, sanitize, validation schemas
│   ├── services/               # API client wrappers (authService, notesService, etc.)
│   ├── store/                  # Zustand stores (authStore, toastStore)
│   ├── hooks/                  # useAuth, useApi, useFormValidation
│   ├── components/
│   │   ├── layout/             # Layout, Navbar, ProtectedRoute
│   │   ├── ui/                 # Button, Input, Modal, Alert, StarRating, Toast, etc.
│   │   ├── notes/              # NoteCard, NoteForm, RatingForm
│   │   └── charts/             # Recharts wrappers (NotesByDayChart, RatingDistributionChart)
│   ├── pages/                  # Route-level page components
│   └── router/index.tsx        # React Router route tree
├── vercel.json                 # Routing + security headers
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Security Notes

- **Production data**: Replace `api/_lib/store.ts` with a real database. The in-memory store is for demonstration only.
- **JWT secret**: Set `JWT_SECRET` to a cryptographically random value of at least 32 characters.
- **Email**: Implement a real email provider in `api/auth/forgot-password.ts` (replace the console.info dev log).
- **File uploads**: The attachment API (`api/attachments/`) validates MIME type and size but stores metadata only. Integrate with Vercel Blob, S3, or similar for actual file storage.
- **HTTPS**: Vercel enforces HTTPS in production — the `Secure` cookie flag is set automatically when `NODE_ENV=production`.
