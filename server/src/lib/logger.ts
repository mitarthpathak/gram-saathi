type Level = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** LOG_LEVEL if set, else info in production, error in tests and debug in development. */
function minLevel(): Level {
  const configured = process.env.LOG_LEVEL;
  if (configured && configured in RANK) return configured as Level;
  if (process.env.NODE_ENV === 'production') return 'info';
  return process.env.NODE_ENV === 'test' ? 'error' : 'debug';
}

function write(level: Level, message: string, extra?: unknown): void {
  if (RANK[level] < RANK[minLevel()]) return;

  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const print = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra === undefined) print(line);
  else print(line, extra);
}

/** Minimal console logger with timestamps and levels (see LOG_LEVEL). */
export const logger = {
  debug: (message: string, extra?: unknown) => write('debug', message, extra),
  info: (message: string, extra?: unknown) => write('info', message, extra),
  warn: (message: string, extra?: unknown) => write('warn', message, extra),
  error: (message: string, extra?: unknown) => write('error', message, extra),
};
