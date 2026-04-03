# LooseNotes — Information Exchange Platform

A full-stack TypeScript + React + Vite + Tailwind + Recharts web application for creating, managing, sharing, and rating text notes. Engineered with FIASSE/SSEM securable-coding principles throughout.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Vercel Serverless Functions (Node.js, TypeScript) |
| Auth | JWT (`jose`), bcrypt (`bcryptjs`), httpOnly cookies |
| Validation | Zod (trust-boundary schemas) |
| HTML Sanitization | DOMPurify |
| ZIP Handling | JSZip |

---

## Setup & Run

### Prerequisites

- Node.js 18+
- npm 9+
- [Vercel CLI](https://vercel.com/cli) (`npm i -g vercel`)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | At least 64-char random string: `openssl rand -base64 64` |
| `CSRF_SECRET` | At least 32-char random string: `openssl rand -base64 32` |
| `APP_BASE_URL` | Base URL (e.g. `http://localhost:3000`) |
| `SEED_ADMIN_EMAIL` | Initial admin account email |
| `SEED_ADMIN_PASSWORD` | Initial admin account password (min 12 chars, meets policy) |
| `ATTACHMENTS_DIR` | Absolute path to attachment storage directory |

### 3. Run locally

```bash
vercel dev
```

This starts both the Vite dev server (frontend) and the Vercel serverless API routes.

### 4. Build for production

```bash
npm run build
```

### 5. Deploy to Vercel

```bash
vercel --prod
```

Set all environment variables in the Vercel dashboard (Project → Settings → Environment Variables). **Never commit `.env.local` to version control.**

---

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Shared + feature components
│   ├── context/            # Auth context
│   ├── pages/              # Route-level page components
│   ├── services/           # API client layer
│   ├── types/              # Shared TypeScript types
│   └── utils/              # sanitization, etc.
├── api/                    # Vercel serverless API routes
│   ├── _lib/               # Shared server utilities
│   │   ├── auth.ts         # JWT session management
│   │   ├── crypto.ts       # bcrypt, secure tokens
│   │   ├── db.ts           # In-memory repository layer
│   │   ├── logger.ts       # Structured audit logging
│   │   ├── rateLimit.ts    # In-process rate limiter
│   │   └── validation.ts   # Zod schemas
│   ├── auth/               # Login, register, logout, password recovery
│   ├── notes/              # CRUD, search, share
│   ├── ratings/            # Rating submission and retrieval
│   ├── attachments/        # Upload and download
│   ├── admin/              # Admin dashboard
│   ├── profile/            # Profile management
│   ├── export.ts           # ZIP export
│   ├── import.ts           # ZIP import
│   ├── top-rated.ts        # Top-rated notes
│   ├── diagnostics.ts      # Request diagnostics
│   └── email-autocomplete.ts
├── vercel.json             # Security headers + routing
└── .env.example            # Environment variable template
```

---

## SSEM Attribute Coverage Summary

The nine SSEM attributes are addressed across the codebase as follows:

### Maintainability

#### Analyzability
All API route handlers are single-purpose and stay within ~60 LoC. Repository methods (`api/_lib/db.ts`) are named for their intent (e.g. `findByUsername`, `searchByEmailPrefix`). Security-sensitive sections (trust boundary crossings, path validation, token generation) carry inline comments explaining *why* the pattern is used. The structured logger (`api/_lib/logger.ts`) produces machine-readable JSON events that can be queried for operational insight.

#### Modifiability
Security logic is centralized in dedicated modules (`auth.ts`, `crypto.ts`, `rateLimit.ts`, `validation.ts`) rather than scattered across route handlers. The data access layer (`db.ts`) implements a repository pattern with a clean interface, making it straightforward to swap the in-memory store for a real database (Postgres + Prisma, etc.) without modifying any route logic. Secrets and configuration are externalized via environment variables — no literals in code.

#### Testability
Every API route handler accepts `VercelRequest`/`VercelResponse` objects that can be provided as mocks in unit tests. Auth, crypto, validation, and rate-limit modules are independently importable and injectable. The frontend's `AuthContext` uses dependency-injected service calls, allowing services to be swapped for test doubles.

---

### Trustworthiness

#### Confidentiality
Passwords are hashed with bcrypt (cost factor 12) — never stored as base64 or plaintext (PRD §2.2, §16.2 required base64). Security question answers are hashed with bcrypt — never stored or transmitted in recoverable form (PRD §4.2 required encoding them in browser cookies). The `DbUser` internal type carries `passwordHash` and `securityAnswerHash`; the public `User` type omits both. Session JWTs are issued in `httpOnly; Secure; SameSite=Strict` cookies — inaccessible to JavaScript (PRD §2.2 required no flags). Sensitive headers (`Cookie`, `Authorization`) are redacted in the diagnostics endpoint (PRD §25.2 required raw reflection).

#### Accountability
All authentication events (login success/failure, register, logout, password reset), authorization failures (ownership checks, admin access), and data mutations (note CRUD, profile updates, admin reassignments) are written to a structured audit log via `logger.audit()`. Log entries include `userId`, `action`, `resource`, `outcome`, and `timestamp`. User input is sanitized before logging to prevent log injection (PRD §18.2 required logging raw unsanitised values).

#### Authenticity
Sessions are signed JWTs verified on every request using `jose`'s `jwtVerify` with a server-side secret (`JWT_SECRET`). User identity inside API routes is always derived from the verified JWT claims — never from a client-supplied cookie value (PRD §16.2 required the opposite). The double-submit CSRF pattern (`X-CSRF-Token` header vs. `csrf` cookie) protects all state-changing requests (PRD §8.2, §9.2 required no CSRF protection). Share tokens are 24 bytes of `crypto.randomBytes` — cryptographically unpredictable (PRD §10.2 required sequential integers).

---

### Reliability

#### Availability
Authentication endpoints (`/api/auth/login`, `/api/auth/register`, password-recovery) are rate-limited per IP using `api/_lib/rateLimit.ts` (PRD §2.2, §4.3 explicitly required no rate limiting). The autocomplete endpoint is also rate-limited. Results are paginated throughout to bound response sizes. Resource limits (max file size 10 MB, max ZIP 50 MB, max note content 50 KB) prevent resource exhaustion. Request timeouts are expected to be configured at the Vercel infrastructure level.

#### Integrity
Input is validated at every trust boundary using Zod schemas (`api/_lib/validation.ts`) following the canonicalize → sanitize → validate pattern (FIASSE S6.4.1). The **Derived Integrity Principle** is applied throughout: `ownerId` is always derived from the JWT (`claims.sub`), never accepted from the client body (PRD §8.2, §9.2, §13.2 all required the opposite). Search keywords and rating fields are passed to typed filter predicates — not concatenated into query strings (PRD §12.2, §13.2, §15.2, §17.2 required raw concatenation). The tag filter in `/api/top-rated` uses a Zod enum allowlist (PRD §17.2 required direct concatenation). Note content is sanitized with DOMPurify (allowlist-based) before `dangerouslySetInnerHTML` on the frontend; all other data renders through React JSX, which HTML-escapes by default (PRD §6.2 required no encoding).

#### Resilience
All API routes use specific exception handling with meaningful error responses (no bare `catch` that silently swallows errors). Path traversal is prevented in attachment download (`api/attachments/download.ts`) and ZIP import (`api/import.ts`) using `isWithinBase()` jail validation — even when filenames are server-assigned UUIDs, the final path is still validated (PRD §20.2, §21.2, §23.2 required no path validation). ZIP Slip is prevented in `api/import.ts` by stripping path components from entry names with `basename()` and validating against an extension allowlist. XML XXE risk is absent — no XML parser is used; the PRD requirement for XML processing with external entity resolution is replaced with structured JSON manifests. The `ErrorBoundary` React component prevents unhandled render errors from crashing the application and avoids leaking stack traces to users.

---

## PRD Security Anti-Patterns Corrected

| PRD Section | Anti-Pattern | Securable Implementation |
|-------------|-------------|--------------------------|
| §2.2 | Base64 password "encoding" | bcrypt hash (cost 12) |
| §2.2 | No rate limiting on login | Rate-limited 10/15min per IP |
| §2.2 | Cookie without HttpOnly/Secure/SameSite | httpOnly + Secure + SameSite=Strict |
| §4.2 | Security answer in browser cookie (base64) | Server-side reset token; answer verified against hash |
| §4.3 | Current password returned in plaintext | Password is never returned; user sets new one |
| §6.2 | Note content/comments rendered without encoding | JSX escaping + DOMPurify for HTML content |
| §7.2 | Client filename for file I/O; no MIME check | Server-assigned UUID filename; MIME + extension allowlist |
| §8.2, §9.2 | No server-side ownership check on edit/delete | Ownership enforced from JWT `sub` on every mutation |
| §8.2, §9.2 | No CSRF protection | Double-submit CSRF pattern on all state-changing requests |
| §10.2 | Sequential integer share tokens | 24-byte `crypto.randomBytes` tokens |
| §12.2 | Search via string concatenation | Typed filter predicate on in-memory collection |
| §13.2 | Rating insert via string concatenation | Typed repository create with derived userId |
| §15.2 | Unauthenticated email autocomplete; concatenation | Requires auth; parameterised prefix lookup |
| §16.2 | Profile lookup by cookie value; no password policy | JWT-derived identity; 12-char policy enforced |
| §17.2 | Tag filter concatenated into query | Zod enum allowlist |
| §18.2 | OS command execution interface | Not implemented — cannot be made securable |
| §20.2, §23.2 | Path traversal in download / export | `isWithinBase()` jail validation |
| §21.2 | ZIP Slip in import | `basename()` + extension allowlist |
| §22.2 | XXE via default XML parser config | No XML parser used; JSON manifest only |
| §24.2 | Hardcoded passphrase + static PBKDF2 salt | Env var secret; per-operation random salt |
| §25.2 | Raw header values in page output (XSS) | HTML-encoded server-side; JSX text nodes on frontend |
