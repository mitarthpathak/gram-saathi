import { getLanguage } from '@/features/language/languages';

/**
 * Reads text aloud: plays `audioUrl` when the server sent one, otherwise uses the browser's
 * speech synthesis (free and offline). Returns false when the device cannot speak.
 */
export function speak(
  text: string,
  language: string,
  audioUrl?: string | null,
  onSpeakingChange?: (speaking: boolean) => void,
): boolean {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.addEventListener('ended', () => onSpeakingChange?.(false), { once: true });
    audio.addEventListener('error', () => onSpeakingChange?.(false), { once: true });
    void audio.play().then(
      () => onSpeakingChange?.(true),
      () => {
        onSpeakingChange?.(false);
        speakWithBrowser(text, language, onSpeakingChange);
      },
    );
    return true;
  }
  return speakWithBrowser(text, language, onSpeakingChange);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(
  text: string,
  language: string,
  onSpeakingChange?: (speaking: boolean) => void,
): boolean {
  if (!('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => onSpeakingChange?.(true);
  utterance.onend = () => onSpeakingChange?.(false);
  utterance.onerror = () => onSpeakingChange?.(false);
  utterance.lang = getLanguage(language)?.speechTag ?? language;
  // Many phones have no Marathi voice; a Hindi voice reads Devanagari far better than none.
  utterance.voice =
    findVoice(synth, language) ?? (language === 'mr' ? findVoice(synth, 'hi') : null);
  synth.cancel();
  synth.speak(utterance);
  return true;
}

function findVoice(synth: SpeechSynthesis, language: string): SpeechSynthesisVoice | null {
  // Voice tags look like "hi-IN" or "hi_IN" depending on the platform.
  return synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(language)) ?? null;
}
