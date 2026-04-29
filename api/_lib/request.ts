/**
 * Request-handling helpers — body parsing with size cap, request-id, JSON
 * response shaping, method dispatch.
 *
 * FIASSE: bounded resource consumption (S3.2.3.1 Availability) — every body
 * read is capped, no unbounded `req.on('data')`. Request IDs let us correlate
 * one request across the audit log, the response, and any client-side report
 * (S2.5 Transparency, S3.2.1.4 Observability).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError, sendError } from './errors.js';
import { logger } from './logger.js';
import { config } from './config.js';

export function getRequestId(req: VercelRequest): string {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(incoming)) return incoming;
  return randomUUID();
}

/**
 * Read a JSON body, enforcing a size cap. Vercel's @vercel/node runtime
 * already populates `req.body` for many content types; we still re-validate
 * here so we never trust a parser that may pre-populate fields the schema
 * hasn't authorized.
 */
export async function readJsonBody<T extends z.ZodTypeAny>(
  req: VercelRequest,
  schema: T,
  opts: { maxBytes?: number } = {},
): Promise<z.infer<T>> {
  const max = opts.maxBytes ?? config.limits.maxBodyBytes;

  const ct = (req.headers['content-type'] ?? '').toString().toLowerCase();
  if (!ct.includes('application/json')) {
    throw new AppError('invalid_request', 'Content-Type must be application/json');
  }

  const cl = Number(req.headers['content-length'] ?? '0');
  if (Number.isFinite(cl) && cl > max) {
    throw new AppError('payload_too_large', 'Request body too large');
  }

  let raw: unknown = req.body;
  if (raw === undefined || raw === null) {
    raw = await readRawBody(req, max);
    try { raw = JSON.parse(raw as string); } catch {
      throw new AppError('invalid_request', 'Body is not valid JSON');
    }
  } else if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch {
      throw new AppError('invalid_request', 'Body is not valid JSON');
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError('invalid_request', 'Validation failed', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

async function readRawBody(req: VercelRequest, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > max) {
        aborted = true;
        reject(new AppError('payload_too_large', 'Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (!aborted) reject(err);
    });
  });
}

/**
 * Parse and validate query parameters with a zod schema. Vercel's request
 * `query` may contain string-or-string-array values; we use `coerce.*` in
 * the schemas where appropriate.
 */
export function readQuery<T extends z.ZodTypeAny>(req: VercelRequest, schema: T): z.infer<T> {
  const flattened: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    flattened[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  }
  const result = schema.safeParse(flattened);
  if (!result.success) {
    throw new AppError('invalid_request', 'Invalid query parameters', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

export function ok(res: VercelResponse, body: unknown, requestId: string): void {
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ data: body, requestId });
}

export function created(res: VercelResponse, body: unknown, requestId: string): void {
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ data: body, requestId });
}

export function noContent(res: VercelResponse, requestId: string): void {
  res.setHeader('X-Request-Id', requestId);
  res.status(204).end();
}

/**
 * Wrap a handler so that all thrown errors are converted to JSON error
 * responses with stable shape. Adds the request-id header and structured
 * boundary log lines.
 */
export function handler(
  fn: (req: VercelRequest, res: VercelResponse, ctx: { requestId: string }) => Promise<void>,
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async (req, res) => {
    const requestId = getRequestId(req);
    res.setHeader('X-Request-Id', requestId);
    const start = Date.now();
    try {
      await fn(req, res, { requestId });
      logger.info('request.complete', {
        requestId,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      sendError(res, err, requestId);
      logger.info('request.complete', {
        requestId,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Date.now() - start,
        outcome: 'error',
      });
    }
  };
}

/** Helper mirroring zod for callers that already have validated values. */
export const Z = z;
