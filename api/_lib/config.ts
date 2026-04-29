/**
 * Centralized configuration loaded from environment variables.
 *
 * FIASSE: secrets are never embedded in source (S3.2.2.1 Confidentiality);
 * configuration is externalized (S3.2.1.2 Modifiability). Failure to supply
 * required secrets causes a fail-closed startup error rather than silent
 * defaults — this preserves Authenticity of the deployment (S3.2.2.3).
 */

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

function readSecret(name: string, minBytes = 32): Buffer {
  const raw = process.env[name];
  if (!raw || raw.startsWith('replace-me')) {
    if (isProduction) {
      throw new Error(`Required environment variable ${name} is missing or unset`);
    }
    // Dev fallback: derive a deterministic-but-isolated key per process so
    // auth still works locally without burning a real secret. NEVER ships to prod.
    const devSeed = `dev-only:${name}:${process.pid}`;
    return Buffer.from(devSeed.padEnd(minBytes, '0').slice(0, minBytes));
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64url');
  } catch {
    throw new Error(`${name} must be base64url-encoded`);
  }
  if (buf.length < minBytes) {
    throw new Error(`${name} must decode to at least ${minBytes} bytes`);
  }
  return buf;
}

function readOrigins(): readonly string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/\/$/, ''));
}

export const config = {
  isProduction,
  sessionSecret: readSecret('SESSION_SECRET'),
  resetSecret: readSecret('SESSION_RESET_SECRET'),
  appDataKey: readSecret('APP_DATA_KEY'),
  cookieSecure: (process.env.COOKIE_SECURE ?? 'true').toLowerCase() !== 'false',
  allowedOrigins: readOrigins(),
  logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  bootstrapAdmin: {
    username: process.env.BOOTSTRAP_ADMIN_USERNAME?.trim() || null,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || null,
  },
  // Operational limits — chosen to fit within Vercel's 256MB function memory.
  limits: {
    maxBodyBytes: 1024 * 1024,         // 1 MB JSON / form bodies
    maxAttachmentBytes: 5 * 1024 * 1024, // 5 MB per attachment
    maxAttachmentsPerUser: 50,
    maxNotesPerUser: 500,
    sessionTtlSeconds: 60 * 60,        // 1 hour
    sessionRefreshTtlSeconds: 60 * 60 * 24 * 7, // 7 days
    resetTokenTtlSeconds: 15 * 60,     // 15 minutes
    shareTokenBytes: 32,               // 256-bit share tokens
  },
} as const;
