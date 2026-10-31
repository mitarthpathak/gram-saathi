import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import type { AppLocationState } from '@/features/app-shell/navigation';
import { MicButton } from '@/features/voice/MicButton';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';
import { useChat } from './useChat';

/** Main screen: transcript on top, big push-to-talk mic and a text fallback at the bottom. */
export function ChatScreen() {
  const { askText, askVoice, busy } = useChat();
  const location = useLocation();
  // Opened from "Hold to speak": focus the mic so one press (or Enter / Space) starts talking.
  // Recording itself always waits for the user's own gesture and the browser's permission.
  const focusMic = Boolean((location.state as AppLocationState | null)?.focusMic);
  const micRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusMic) micRef.current?.focus({ preventScroll: true });
  }, [focusMic]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatWindow />
      <div className="relative shrink-0 rounded-t-blob bg-white/95 px-4 pt-2.5 pb-3 shadow-[0_-14px_30px_-18px_rgb(140_90_30/0.3)] ring-1 ring-ink/5">
        <MicButton
          buttonRef={micRef}
          attention={focusMic}
          busy={busy}
          onRecorded={(audio) => void askVoice(audio)}
        />
        <ChatInput disabled={busy} onSend={(text) => void askText(text)} />
      </div>
    </div>
  );
}
