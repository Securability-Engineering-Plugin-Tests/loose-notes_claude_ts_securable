# LooseNotes — Securable Edition

A working implementation of the LooseNotes Information Exchange Platform built **against** the LooseNotes PRD: every requirement that specified an insecure pattern has been re-engineered using FIASSE v1.0.4 SSEM constraints. The application is a TypeScript + React + Vite + Tailwind + Recharts SPA backed by Vercel serverless functions.

This README has three parts:

1. [Setup and run](#setup-and-run)
2. [SSEM attribute coverage](#ssem-attribute-coverage)
3. [PRD-to-securable rejection map](#prd-to-securable-rejection-map) — what changed and why

---

## Setup and run

### Prerequisites

- Node.js **20.10+** (the @vercel/node runtime targets Node 20)
- npm 10+
- (For full local dev) the [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`

### 1. Install

```bash
npm install
```

### 2. Configure secrets

Copy `.env.example` to `.env.local` and fill in the three required secrets:

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
# paste the value into SESSION_SECRET, then re-run for SESSION_RESET_SECRET and APP_DATA_KEY
```

For local HTTP development set `COOKIE_SECURE=false`. For Vercel deployments leave `COOKIE_SECURE=true` (the default).

To create a first administrator account on cold start, set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD`. The password is hashed in memory immediately and never persisted in plaintext form. **Rotate via /profile after first login**, then unset both env vars.

### 3. Run

Two options:

**Full-stack local dev (recommended)** — runs both the SPA and the serverless functions on a single port (3000):

```bash
vercel dev
```

Open http://localhost:3000.

**Frontend-only dev** — Vite only (5173) with the API proxied to a separately-running `vercel dev`:

```bash
# Terminal A
vercel dev
# Terminal B
npm run dev
```

Open http://localhost:5173.

### 4. Build

```bash
npm run typecheck   # tsc -b --noEmit
npm run build       # Vite production bundle into dist/
```

### 5. Deploy

Push to the linked Vercel project, or `vercel --prod`. The `vercel.json` file pins the function runtime, memory budget, and security response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

### Smoke-test the demo

1. Sign up with a 12+ character password.
2. Create a note. Toggle it public. Rate it. Generate a share link.
3. Open the share link in a private window — it loads without auth and expires automatically.
4. Try `/api/notes/123-not-real` directly — returns 404.
5. Try `PUT /api/notes/<id>` — returns 405 with `Allow: GET, PATCH, DELETE`.
6. Try a `<script>` tag in a note title — it is stripped on save and rendered as text.
7. With BOOTSTRAP_ADMIN_*, sign in as admin and visit `/admin` for the Recharts dashboard.

> **Storage caveat (S3.2.3.1 Availability trade-off):** the demo uses an in-process map. State does not survive a serverless cold start. To deploy for real traffic, replace the implementation behind `api/_lib/db.ts`'s exported functions with a real backing store (Vercel Postgres, Neon, etc.). The interface boundary is the only place that needs to change.

---

## SSEM attribute coverage

FIASSE v1.0.4 defines ten attributes across three pillars. This section documents how each is addressed in the generated code.

### Maintainability

#### Analyzability (S3.2.1.1)

- **Single-purpose modules.** `api/_lib/` separates concerns: `crypto.ts`, `session.ts`, `db.ts`, `errors.ts`, `logger.ts`, `ratelimit.ts`, `request.ts`, `sanitize.ts`, `schemas.ts`, `views.ts`. Each has one reason to change.
- **Short functions.** Handlers split read/create/update/delete into named functions (e.g., `api/notes/[id].ts:read|update|remove`). No function exceeds ~30 LoC.
- **Descriptive naming.** `findNoteForOwner` and `findNoteForViewer` make the access-control axis visible at the call site. `requireAdmin`, `enforceOrigin`, `requireMethod` read like preconditions.
- **No dead branches.** Every error path goes through the same `AppError` → `sendError` flow.

#### Modifiability (S3.2.1.2)

- **No static mutable state in module scope.** State is encapsulated either inside the data-store module behind named functions (with a single `globalThis` cell so it survives HMR), or per-request in handler closures.
- **Configuration externalized.** All secrets and tunables live in env vars (`api/_lib/config.ts`); fail-closed if absent in production.
- **Centralized security primitives.** Hashing, token generation, AES, and constant-time compare live exclusively in `api/_lib/crypto.ts`. Auth gates live exclusively in `api/_lib/auth.ts`. The frontend talks to one HTTP seam: `src/lib/api.ts`.
- **Interface-first storage.** Replacing `db.ts` with a Postgres adapter requires no changes to handlers.

#### Testability (S3.2.1.3)

- **Pure schema validation.** Every body is validated through a `z.*` schema in `api/_lib/schemas.ts`. Schemas are referenceable by tests in isolation.
- **Predicate-style data access.** `searchNotes`, `findNoteForOwner`, `topRatedPublicNotes` accept typed inputs and return typed outputs — no DOM or framework coupling.
- **Boundary-only side effects.** `hashPassword`, `aesEncrypt`, `verifyPassword` are deterministic except for randomness; the random parts are read from `node:crypto` and can be wrapped if a test needs determinism.
- **Frontend hooks are testable.** `useAuth` reads from a context; consumers can be tested with a mock provider.

#### Observability (S3.2.1.4)

- **Structured logging built in, not bolted on.** `api/_lib/logger.ts` emits one JSON line per event with stable field names (`event`, `level`, `requestId`, `actorId`, ...). Sensitive keys are redacted at write time.
- **Boundary events.** Every state-changing handler appends an entry to the audit log via `appendAudit` (login, register, note CRUD, rating, share-create, share-read, attachment up/download, admin actions, profile change).
- **Per-request correlation.** Every response carries an `X-Request-Id`; the SPA surfaces it in the user-facing error banner so a user can quote a trace ID without us echoing internals.
- **Operator dashboard.** `/admin` exposes counts, a 14-day notes-per-day Recharts visualization, and the latest 50 audit events.

### Trustworthiness

#### Confidentiality (S3.2.2.1)

- **No secrets in code.** Reset/session/AES keys are env-vars only; `config.ts` fails closed in production if any are missing.
- **No plaintext credentials.** Passwords are scrypt-hashed (per-user salt). Reset tokens are stored as their HMAC, not the raw token.
- **Projected views.** Outbound JSON goes through `views.ts`; no handler returns the underlying user record. `passwordHash` is structurally absent from `UserView`.
- **Sensitive headers redacted.** `/api/diagnostics` strips `Authorization`, `Cookie`, `Set-Cookie`, `x-real-ip`, `x-forwarded-for` before responding.
- **Uniform error responses on auth.** Login, register, and reset flows return the same response shape regardless of whether the account exists, blocking enumeration.

#### Accountability (S3.2.2.2)

- **Append-only audit log.** Every security-significant action records `actorId`, `event`, `outcome` (`allow`/`deny`/`error`/`info`), and per-event `context`. The log is exposed to admins in the dashboard.
- **No PII in audit events.** The structured logger redacts password/token/cookie keys before writing; reviewer can confirm by reading `api/_lib/logger.ts:REDACTED_KEYS`.
- **Outcome-coded events.** `note.update` records noteId; `auth.login.failed` records the username attempted but never the password tried.

#### Authenticity (S3.2.2.3)

- **scrypt + per-user salt.** `hashPassword`/`verifyPassword` (`api/_lib/crypto.ts`) — N=2^15 cost, 64-byte digest, constant-time compare via `timingSafeEqual`.
- **Signed JWT sessions.** HS256 over a 256-bit env-derived secret; `iss`, `aud`, `iat`, `exp` claims are all set and verified explicitly. Algorithm is pinned at verify time (algorithm-confusion attack mitigation).
- **`__Host-` prefix cookie.** HttpOnly, Secure, SameSite=Strict, Path=/, no Domain.
- **Origin enforcement on writes.** Every state-changing handler invokes `enforceOrigin`, which compares the request's Origin/Referer to a configured allow-list — defense-in-depth on top of SameSite=Strict.
- **Method allow-list.** `requireMethod` denies any HTTP verb not explicitly listed (rejecting the PRD §18 verb-tampering pattern).
- **Constant-time login timing.** Login still pays the scrypt cost when the username is unknown, defeating timing-based account enumeration.

### Reliability

#### Availability (S3.2.3.1)

- **Resource caps.** `config.limits` defines `maxBodyBytes` (1 MB), `maxAttachmentBytes` (5 MB), `maxNotesPerUser` (500), `maxAttachmentsPerUser` (50). Body readers honor them with explicit `payload_too_large` responses.
- **Token-bucket rate limits.** `api/_lib/ratelimit.ts` provides per-IP and per-account buckets for login, register, reset request/confirm, search, write, upload, share creation, and admin actions.
- **Function timeouts.** `vercel.json` pins each function to 10s and 256 MB so a stuck handler does not consume the whole quota.
- **Timing-equalised auth.** Reduces the cost of attackers using login as a pivot to enumerate users.
- **Cleanup of rate-limit map.** Bucket map self-prunes when it exceeds 10k entries, preventing memory growth.

#### Integrity (S3.2.3.2)

- **Canonicalize → sanitize → validate.** Every body and query parameter is parsed through a zod schema in `api/_lib/schemas.ts` with `.strict()` (unknown fields rejected). Strings are trimmed, lower-cased where appropriate, and constrained by regex.
- **Request Surface Minimization (S4.4.1.1).** `UpdateProfileSchema` excludes `id` and `role` so a client cannot promote itself by spreading a payload.
- **Derived Integrity (S4.4.1.2).** Every authorization decision is derived from the verified session subject — never from a client-supplied user-id cookie or body field.
- **No string-built queries.** The data store is a typed in-memory layer; there is no query language to inject into. The same call sites would map directly to a parameterized SQL adapter.
- **Output sanitization.** `stripHtml` runs both at write time and at view-projection time, defense-in-depth against the PRD §6 "insert directly into HTML" pattern. React's default text escaping provides a third layer.
- **Allow-list filters.** `TopRatedSchema.region` is `enum(['global','recent'])` — unknown values cannot reach the data layer.

#### Resilience (S3.2.3.3)

- **Specific exception types.** `AppError` carries a stable `code` and `publicMessage`. Bare `try/catch` is absent except at the top of `handler()`, where unknown errors are converted to a generic 500 + structured log entry.
- **Fail-closed on missing config.** `readSecret` throws at module load in production if a required secret is absent.
- **Bounded body reads.** Streams reject early on size overflow; abort flag prevents continued chunk accumulation.
- **Defensive cookie parsing.** Multiple cookie names tried; case-sensitive match per RFC 6265; trim whitespace.
- **Defensive multipart parser.** Accepts boundary parameters with quotes/whitespace; rejects malformed structure with a typed error.
- **Determinism in tests.** All randomness flows through `node:crypto` and is wrappable.

---

## PRD-to-securable rejection map

The LooseNotes PRD specified anti-patterns in many sections. Each row below names the anti-pattern, marks it `REJECTED`, and points to the file(s) implementing the securable equivalent.

| PRD § | Anti-pattern specified                                             | Status   | Securable replacement |
|------:|--------------------------------------------------------------------|----------|-----------------------|
| 1.2   | Pre-seeded credentials embedded in app config                      | REJECTED | `api/_lib/db.ts:bootstrapIfNeeded` — opt-in env-var bootstrap, hashed at memory; no plaintext footprint |
| 1.2   | Distinct error message for username vs email collision             | REJECTED | `api/auth/register.ts` — uniform 409 response, structured log captures the detail |
| 2.2   | Base64 "encoded" passwords; string-equality compare                | REJECTED | `api/_lib/crypto.ts:hashPassword/verifyPassword` — scrypt + `timingSafeEqual` |
| 2.2   | No rate limit, lockout, or challenge after failed login            | REJECTED | `api/auth/login.ts` + `api/_lib/ratelimit.ts` — per-IP and per-account token buckets |
| 2.2   | 14-day persistent cookie, no HttpOnly/Secure/SameSite              | REJECTED | `api/_lib/session.ts` — 1-hour signed JWT in `__Host-` cookie, HttpOnly, Secure, SameSite=Strict |
| 3.2   | Plaintext security answer storage                                  | REJECTED | Recovery flow does not use security questions; uses one-time HMAC-stored reset tokens |
| 4.2   | Email-existence enumeration on reset request                       | REJECTED | `api/auth/reset-request.ts` — uniform response regardless of match |
| 4.2   | Security answer placed in client cookie as Base64 + transmitted unsigned | REJECTED | Server-side reset-token table; `api/_lib/db.ts:createResetToken` |
| 4.3   | Plaintext password returned to user                                | REJECTED | Plaintext is not stored; reset issues new password via authenticated flow |
| 4.3   | No rate-limit / lockout on answer submission                       | REJECTED | `limits.resetConfirm` token bucket |
| 6.2   | Note title/content rendered without encoding                       | REJECTED | `api/_lib/sanitize.ts:stripHtml` at storage AND view projection; React text escaping at render |
| 6.2   | Rating comments rendered without encoding                          | REJECTED | Same as 6.2 — `views.ts:ratingView` strips HTML |
| 7.2   | Save uploaded file with client-supplied filename in webroot        | REJECTED | `api/attachments/index.ts` — server-generated UUID storage name; bytes held outside webroot |
| 7.2   | No extension/MIME/content inspection                               | REJECTED | Allow-listed MIME types + magic-byte sniffing; declared vs sniffed mismatch rejected |
| 8.2   | Edit handler does not verify ownership                             | REJECTED | `api/notes/[id].ts:update` → `findNoteForOwner` |
| 8.2   | No CSRF token on state-changing POSTs                              | REJECTED | SameSite=Strict cookie + `enforceOrigin` Origin/Referer check |
| 9.2   | Delete handler does not verify ownership                           | REJECTED | `api/notes/[id].ts:remove` → `findNoteForOwner` |
| 10.2  | Sequential / non-cryptographic share tokens                        | REJECTED | `randomToken(32)` — 256-bit values from `node:crypto.randomBytes` |
| 11.2  | Private-note exclusion via filter predicate, not row access        | REJECTED | Row-level access in `api/_lib/db.ts:findNoteForViewer/searchNotes` |
| 12.2  | Search keyword concatenated into query string                      | REJECTED | Typed predicate over typed records; no query string at all |
| 13.2  | Rating insertion via string concatenation                          | REJECTED | Typed `createRating` |
| 14.2  | Rating display without encoding                                    | REJECTED | `ratingView` strips HTML; React renders as text |
| 15.2  | Email autocomplete: anonymous, unparameterized, no rate limit      | REJECTED | `api/users/autocomplete.ts` — auth required; allow-listed prefix shape; per-user rate limit; minimal disclosure scope |
| 16.2  | Profile id read from a separate user-id cookie, no auth check      | REJECTED | `api/users/me.ts` derives identity from signed session subject |
| 16.2  | Profile response includes credential fields                        | REJECTED | `userView` projects only safe fields |
| 16.2  | Password change with no policy / no current-password proof         | REJECTED | `Password` schema enforces ≥12 chars; `currentPassword` required to change |
| 16.2  | Passwords stored Base64                                            | REJECTED | scrypt — see 2.2 |
| 17.2  | Top-rated filter concatenated, no allow-listing                    | REJECTED | `TopRatedSchema.region` is enum; unknown values rejected |
| 18.2  | Verb allow-list lists only GET/POST; handler ignores method        | REJECTED | `requireMethod(['GET','POST',...])` — explicit deny-by-default |
| 18.2  | Admin shell command execution                                      | REJECTED | Endpoint not implemented. Operating-system access is out of scope of any user-facing surface. |
| 18.2  | Admin DB-reinit endpoint                                           | REJECTED | Endpoint not implemented. Database lifecycle belongs to ops/IaC. |
| 18.2  | Logs include unsanitized user values                               | REJECTED | `logger.ts:REDACTED_KEYS` redacts secrets, bodies, tokens |
| 19.2  | Reassign without admin role check                                  | REJECTED | `api/admin/reassign.ts:requireAdmin`; audit-logged |
| 20.2  | Path-traversal-vulnerable export                                   | REJECTED | Endpoint not implemented. Securable design: use only the storage UUID, never user-supplied path components. |
| 21.2  | Path-traversal-vulnerable import                                   | REJECTED | Endpoint not implemented. Securable design: validate every archive entry name against an allow-list pattern, resolve against the base directory, reject if not contained. |
| 22.2  | XML processing with default XXE-enabled parser                     | REJECTED | XML processing is not implemented. The export/import schema is JSON-only. |
| 23.2  | Download by user-supplied filename, no path-containment check      | REJECTED | `api/attachments/[id].ts` — UUID lookup in an in-memory map; no path concat exists in the code path |
| 23.2  | "File not found" page reflects unsanitized filename                | REJECTED | Errors return JSON; React renders all text safely |
| 24.2  | Hardcoded fallback passphrase                                      | REJECTED | `aesEncrypt`/`aesDecrypt` require a passphrase Buffer parameter; throw on absence |
| 24.2  | Constant PBKDF2 salt for all operations                            | REJECTED | New 16-byte random salt per encryption; stored in the v1 envelope alongside IV/tag |
| 25.2  | Diagnostics page reflects raw headers without encoding             | REJECTED | `api/diagnostics.ts` returns JSON; sensitive headers redacted; admin-only |

### Endpoints intentionally not implemented (with rationale)

Three feature classes from the PRD are not shipped because their securable analogues require deployment-specific decisions (data store, file storage, email service) that vary by environment:

1. **Bulk export / import (PRD §20, §21).** Securable scaffolding would: validate every archive entry against `^[A-Za-z0-9._-]{1,128}$`; resolve each entry against `path.resolve(base)` and reject if the result does not start with `path.resolve(base) + path.sep`; cap archive size and entry count; reject DEFLATE bombs by tracking decompressed bytes.
2. **System-level command execution (PRD §18.2).** Not appropriate for any user-facing endpoint. If admin shell access is needed, expose it through a separately-authorized operations channel (kubectl, SSH bastion) — never through the web tier.
3. **XML / XXE-prone parsing (PRD §22.2).** JSON is sufficient for the export schema and is not subject to XXE. If XML must be supported, instantiate the parser with `disableExternalEntities`, `disallowDTD`, and a max-depth limit.

The README, audit-log entries, and inline comments name these explicitly so a reader understands the rejection is deliberate, not an oversight.

---

## Project layout

```
.
├── api/                      Vercel serverless functions
│   ├── _lib/                 Cross-cutting modules (auth, crypto, db, logger, ratelimit, ...)
│   ├── auth/                 register / login / logout / me / reset-request / reset-confirm
│   ├── notes/                index (search/create) / [id] (read/update/delete) / share / rate / top
│   ├── shared/               [token] — public share-token reader
│   ├── users/                me (profile) / autocomplete (auth + allow-listed)
│   ├── attachments/          index (upload) / [id] (download)
│   ├── admin/                users / stats / reassign
│   └── diagnostics.ts        Admin-only request introspection
├── src/                      React SPA
│   ├── components/           Layout, ProtectedRoute, NoteCard, RatingChart, ErrorBanner
│   ├── lib/                  api.ts (typed HTTP), auth.tsx (context)
│   ├── pages/                Home, Login, Register, Notes, NoteDetail, NewNote, EditNote,
│   │                          Profile, Admin, SharedNote, ResetPassword, NotFound
│   ├── App.tsx               Routes
│   └── main.tsx              Entry
├── public/favicon.svg
├── index.html                Vite root
├── vercel.json               Function runtime + security response headers (CSP, HSTS, ...)
├── vite.config.ts            Vite + dev proxy to /api
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## License

Demonstration code released under the same CC-BY-4.0 license as the FIASSE framework.

## References

- [FIASSE v1.0.4](https://github.com/Xcaciv/securable_software_engineering/blob/v1.0.4/docs/securable_framework.md)
- OWASP ASVS 5.0 — chapter mapping referenced inline at boundary handlers (V2 Authentication, V3 Session Management, V4 Access Control, V5 Validation/Sanitization/Encoding, V7 Errors/Logging, V12 Files/Resources, V13 API/Web Service)
- NIST SP 800-63B §5.1.1.2 — password policy guidance (no composition rules; 12-char minimum)
- RFC 6265 — HTTP cookies; RFC 6266 — Content-Disposition; RFC 6749/6750/7235 — Bearer tokens
