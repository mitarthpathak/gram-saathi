import type { LanguageCode } from '@gram-saathi/shared';
import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { speak, type SpeakResult } from './speak';
import { voiceStrings } from './strings';

interface SpeakButtonProps {
  text: string;
  /** Language of `text` (picks the voice). */
  language: LanguageCode;
  audioUrl?: string | null;
  /** Only when `text` is dialect-worded (answerStyle.rendered === 'dialect'). */
  dialectId?: string | null;
  /** Called after speaking starts (or fails), e.g. to show what the voice is based on. */
  onSpoken?: (result: SpeakResult) => void;
}

/** "Listen" button: reads the text aloud for people who prefer listening to reading. */
export function SpeakButton({ text, language, audioUrl, dialectId, onSpoken }: SpeakButtonProps) {
  const t = useStrings(voiceStrings);
  const toast = useToast();
  const { lowBandwidth } = useSettings();
  const [preparing, setPreparing] = useState(false);

  const listen = async () => {
    setPreparing(true);
    try {
      const result = await speak(text, language, { audioUrl, dialectId, lowBandwidth });
      if (!result.ok) toast.show(t.speakFailed, 'error');
      onSpoken?.(result);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Button
      variant="soft"
      size="sm"
      disabled={preparing}
      aria-busy={preparing}
      onClick={() => void listen()}
    >
      {preparing ? (
        <span aria-hidden className="flex gap-1">
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-dot rounded-full bg-brand-600"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
      ) : (
        <Volume2 aria-hidden className="size-4" />
      )}
      {preparing ? t.preparingAudio : t.listen}
    </Button>
  );
}
