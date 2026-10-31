import { getLanguage } from '@/features/language/languages';
import { api } from '@/lib/api';

/**
 * Reads text aloud: plays `audioUrl` when the server sent one, otherwise uses the browser's
 * speech synthesis (free and offline). Returns false when the device cannot speak.
 */
export async function speak(
  text: string,
  language: string,
  audioUrl?: string | null,
  onFailure?: () => void,
): Promise<boolean> {
  if (audioUrl) {
    if (await playAudio(audioUrl)) return true;
  }
  try {
    const response = await api.tts({ text, language: language as 'hi' | 'mr' | 'ta' | 'en' });
    if (response.audioUrl && await playAudio(response.audioUrl)) return true;
  } catch {
    // The browser voice is the fallback when the optional server provider is unavailable.
  }
  const spoke = speakWithBrowser(text, language);
  if (!spoke) onFailure?.();
  return spoke;
}

async function playAudio(url: string): Promise<boolean> {
  try {
    await new Audio(url).play();
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(text: string, language: string): boolean {
  if (!('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
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
