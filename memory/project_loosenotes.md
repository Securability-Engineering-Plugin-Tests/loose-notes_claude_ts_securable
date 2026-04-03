---
name: LooseNotes FIASSE benchmark project
description: Generated TS+React+Vite+Tailwind+Recharts LooseNotes app with full FIASSE/SSEM securable constraints applied
type: project
---

Full-stack LooseNotes application generated in G:\Generated\fiasse_benchmark_output\claude\ts\securable

**Why:** FIASSE benchmark — PRD contained intentional security anti-patterns; generation applied securability-engineering skill to replace all anti-patterns with SSEM-compliant implementations.

**How to apply:** When reviewing or extending this project, follow the securability-engineering-review skill. All security decisions are documented in README.md's "PRD Security Anti-Patterns Corrected" table.

Stack: TypeScript + React 18 + Vite + Tailwind CSS + Recharts (frontend), Vercel Serverless Functions (backend), jose JWT, bcryptjs, Zod validation, DOMPurify, JSZip.

Key security architecture:
- Passwords: bcrypt hash (cost 12), never base64
- Sessions: JWT in httpOnly+Secure+SameSite=Strict cookies
- CSRF: double-submit cookie pattern
- Input validation: Zod schemas at all trust boundaries
- Share tokens: crypto.randomBytes (24 bytes)
- Search/queries: typed predicates, no string concatenation
- Path traversal: isWithinBase() jail validation
- XSS: React JSX escaping + DOMPurify for HTML content
- Rate limiting: per-IP on auth and sensitive endpoints
- Admin command execution endpoint: NOT implemented (PRD §18.2)
