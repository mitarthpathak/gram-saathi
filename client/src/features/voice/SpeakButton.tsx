import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/useToast';
import { useStrings } from '@/lib/i18n';
import { speak, subscribeServerTtsLoading, type SpokenVoice } from './speak';
import { voiceStrings } from './strings';

interface SpeakButtonProps {
  text: string;
  /** Language of `text` (picks the voice). */
  language: string;
  audioUrl?: string | null;
  /** Only when `text` is dialect-worded (answerStyle.rendered === 'dialect'). */
  dialectId?: string | null;
  /** Called when a voice starts, e.g. to show what the voice is based on. */
  onSpoken?: (voice: SpokenVoice) => void;
}

/** "Listen" button: reads the text aloud for people who prefer listening to reading. */
export function SpeakButton({ text, language, audioUrl, dialectId, onSpoken }: SpeakButtonProps) {
  const t = useStrings(voiceStrings);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeServerTtsLoading(setLoading), []);

  const listen = () => {
    speak(text, language, audioUrl, undefined, {
      dialectId,
      onVoice: onSpoken,
      // One clear message only when neither server audio nor the phone's voice could speak.
      onUnavailable: () => toast.show(t.speakFailed, 'error'),
    });
  };

  return (
    <Button variant="soft" size="sm" onClick={listen} aria-busy={loading}>
      {loading ? (
        <Spinner label={t.loadingAudio} className="text-sm" />
      ) : (
        <Volume2 aria-hidden className="size-4" />
      )}
      {loading ? null : t.listen}
    </Button>
  );
}
