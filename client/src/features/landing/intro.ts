const KEY = 'gs:introSeen';

/**
 * The greeting intro plays once per browser session. index.html's head script reads the same
 * key and adds .intro-seen to <html> before the first paint.
 */
export function introAlreadyPlayed(): boolean {
  return document.documentElement.classList.contains('intro-seen');
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
