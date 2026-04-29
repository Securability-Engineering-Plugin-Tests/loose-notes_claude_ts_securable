/**
 * Typed application errors with safe public messages.
 *
 * FIASSE: error messages do not leak internals (S3.2.3.3 Resilience,
 * S3.2.2.1 Confidentiality). Public message is what the client sees;
 * internal detail goes to structured logs only. Each error carries a stable
 * machine-readable code so the client can branch without parsing prose.
 */

import type { VercelResponse } from '@vercel/node';
import { logger } from './logger.js';

export type ErrorCode =
  | 'invalid_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'payload_too_large'
  | 'method_not_allowed'
  | 'internal_error';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  method_not_allowed: 405,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly publicMessage: string;
  readonly internal: Record<string, unknown> | undefined;
  readonly status: number;

  constructor(code: ErrorCode, publicMessage: string, internal?: Record<string, unknown>) {
    super(publicMessage);
    this.code = code;
    this.publicMessage = publicMessage;
    this.internal = internal;
    this.status = STATUS_BY_CODE[code];
  }
}

export function sendError(res: VercelResponse, err: unknown, requestId: string): void {
  if (err instanceof AppError) {
    logger.warn('request.error', {
      requestId,
      code: err.code,
      status: err.status,
      ...(err.internal ?? {}),
    });
    res.status(err.status).json({
      error: { code: err.code, message: err.publicMessage, requestId },
    });
    return;
  }
  // Unknown errors — log internally, return generic message externally.
  logger.error('request.unhandled', {
    requestId,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({
    error: { code: 'internal_error', message: 'An unexpected error occurred', requestId },
  });
}
