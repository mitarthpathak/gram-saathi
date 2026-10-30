import { useCallback, useRef, useState } from 'react';
import { createPlaceholderAudio } from './placeholderAudio';

export type RecorderStatus = 'idle' | 'recording';

export interface Recorder {
  status: RecorderStatus;
  start: () => Promise<void>;
  /** Stops recording and resolves with the recorded audio. */
  stop: () => Promise<Blob>;
  /** Stops recording and throws the audio away. */
  cancel: () => void;
}

/**
 * Microphone recording for the push-to-talk button.
 *
 * Step 1 stub: no microphone access. stop() returns a short silent WAV so the whole voice
 * flow (upload -> transcript -> answer) runs end to end on mock data.
 *
 * TODO(step-2): record for real with getUserMedia + MediaRecorder (audio/webm;codecs=opus,
 * audio/mp4 on Safari), handle a denied permission, stop automatically after ~30 s and
 * release the mic tracks. The mic only works on https or localhost: use a tunnel on phones.
 */
export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const startedAt = useRef(0);

  const start = useCallback(async () => {
    startedAt.current = Date.now();
    setStatus('recording');
  }, []);

  const stop = useCallback(async () => {
    setStatus('idle');
    return createPlaceholderAudio(Date.now() - startedAt.current);
  }, []);

  const cancel = useCallback(() => setStatus('idle'), []);

  return { status, start, stop, cancel };
}
