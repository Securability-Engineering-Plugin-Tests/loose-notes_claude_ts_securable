/**
 * Structured logger for API routes.
 *
 * SSEM: Accountability — all security-sensitive events are logged with
 * structured data (who, what, where, when). No PII or secrets in log output.
 *
 * FIASSE S3.3.1 Transparency: meaningful event names, context fields.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'audit';

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Sanitize a value before logging to prevent log injection.
 * Removes newlines and limits length.
 */
function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/[\r\n\t]/g, '_').slice(0, 200);
  }
  return value;
}

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx)) {
    result[key] = sanitizeLogValue(value);
  }
  return result;
}

function emit(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  };
  // In production replace with a structured log transport (e.g. Datadog, Splunk)
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (event: string, ctx?: Record<string, unknown>) => emit('info', event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => emit('warn', event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => emit('error', event, ctx),
  /**
   * Audit log — immutable record of security-sensitive actions.
   * Always include: userId, action, resource, outcome.
   */
  audit: (event: string, ctx: { userId?: string; action: string; resource?: string; outcome: 'success' | 'failure'; [k: string]: unknown }) =>
    emit('audit', event, ctx),
};
