// Structured audit logging — Accountability (S3.2.2)
// Records security-sensitive actions with who/what/when/where.
// CRITICAL: Never log passwords, tokens, or PII in details field.

import { randomUUID } from 'crypto';
import type { VercelRequest } from '@vercel/node';
import { auditStore } from './store.js';
import type { AuditAction, AuditResourceType, AuditLogRecord } from './types.js';

interface AuditParams {
  userId: string | null;
  username?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  outcome: 'success' | 'failure';
  details?: string | null;
  req?: VercelRequest;
}

/** Append an audit log entry. Non-throwing — audit failure must not block business logic. */
export function audit(params: AuditParams): void {
  try {
    const entry: AuditLogRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      ipAddress: params.req ? extractClientIp(params.req) : null,
      outcome: params.outcome,
      details: params.details ?? null,
    };

    // Store in memory (replace with DB insert in production)
    auditStore.append(entry);

    // Structured console output for log aggregation (Transparency)
    // Safe: no sensitive data in the log entry
    console.info(JSON.stringify({
      event: 'audit',
      ...entry,
    }));
  } catch {
    // Audit failure is non-fatal — log to stderr only
    console.error(JSON.stringify({ event: 'audit_failure', action: params.action }));
  }
}

/** Extract client IP from Vercel's forwarded headers. */
function extractClientIp(req: VercelRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    // Take only the first IP (client) — proxies may append intermediate IPs
    return forwarded.split(',')[0].trim();
  }
  return null;
}
