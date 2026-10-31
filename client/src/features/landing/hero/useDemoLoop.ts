import { useEffect, useState } from 'react';
import type { DemoStage } from './PhoneScreen';

/** One loop of the hero demo: mic pulse, waveform, question types in, answer arrives. */
const STAGES: [DemoStage, number][] = [
  ['idle', 2400],
  ['listening', 1800],
  ['asking', 1700],
  ['thinking', 1000],
  ['answer', 4600],
];

const WORD_MS = 130;

/** Drives the stages while `playing`; pausing freezes the current frame. */
export function useDemoLoop(playing: boolean, wordCount: number) {
  const [step, setStep] = useState(0);
  const [typedWords, setTypedWords] = useState(0);
  const stage = STAGES[step][0];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = (step + 1) % STAGES.length;
      if (STAGES[next][0] === 'asking') setTypedWords(1);
      setStep(next);
    }, STAGES[step][1]);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  // Whole words only: per-character typing would break Devanagari and Tamil clusters.
  useEffect(() => {
    if (!playing || stage !== 'asking') return;
    const timer = window.setInterval(
      () => setTypedWords((count) => Math.min(count + 1, wordCount)),
      WORD_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, stage, wordCount]);

  return { stage, typedWords: stage === 'asking' ? typedWords : wordCount };
}
