import { useState } from 'react';
import { AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useStrings } from '@/lib/i18n';
import { liveStrings } from './strings';
import { LiveSheet } from './LiveSheet';
import { useLiveSession } from './useLiveSession';

export function LiveButton() {
  const [open, setOpen] = useState(false);
  const t = useStrings(liveStrings);
  const session = useLiveSession();

  const start = () => {
    setOpen(true);
    void session.start();
  };
  const end = () => {
    session.stop();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        aria-label={t.button}
        onClick={start}
        className="min-h-12 rounded-full px-4 text-sm"
      >
        <AudioLines aria-hidden className="size-5" />
        {t.button}
      </Button>
      <LiveSheet
        open={open}
        status={session.status}
        error={session.error}
        inputCaption={session.inputCaption}
        outputCaption={session.outputCaption}
        getLevel={session.getLevel}
        onStart={() => void session.start()}
        onEnd={end}
      />
    </>
  );
}
