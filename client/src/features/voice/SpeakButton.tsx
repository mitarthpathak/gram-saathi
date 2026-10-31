import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { useStrings } from '@/lib/i18n';
import { speak } from './speak';
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
  const toast = useToast();
  return (
    <Button variant="soft" size="sm" onClick={() => void speak(text, language, audioUrl, () => toast.show(t.speakFailed, 'error'))}>
      <Volume2 aria-hidden className="size-4" />
      {t.listen}
    </Button>
  );
}
