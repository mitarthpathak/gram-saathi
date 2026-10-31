const KEY = 'gs:introSeen';

/** The greeting intro plays once per browser session. */
export function introSeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: skip the intro rather than replay it on every visit
  }
}

export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Not critical.
  }
}

/** The four greetings, each in its own script (shared by the intro and the mascot). */
export const GREETINGS = [
  { lang: 'hi', text: 'नमस्ते' },
  { lang: 'mr', text: 'नमस्कार' },
  { lang: 'ta', text: 'வணக்கம்' },
  { lang: 'en', text: 'Hello' },
] as const;
