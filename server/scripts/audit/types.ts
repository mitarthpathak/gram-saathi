/** Shared types of the pipeline audit (`npm run audit -w server`). */

/** The only statuses the audit may use. "works perfectly" is not one of them. */
export const STATUSES = [
  'PASS',
  'FAIL',
  'PARTIAL',
  'MOCK-ONLY',
  'SYNTHETIC-ONLY',
  'NEEDS-HUMAN',
  'NOT-TESTED',
] as const;
export type Status = (typeof STATUSES)[number];

export type StageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

/** How a result was produced. Mock and fake-backend results never prove the real pipeline. */
export type RunMode = 'static' | 'real' | 'mock' | 'fake-backend' | 'none';

export interface Check {
  id: string;
  title: string;
  status: Status;
  /** Plain-language result, including the reason for NOT-TESTED. */
  detail: string;
  /** Commands, file paths, response excerpts or results.json pointers. */
  evidence: string[];
  /** Optional structured numbers for comparison between runs. */
  data?: Record<string, unknown>;
}

export interface StageResult {
  stage: StageId;
  name: string;
  status: Status;
  mode: RunMode;
  /** Why the whole stage was not run, when it was not. */
  reason?: string;
  checks: Check[];
  /** Free-form data for the report (score distributions, call counts, ...). */
  data?: Record<string, unknown>;
  durationMs: number;
}

/** What a worker process sends back to the orchestrator. */
export interface WorkerOutput {
  worker: 'configured' | 'mock-reference' | 'fake';
  environment: {
    useMocks: string[];
    keyConfigured: boolean;
    transport: 'http' | 'in-process' | 'none';
    transportNote?: string;
    models: Record<string, string | undefined>;
  };
  stages: StageResult[];
  /** Per-language / per-dialect facts the matrix is built from. */
  regional: RegionalObservation[];
}

/** One observation feeding a cell of the regional readiness matrix. */
export interface RegionalObservation {
  /** "hi" | "mr" | "ta" | "en" or a registry dialect id. */
  row: string;
  column: MatrixColumn;
  status: Status;
  evidence: string;
}

export const MATRIX_COLUMNS = [
  'understandsSpeech',
  'identifiesDialect',
  'answersInLanguage',
  'answersInDialect',
  'ttsNamesLanguage',
  'speaksReply',
  'accentMatches',
] as const;
export type MatrixColumn = (typeof MATRIX_COLUMNS)[number];

export const MATRIX_COLUMN_TITLES: Record<MatrixColumn, string> = {
  understandsSpeech: 'Understands speech',
  identifiesDialect: 'Identifies dialect',
  answersInLanguage: 'Answers in correct language',
  answersInDialect: 'Answers in the dialect (text)',
  ttsNamesLanguage: 'TTS names this language',
  speaksReply: 'Speaks the reply',
  accentMatches: 'Accent matches',
};

export interface MatrixCell {
  status: Status;
  evidence: string;
}

export interface MatrixRow {
  row: string;
  label: string;
  cells: Record<MatrixColumn, MatrixCell>;
}

export interface AuditResults {
  version: 1;
  generatedAt: string;
  git: { branch: string; commit: string; dirty: boolean };
  label: string;
  workers: (WorkerOutput['environment'] & { worker: WorkerOutput['worker'] })[];
  stages: StageResult[];
  matrix: MatrixRow[];
  deployed?: DeployedCheck;
  sandboxNotes: string[];
}

export interface DeployedCheck {
  baseUrl: string;
  status: Status;
  detail: string;
  evidence: string[];
  mocks?: boolean;
  faqLooksMocked?: boolean;
}
