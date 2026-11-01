import { afterEach, describe, expect, it, vi } from 'vitest';
import { speak, stopSpeaking } from './speak';

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  readonly src: string;
  currentTime = 0;
  pause = vi.fn();

  constructor(src: string) {
    super();
    this.src = src;
    FakeAudio.instances.push(this);
  }

  play = vi.fn(async () => {
    this.dispatchEvent(new Event('play'));
  });
}

afterEach(() => {
  FakeAudio.instances = [];
  vi.unstubAllGlobals();
});

describe('speak playback', () => {
  it('stops the previous audio and speech synthesis on replacement and stop', () => {
    const cancel = vi.fn();
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('window', {
      speechSynthesis: { cancel, getVoices: () => [] },
    });
    const firstChanges = vi.fn();
    const secondChanges = vi.fn();

    expect(speak('first', 'hi', 'data:audio/wav;base64,first', firstChanges)).toBe(true);
    const firstAudio = FakeAudio.instances[0];
    expect(firstAudio.src).toBe('data:audio/wav;base64,first');

    expect(speak('second', 'hi', 'https://example.test/second.wav', secondChanges)).toBe(true);
    const secondAudio = FakeAudio.instances[1];
    expect(firstAudio.pause).toHaveBeenCalledOnce();
    expect(firstAudio.currentTime).toBe(0);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(firstChanges).toHaveBeenCalledWith(false);

    stopSpeaking();
    expect(secondAudio.pause).toHaveBeenCalledOnce();
    expect(secondAudio.currentTime).toBe(0);
    expect(secondChanges).toHaveBeenCalledWith(false);
    expect(cancel).toHaveBeenCalledTimes(3);
  });
});
