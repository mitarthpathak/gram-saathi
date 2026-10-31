import { describe, expect, it } from 'vitest';
import { toSupportedLanguage } from '../src/lib/languages';
import { detectTextLanguage, detectTextScript } from '../src/modules/chat/language';
import { answerLanguageFromTranscription, dialectHintOutcome } from '../src/modules/dialect/language';
import { normalizeAudioMimeType } from '../src/modules/voice/service';

describe('detectTextLanguage', () => {
  it('uses the script for Tamil and Devanagari, and marker words for Hindi vs Marathi', () => {
    expect(detectTextLanguage('ஆயுஷ்மான் அட்டை எப்படிப் பெறுவது?')).toBe('ta');
    expect(detectTextLanguage('पीएम किसान में कितना पैसा मिलता है?')).toBe('hi');
    expect(detectTextLanguage('पीएम किसान योजनेत किती पैसे मिळतात?')).toBe('mr');
  });

  it('recognises romanised Hindi, English, and uses the hint only to break ties', () => {
    expect(detectTextLanguage('PM Kisan ke liye kaun eligible hai?')).toBe('hi');
    expect(detectTextLanguage('nu keh ki kaha se ho', 'en')).toBe('hi');
    expect(detectTextLanguage('nu keh rahi kaha se ho', 'en')).toBe('hi');
    expect(detectTextLanguage('Who can apply for PM-KISAN?')).toBe('en');
    expect(detectTextLanguage('PM-KISAN', 'mr')).toBe('mr');
    expect(detectTextLanguage('PM-KISAN')).toBe('en');
  });

  it('recognises short Romanised greetings and keeps the user script', () => {
    expect(detectTextLanguage('Namaste!', 'en')).toBe('hi');
    expect(detectTextLanguage('Vanakkam!', 'hi')).toBe('ta');
    expect(detectTextLanguage('Namaskar!', 'mr')).toBe('mr');
    expect(detectTextLanguage('Hi!', 'en')).toBe('en');
    expect(detectTextLanguage('Hi!', 'hi')).toBe('en');
    expect(detectTextScript('PM Kisan ke liye kitna paisa?')).toBe('Latin');
    expect(detectTextScript('nu keh ki kaha se ho')).toBe('Latin');
    expect(detectTextScript('nu keh rahi kaha se ho')).toBe('Latin');
    expect(detectTextScript('पीएम किसान में कितना पैसा?')).toBe('Devanagari');
  });

  it('falls back to the selected answer language or Hindi for unsupported scripts and markers', () => {
    expect(detectTextLanguage('તમારું નામ શું છે?')).toBe('hi');
    expect(detectTextLanguage('તમે કેમ છો?', 'mr')).toBe('mr');
    expect(detectTextLanguage('ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?')).toBe('hi');
    expect(detectTextLanguage('Tusi kive ho?')).toBe('hi');
  });
});

describe('dialect language fallback', () => {
  it('uses the chosen parent language for supported dialects and does not claim unsupported ones', () => {
    expect(answerLanguageFromTranscription('ta', 'ta', 'braj')).toBe('hi');
    expect(answerLanguageFromTranscription('gujarati', 'mr')).toBe('mr');
    expect(answerLanguageFromTranscription('other_language')).toBe('hi');
    expect(dialectHintOutcome('unsupported-dialect')).toBeUndefined();
  });
});

describe('toSupportedLanguage', () => {
  it('maps regional tags and dialects to the language we answer in', () => {
    expect(toSupportedLanguage('hi-IN', 'en')).toBe('hi');
    expect(toSupportedLanguage('bho', 'en')).toBe('hi');
    expect(toSupportedLanguage('Braj', 'en')).toBe('hi');
    expect(toSupportedLanguage('Wagdi', 'en')).toBe('hi');
    expect(toSupportedLanguage('Bundeli', 'en')).toBe('hi');
    expect(toSupportedLanguage('Marwari', 'en')).toBe('hi');
    expect(toSupportedLanguage('Marathi', 'en')).toBe('mr');
    expect(toSupportedLanguage('fr', 'ta')).toBe('ta');
  });
});

describe('normalizeAudioMimeType', () => {
  it('drops codec parameters and maps aliases to the types Gemini lists', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMimeType('audio/x-wav')).toBe('audio/wav');
    expect(normalizeAudioMimeType('audio/mp4')).toBe('audio/m4a');
  });
});
