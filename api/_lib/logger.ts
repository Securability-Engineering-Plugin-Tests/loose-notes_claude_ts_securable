/**
 * Structured logger with secret redaction.
 *
 * FIASSE: code-level instrumentation built in, not bolted on (S3.2.1.4
 * Observability). Emits one JSON object per line with a stable schema so
 * downstream tooling can parse without regexes. Sensitive fields are stripped
 * at the boundary (S3.2.2.1 Confidentiality) — we never log raw bodies, raw
 * cookie strings, Authorization headers, or password fields.
 */

import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'sessiontoken',
  'cookie',
  'authorization',
  'set-cookie',
  'reset_token',
  'share_token',
  'answer',
  'security_answer',
  'apikey',
  'api_key',
]);

function shouldEmit(level: LogLevel): boolean {
  const configured = LEVEL_PRIORITY[(config.logLevel as LogLevel)] ?? LEVEL_PRIORITY.info;
  return LEVEL_PRIORITY[level] >= configured;
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 512 ? `${value.slice(0, 509)}...` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  if (!shouldEmit(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(fields) as Record<string, unknown>,
  };
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, fields: Record<string, unknown> = {}) => emit('debug', event, fields),
  info: (event: string, fields: Record<string, unknown> = {}) => emit('info', event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit('warn', event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit('error', event, fields),
};

export type Logger = typeof logger;
