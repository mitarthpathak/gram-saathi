type Level = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level: Level, message: string, extra?: unknown): void {
  const minLevel: Level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  if (RANK[level] < RANK[minLevel]) return;

  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const print = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra === undefined) print(line);
  else print(line, extra);
}

/** Minimal console logger with timestamps and levels (debug is hidden in production). */
export const logger = {
  debug: (message: string, extra?: unknown) => write('debug', message, extra),
  info: (message: string, extra?: unknown) => write('info', message, extra),
  warn: (message: string, extra?: unknown) => write('warn', message, extra),
  error: (message: string, extra?: unknown) => write('error', message, extra),
};
