import type { LiveEvent } from './liveProtocol';

export interface FakeLiveCallbacks {
  onEvent: (event: LiveEvent) => void;
  onPlaybackEnded: () => void;
  onSpeaking: () => void;
  onListening: () => void;
}

/** Offline-only scripted session used when VITE_USE_MOCKS or the token response is mocked. */
export class FakeLiveClient {
  private timers: number[] = [];
  private context: AudioContext | null = null;
  private readonly callbacks: FakeLiveCallbacks;

  constructor(callbacks: FakeLiveCallbacks) {
    this.callbacks = callbacks;
  }

  start(captions: { input: string; output: string }): void {
    try {
      this.context = new AudioContext();
      void this.context.resume();
    } catch {
      this.context = null;
    }
    this.callbacks.onListening();
    this.timers.push(
      window.setTimeout(() => {
        this.callbacks.onEvent({
          type: 'inputTranscription',
          text: captions.input,
          finished: true,
        });
        this.callbacks.onSpeaking();
        this.callbacks.onEvent({
          type: 'outputTranscription',
          text: captions.output,
          finished: true,
        });
        this.playTone();
      }, 450),
    );
    this.timers.push(window.setTimeout(() => this.callbacks.onPlaybackEnded(), 1_100));
  }

  getLevel = (): number => 0.16;

  close(): void {
    this.timers.forEach(window.clearTimeout);
    this.timers = [];
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
  }

  private playTone(): void {
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      gain.gain.value = 0.08;
      oscillator.frequency.value = 660;
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.16);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        if (this.context && this.context.state !== 'closed') void this.context.close();
        this.context = null;
      };
    } catch {
      // The scripted captions still make the mock flow usable if a device cannot play audio.
    }
  }
}
