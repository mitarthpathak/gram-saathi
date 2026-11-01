import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useStrings } from '@/lib/i18n';
import { speak, subscribeServerTtsLoading } from './speak';
import { voiceStrings } from './strings';

interface SpeakButtonProps {
  text: string;
  /** Language of `text` (picks the voice). */
  language: string;
  audioUrl?: string | null;
}

/** "Listen" button: reads the text aloud for people who prefer listening to reading. */
export function SpeakButton({ text, language, audioUrl }: SpeakButtonProps) {
  const t = useStrings(voiceStrings);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeServerTtsLoading(setLoading), []);

  return (
    <Button
      variant="soft"
      size="sm"
      onClick={() => speak(text, language, audioUrl)}
      aria-busy={loading}
    >
      {loading ? (
        <Spinner label={t.loadingAudio} className="text-sm" />
      ) : (
        <Volume2 aria-hidden className="size-4" />
      )}
      {loading ? null : t.listen}
    </Button>
  );
}
