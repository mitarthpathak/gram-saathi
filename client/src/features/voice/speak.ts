import type { LanguageCode, TtsBasis } from '@gram-saathi/shared';
import { getLanguage } from '@/features/language/languages';
import { api } from '@/lib/api';

export interface SpeakOptions {
  /** Audio the server already sent with the answer, if any. */
  audioUrl?: string | null;
  /** Registry dialect id: pass it only when `text` is dialect-worded (answerStyle.rendered). */
  dialectId?: string | null;
  /** Low-bandwidth mode: never download server audio; use the phone's voice. */
  lowBandwidth?: boolean;
}

export interface SpeakResult {
  ok: boolean;
  /** Who spoke: the server's audio or the browser's speech synthesis. */
  via?: 'server' | 'browser';
  /** What the server audio is based on (POST /api/tts), when the server spoke. */
  basis?: TtsBasis;
}

/** A label the UI must show next to speech that is not a real dialect voice. */
export type VoiceNote = 'named-dialect' | 'base-language-approximation';

/**
 * Reads text aloud: plays server audio when available (the answer's `audioUrl`, else
 * POST /api/tts), otherwise uses the browser's speech synthesis (free and offline).
 * Low-bandwidth mode skips server audio entirely. `ok: false` means nothing could speak.
 */
export async function speak(
  text: string,
  language: LanguageCode,
  options: SpeakOptions = {},
): Promise<SpeakResult> {
  stopSpeaking();
  if (!options.lowBandwidth) {
    if (options.audioUrl && (await playAudio(options.audioUrl))) return { ok: true, via: 'server' };
    try {
      const response = await api.tts({
        text,
        language,
        ...(options.dialectId ? { dialectId: options.dialectId } : {}),
      });
      if (response.audioUrl && (await playAudio(response.audioUrl))) {
        return { ok: true, via: 'server', basis: response.basis };
      }
    } catch {
      // The browser voice is the fallback when server speech is unavailable.
    }
  }
  return (await speakWithBrowser(text, language)) ? { ok: true, via: 'browser' } : { ok: false };
}

/**
 * Which honesty note the spoken audio needs. Dialect-worded text read by the browser's voice is
 * always a base-language approximation; server audio says itself what it is based on.
 */
export function voiceNoteFor(result: SpeakResult, dialectWorded: boolean): VoiceNote | null {
  if (!result.ok || !dialectWorded) return null;
  // Only server audio that says 'named-dialect' used a model that lists the dialect itself; any
  // other voice (browser, older server without `basis`, base-language voice) is an approximation.
  return result.via === 'server' && result.basis === 'named-dialect'
    ? 'named-dialect'
    : 'base-language-approximation';
}

let currentAudio: HTMLAudioElement | null = null;

async function playAudio(url: string): Promise<boolean> {
  try {
    const audio = new Audio(url);
    currentAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  currentAudio?.pause();
  currentAudio = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(text: string, language: string): Promise<boolean> {
  if (!('speechSynthesis' in window)) return Promise.resolve(false);
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLanguage(language)?.speechTag ?? language;
  // Many phones have no Marathi voice; a Hindi voice reads Devanagari far better than none.
  utterance.voice =
    findVoice(synth, language) ?? (language === 'mr' ? findVoice(synth, 'hi') : null);
  return new Promise((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    utterance.onstart = () => settle(true);
    utterance.onerror = (event) =>
      settle(event.error === 'interrupted' || event.error === 'canceled');
    // Some engines never fire "start"; assume speech is under way rather than show an error.
    window.setTimeout(() => settle(true), 2500);
    synth.cancel();
    synth.speak(utterance);
  });
}

function findVoice(synth: SpeechSynthesis, language: string): SpeechSynthesisVoice | null {
  // Voice tags look like "hi-IN" or "hi_IN" depending on the platform.
  return synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(language)) ?? null;
}
