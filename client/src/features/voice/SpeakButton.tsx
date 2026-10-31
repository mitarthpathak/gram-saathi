import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/useToast';
import { useStrings } from '@/lib/i18n';
import { api } from '@/lib/api';
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

  async function listen() {
    if (audioUrl && (await playAudio(audioUrl))) return;
    try {
      const response = await api.tts({ text, language: language as 'hi' | 'mr' | 'ta' | 'en' });
      if (response.audioUrl && (await playAudio(response.audioUrl))) return;
    } catch {
      // The browser voice is the fallback when optional server audio is unavailable.
    }
    if (!speak(text, language)) toast.show(t.speakFailed, 'error');
  }

  return (
    <Button variant="soft" size="sm" onClick={() => void listen()}>
      <Volume2 aria-hidden className="size-4" />
      {t.listen}
    </Button>
  );
}

async function playAudio(url: string): Promise<boolean> {
  try {
    await new Audio(url).play();
    return true;
  } catch {
    return false;
  }
}
