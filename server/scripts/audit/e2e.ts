/**
 * Stage H: the real client in Chromium with a fake microphone that plays a WAV file.
 * Only runs when Playwright is installed and AUDIT_CLIENT_URL points at a running client.
 * Playwright is optional, so it is loaded with require() and typed locally.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { characterErrorRate, excerpt } from './checks';
import type { Check } from './types';

interface PlaywrightLike {
  chromium: { launch(options: { args: string[]; headless?: boolean }): Promise<BrowserLike> };
}
interface BrowserLike {
  newContext(options: { permissions: string[]; locale?: string }): Promise<ContextLike>;
  close(): Promise<void>;
}
interface ContextLike {
  newPage(): Promise<PageLike>;
}
interface LocatorLike {
  click(options?: { timeout?: number }): Promise<void>;
  first(): LocatorLike;
  last(): LocatorLike;
  innerText(options?: { timeout?: number }): Promise<string>;
  waitFor(options?: { timeout?: number; state?: string }): Promise<void>;
}
interface PageLike {
  addInitScript(script: string): Promise<void>;
  goto(url: string): Promise<unknown>;
  getByRole(role: string, options: { name: string | RegExp }): LocatorLike;
  locator(selector: string): LocatorLike;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(script: string): Promise<T>;
}

const AUDIO_HOOK = `
  window.__auditAudio = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__auditAudio.push('media'); return play.apply(this, arguments); };
  if (window.speechSynthesis) {
    const speak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (utterance) => { window.__auditAudio.push('speechSynthesis'); return speak(utterance); };
  }
`;

export async function runBrowserMicTest(clientUrl: string, repoRoot: string): Promise<Check[]> {
  const labelsFile = path.join(repoRoot, 'eval/audio/labels.json');
  const labels = existsSync(labelsFile)
    ? (JSON.parse(readFileSync(labelsFile, 'utf8')) as {
        file: string;
        transcript: string;
        speakerConsent: boolean;
      }[])
    : [];
  const clip = labels.find(
    (label) =>
      label.speakerConsent === true && existsSync(path.join(repoRoot, 'eval/audio', label.file)),
  );
  if (!clip) {
    return [
      {
        id: 'H-clip',
        title: 'Fake-microphone clip',
        status: 'NOT-TESTED',
        detail: 'No consented clip in eval/audio/labels.json to play into the fake microphone.',
        evidence: ['eval/audio/README.md'],
      },
    ];
  }
  const wav = path.join(repoRoot, 'eval/audio', clip.file);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwright = require('playwright') as PlaywrightLike;
  const browser = await playwright.chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav}`,
    ],
  });
  const checks: Check[] = [];
  try {
    const context = await browser.newContext({ permissions: ['microphone'], locale: 'en-IN' });
    const page = await context.newPage();
    await page.addInitScript(AUDIO_HOOK);
    await page.goto(clientUrl);
    const mic = page.getByRole('button', { name: /hold to speak/i });
    await mic.click({ timeout: 15_000 });
    await page.waitForTimeout(6_000);
    await mic.click();
    const answer = page.locator('article[lang]').last();
    await answer.waitFor({ timeout: 60_000 });
    const answerText = await answer.innerText();
    // QuestionBubble in client/src/features/chat/MessageBubble.tsx (right-aligned, "ml-auto").
    const userBubbles = page.locator('div.ml-auto.rounded-br-md');
    const transcript = await userBubbles
      .last()
      .innerText({ timeout: 5_000 })
      .catch(() => '');
    const cer = transcript ? characterErrorRate(clip.transcript, transcript) : 1;
    checks.push({
      id: 'H-transcript-answer',
      title: `Mic → transcript → answer in the browser (${clip.file})`,
      status: answerText.trim() ? (cer <= 0.35 ? 'PASS' : 'PARTIAL') : 'FAIL',
      detail: `Transcript CER ${cer.toFixed(3)} against the label; answer “${excerpt(answerText, 120)}”.`,
      evidence: [`client ${clientUrl}`, `eval/audio/${clip.file}`],
    });
    await page
      .getByRole('button', { name: /listen/i })
      .last()
      .click({ timeout: 10_000 });
    await page.waitForTimeout(3_000);
    const audio = await page.evaluate<string[]>('window.__auditAudio || []');
    checks.push({
      id: 'H-listen',
      title: 'Listen produces audio (server audio or browser voice)',
      status: audio.length > 0 ? 'PASS' : 'FAIL',
      detail: `Playback hooks fired: ${audio.join(', ') || 'none'}. Whether it sounds right is for a human.`,
      evidence: [`client ${clientUrl}`],
    });
  } finally {
    await browser.close();
  }
  return checks;
}
