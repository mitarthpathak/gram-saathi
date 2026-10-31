import { getLanguage } from '@/features/language/languages';
import type { LanguageCode, TtsBasis } from '@gram-saathi/shared';
import { fetchServerSpeech } from './serverTts';

/** Who is speaking: server audio (with what it is based on) or the browser's speech synthesis. */
export interface SpokenVoice {
  via: 'server' | 'browser';
  /** POST /api/tts `basis`, when the server said it. */
  basis?: TtsBasis;
}

export interface SpeakOptions {
  /** Registry dialect id: pass it only when `text` is dialect-worded (answerStyle.rendered). */
  dialectId?: string | null;
  /** Called once when a voice starts, so the UI can say honestly what the voice is. */
  onVoice?: (voice: SpokenVoice) => void;
  /** Called when neither server audio nor the browser voice could speak. */
  onUnavailable?: () => void;
}

/** A label the UI must show next to speech that is not a real dialect voice. */
export type VoiceNote = 'named-dialect' | 'base-language-approximation';

/** Browser engines that never fire `start` would otherwise leave the voice unlabelled. */
const BROWSER_START_GRACE_MS = 2500;

let currentAudio: HTMLAudioElement | null = null;
let currentOnSpeakingChange: ((speaking: boolean) => void) | undefined;
let generation = 0;
let pendingTtsRequests = 0;
const ttsLoadingListeners = new Set<(loading: boolean) => void>();

/** Subscribe to the loading state used while a server voice is being prepared. */
export function subscribeServerTtsLoading(listener: (loading: boolean) => void): () => void {
  ttsLoadingListeners.add(listener);
  listener(pendingTtsRequests > 0);
  return () => ttsLoadingListeners.delete(listener);
}

/**
 * Reads text aloud: plays server audio when available (the answer's `audioUrl`, else
 * POST /api/tts), otherwise uses the browser's speech synthesis. Low-bandwidth mode never fetches
 * server audio (see serverTts.ts). Returns false only when no playback path can be started.
 */
export function speak(
  text: string,
  language: string,
  audioUrl?: string | null,
  onSpeakingChange?: (speaking: boolean) => void,
  options: SpeakOptions = {},
): boolean {
  stopCurrentPlayback();
  const playback = ++generation;
  currentOnSpeakingChange = onSpeakingChange;

  if (audioUrl) {
    return playAudio(
      audioUrl,
      { via: 'server' },
      text,
      language,
      playback,
      onSpeakingChange,
      options,
    );
  }

  const ttsLanguage = isLanguageCode(language) ? language : 'hi';
  pendingTtsRequests++;
  notifyTtsLoading();
  void fetchServerSpeech(text, ttsLanguage, { dialectId: options.dialectId })
    .then((speech) => {
      if (playback !== generation) return;
      if (speech) {
        playAudio(
          speech.audioUrl,
          { via: 'server', ...(speech.basis ? { basis: speech.basis } : {}) },
          text,
          language,
          playback,
          onSpeakingChange,
          options,
        );
      } else {
        speakWithBrowser(text, language, playback, onSpeakingChange, options);
      }
    })
    .finally(() => {
      pendingTtsRequests = Math.max(0, pendingTtsRequests - 1);
      notifyTtsLoading();
    });
  return true;
}

/**
 * Which honesty note the spoken audio needs. Dialect-worded text read by the browser's voice is
 * always a base-language approximation; server audio says itself what it is based on.
 */
export function voiceNoteFor(
  voice: SpokenVoice | null | undefined,
  dialectWorded: boolean,
): VoiceNote | null {
  if (!voice || !dialectWorded) return null;
  // Only server audio that says 'named-dialect' used a model that lists the dialect itself; any
  // other voice (browser, older server without `basis`, base-language voice) is an approximation.
  return voice.via === 'server' && voice.basis === 'named-dialect'
    ? 'named-dialect'
    : 'base-language-approximation';
}

export function stopSpeaking(): void {
  generation++;
  stopCurrentPlayback();
}

function stopCurrentPlayback(): void {
  const audio = currentAudio;
  currentAudio = null;
  audio?.pause();
  if (audio) audio.currentTime = 0;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  const onSpeakingChange = currentOnSpeakingChange;
  currentOnSpeakingChange = undefined;
  onSpeakingChange?.(false);
}

function playAudio(
  url: string,
  voice: SpokenVoice,
  text: string,
  language: string,
  playback: number,
  onSpeakingChange: ((speaking: boolean) => void) | undefined,
  options: SpeakOptions,
): boolean {
  let audio: HTMLAudioElement;
  try {
    audio = new Audio(url);
  } catch {
    onSpeakingChange?.(false);
    return speakWithBrowser(text, language, playback, onSpeakingChange, options);
  }
  currentAudio = audio;
  let failed = false;
  let speakingNotified = false;
  const markSpeaking = () => {
    if (playback !== generation || speakingNotified) return;
    speakingNotified = true;
    onSpeakingChange?.(true);
    options.onVoice?.(voice);
  };
  const finish = () => {
    if (playback !== generation || currentAudio !== audio) return;
    currentAudio = null;
    currentOnSpeakingChange = undefined;
    onSpeakingChange?.(false);
  };
  const fallback = () => {
    if (failed || playback !== generation || currentAudio !== audio) return;
    failed = true;
    currentAudio = null;
    onSpeakingChange?.(false);
    speakWithBrowser(text, language, playback, onSpeakingChange, options);
  };

  audio.addEventListener('play', markSpeaking, { once: true });
  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', fallback, { once: true });
  try {
    void audio.play().then(markSpeaking, fallback);
  } catch {
    fallback();
  }
  return true;
}

function speakWithBrowser(
  text: string,
  language: string,
  playback: number,
  onSpeakingChange: ((speaking: boolean) => void) | undefined,
  options: SpeakOptions,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onSpeakingChange?.(false);
    options.onUnavailable?.();
    return false;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  let settled = false;
  const markStarted = () => {
    if (settled || playback !== generation) return;
    settled = true;
    options.onVoice?.({ via: 'browser' });
  };
  const grace = setTimeout(markStarted, BROWSER_START_GRACE_MS);
  utterance.onstart = () => {
    clearTimeout(grace);
    if (playback !== generation) return;
    onSpeakingChange?.(true);
    markStarted();
  };
  utterance.onend = () => {
    clearTimeout(grace);
    if (playback === generation) onSpeakingChange?.(false);
  };
  utterance.onerror = (event) => {
    clearTimeout(grace);
    if (playback !== generation) return;
    onSpeakingChange?.(false);
    // Being cut off by newer speech is not a failure.
    if (!settled && event.error !== 'interrupted' && event.error !== 'canceled') {
      settled = true;
      options.onUnavailable?.();
    }
  };
  utterance.lang = getLanguage(language)?.speechTag ?? language;
  // Many phones have no Marathi voice; a Hindi voice reads Devanagari far better than none.
  utterance.voice =
    findVoice(synth, language) ?? (language === 'mr' ? findVoice(synth, 'hi') : null);
  synth.speak(utterance);
  return true;
}

function findVoice(synth: SpeechSynthesis, language: string): SpeechSynthesisVoice | null {
  return synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(language)) ?? null;
}

function notifyTtsLoading(): void {
  const loading = pendingTtsRequests > 0;
  ttsLoadingListeners.forEach((listener) => listener(loading));
}

function isLanguageCode(value: string): value is LanguageCode {
  return ['hi', 'mr', 'ta', 'en'].includes(value);
}
