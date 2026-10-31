import { describe, expect, it } from 'vitest';
import { toSupportedLanguage } from '../src/lib/languages';
import { detectTextLanguage } from '../src/modules/chat/language';
import { normalizeAudioMimeType } from '../src/modules/voice/service';

describe('detectTextLanguage', () => {
  it('uses the script for Tamil and Devanagari, and marker words for Hindi vs Marathi', () => {
    expect(detectTextLanguage('ஆயுஷ்மான் அட்டை எப்படிப் பெறுவது?')).toBe('ta');
    expect(detectTextLanguage('पीएम किसान में कितना पैसा मिलता है?')).toBe('hi');
    expect(detectTextLanguage('पीएम किसान योजनेत किती पैसे मिळतात?')).toBe('mr');
  });

  it('recognises romanised Hindi, English, and uses the hint only to break ties', () => {
    expect(detectTextLanguage('PM Kisan ke liye kaun eligible hai?')).toBe('hi');
    expect(detectTextLanguage('Who can apply for PM-KISAN?')).toBe('en');
    expect(detectTextLanguage('PM-KISAN', 'mr')).toBe('mr');
    expect(detectTextLanguage('PM-KISAN')).toBe('en');
  });

  it('falls back to the selected answer language or Hindi for unsupported scripts and markers', () => {
    expect(detectTextLanguage('તમારું નામ શું છે?')).toBe('hi');
    expect(detectTextLanguage('તમે કેમ છો?', 'mr')).toBe('mr');
    expect(detectTextLanguage('ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?')).toBe('hi');
    expect(detectTextLanguage('Tusi kive ho?')).toBe('hi');
  });
});

describe('toSupportedLanguage', () => {
  it('maps regional tags and dialects to the language we answer in', () => {
    expect(toSupportedLanguage('hi-IN', 'en')).toBe('hi');
    expect(toSupportedLanguage('bho', 'en')).toBe('hi');
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
