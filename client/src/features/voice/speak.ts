import { getLanguage } from '@/features/language/languages';
import type { LanguageCode } from '@gram-saathi/shared';
import { fetchServerTts } from './serverTts';

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
 * Reads text aloud: plays server audio when available, otherwise uses the browser's speech
 * synthesis. Returns false only when no playback path can be started.
 */
export function speak(
  text: string,
  language: string,
  audioUrl?: string | null,
  onSpeakingChange?: (speaking: boolean) => void,
): boolean {
  stopCurrentPlayback();
  const playback = ++generation;
  currentOnSpeakingChange = onSpeakingChange;

  if (audioUrl) return playAudio(audioUrl, text, language, playback, onSpeakingChange);

  const ttsLanguage = isLanguageCode(language) ? language : 'hi';
  pendingTtsRequests++;
  notifyTtsLoading();
  void fetchServerTts(text, ttsLanguage)
    .then((serverAudioUrl) => {
      if (playback !== generation) return;
      if (serverAudioUrl) playAudio(serverAudioUrl, text, language, playback, onSpeakingChange);
      else speakWithBrowser(text, language, playback, onSpeakingChange);
    })
    .finally(() => {
      pendingTtsRequests = Math.max(0, pendingTtsRequests - 1);
      notifyTtsLoading();
    });
  return true;
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
  text: string,
  language: string,
  playback: number,
  onSpeakingChange?: (speaking: boolean) => void,
): boolean {
  let audio: HTMLAudioElement;
  try {
    audio = new Audio(url);
  } catch {
    onSpeakingChange?.(false);
    return speakWithBrowser(text, language, playback, onSpeakingChange);
  }
  currentAudio = audio;
  let failed = false;
  let speakingNotified = false;
  const markSpeaking = () => {
    if (playback !== generation || speakingNotified) return;
    speakingNotified = true;
    onSpeakingChange?.(true);
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
    speakWithBrowser(text, language, playback, onSpeakingChange);
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
  onSpeakingChange?: (speaking: boolean) => void,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onSpeakingChange?.(false);
    return false;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => {
    if (playback === generation) onSpeakingChange?.(true);
  };
  utterance.onend = () => {
    if (playback === generation) onSpeakingChange?.(false);
  };
  utterance.onerror = () => {
    if (playback === generation) onSpeakingChange?.(false);
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
