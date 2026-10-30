import type { TranscriptScript } from '@gram-saathi/shared';

export interface LocalContribution {
  id: string;
  label: string;
  transcript: string;
  hindiMeaning: string;
  script: TranscriptScript;
  district: string;
  area: string;
  speakerAnonId: string;
  consent: true;
  codeSwitch: boolean;
  durationMs: number;
  audioBlob: Blob;
  audioMime: string;
  createdAt: number;
}

export interface ContributionExport {
  id: string;
  label: string;
  transcript: string;
  hindiMeaning: string;
  script: TranscriptScript;
  district: string;
  area: string;
  speakerAnonId: string;
  consent: true;
  codeSwitch: boolean;
  durationMs: number;
  audioBase64: string;
  audioMime: string;
}

export function consentAllowsRecording(consent: boolean): boolean {
  return consent;
}

export function buildContributionExport(
  row: LocalContribution,
  audioBase64: string,
): ContributionExport {
  return {
    id: row.id,
    label: row.label,
    transcript: row.transcript,
    hindiMeaning: row.hindiMeaning,
    script: row.script,
    district: row.district,
    area: row.area,
    speakerAnonId: row.speakerAnonId,
    consent: true,
    codeSwitch: row.codeSwitch,
    durationMs: row.durationMs,
    audioBase64,
    audioMime: row.audioMime,
  };
}

export function detectScript(text: string): TranscriptScript {
  const devanagari = /[\u0900-\u097f]/.test(text);
  const tamil = /[\u0b80-\u0bff]/.test(text);
  const latin = /[A-Za-z]/.test(text);
  if ((devanagari || tamil) && latin) return 'mixed';
  if (devanagari) return 'devanagari';
  if (latin) return 'roman';
  return 'other';
}
