// Structured client-side logger — Transparency principle (S3.3.1)
// CRITICAL: Never log passwords, tokens, or PII
// Log security events with consistent structure for observability

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const isDev = import.meta.env.DEV;

function formatEntry(entry: LogEntry): string {
  return JSON.stringify({
    t: entry.timestamp,
    lvl: entry.level,
    msg: entry.message,
    ...(entry.context && { ctx: entry.context }),
  });
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  // Only output detailed logs in development; production uses structured format
  if (isDev) {
    const formatted = formatEntry(entry);
    switch (level) {
      case 'error': console.error(formatted); break;
      case 'warn':  console.warn(formatted);  break;
      case 'info':  console.info(formatted);  break;
      default:      console.debug(formatted);
    }
  } else if (level === 'error' || level === 'warn') {
    // In production, only surface warnings/errors (no debug noise)
    console[level](formatEntry(entry));
  }
}

// Security-specific logging — always include event type for SIEM integration
export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),

  // Security audit events — Accountability principle
  securityEvent: (action: string, outcome: 'success' | 'failure', ctx?: Record<string, unknown>) => {
    log('info', `[SECURITY] ${action}`, { outcome, ...ctx });
  },
};
