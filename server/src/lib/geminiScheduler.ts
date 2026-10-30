import { env } from '../config/env';

type Priority = 'answer' | 'dialect';

interface Job<T> {
  priority: Priority;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  started: boolean;
}

const answerQueue: Job<unknown>[] = [];
const dialectQueue: Job<unknown>[] = [];
let active = 0;
let activeDialect = 0;

/**
 * All Gemini generation and embedding requests share this queue. Non-dialect work has priority;
 * at most cap-1 classifier calls run at once, preserving one slot for an arriving answer.
 */
export function withGeminiConcurrency<T>(
  priority: Priority,
  run: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const job: Job<T> = { priority, run, resolve, reject, signal, started: false };
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    if (signal) {
      job.onAbort = () => {
        if (job.started) return;
        removeJob(job as Job<unknown>);
        reject(abortError());
        dispatch();
      };
      signal.addEventListener('abort', job.onAbort, { once: true });
    }
    (priority === 'answer' ? answerQueue : dialectQueue).push(job as Job<unknown>);
    dispatch();
  });
}

/** Useful for deterministic queue tests and operational metrics. */
export function geminiConcurrencyState(): Readonly<{
  active: number;
  activeDialect: number;
  queuedAnswers: number;
  queuedDialect: number;
  limit: number;
}> {
  return {
    active,
    activeDialect,
    queuedAnswers: answerQueue.length,
    queuedDialect: dialectQueue.length,
    limit: env.GEMINI_MAX_CONCURRENT_CALLS,
  };
}

function dispatch(): void {
  const limit = env.GEMINI_MAX_CONCURRENT_CALLS;
  while (active < limit) {
    const answer = answerQueue.shift();
    if (answer) {
      start(answer);
      continue;
    }
    if (activeDialect >= limit - 1 || dialectQueue.length === 0) return;
    start(dialectQueue.shift()!);
  }
}

function start(job: Job<unknown>): void {
  job.started = true;
  if (job.signal && job.onAbort) job.signal.removeEventListener('abort', job.onAbort);
  active++;
  if (job.priority === 'dialect') activeDialect++;
  void Promise.resolve()
    .then(job.run)
    .then(job.resolve, job.reject)
    .finally(() => {
      active--;
      if (job.priority === 'dialect') activeDialect--;
      dispatch();
    });
}

function removeJob(job: Job<unknown>): void {
  const queue = job.priority === 'answer' ? answerQueue : dialectQueue;
  const index = queue.indexOf(job);
  if (index >= 0) queue.splice(index, 1);
}

function abortError(): Error {
  const error = new Error('Gemini request left the queue before it could start');
  error.name = 'AbortError';
  return error;
}
