import { MicButton } from '@/features/voice/MicButton';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';
import { useChat } from './useChat';

/** Main screen: transcript on top, big push-to-talk mic and a text fallback at the bottom. */
export function ChatScreen() {
  const { askText, askVoice, busy } = useChat();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatWindow />
      <div className="relative shrink-0 rounded-t-[1.75rem] bg-white/90 px-4 pt-2.5 pb-3 shadow-[0_-12px_30px_-18px_rgb(13_80_55/0.35)] ring-1 ring-ink/5 backdrop-blur">
        <MicButton busy={busy} onRecorded={(audio) => void askVoice(audio)} />
        <ChatInput disabled={busy} onSend={(text) => void askText(text)} />
      </div>
    </div>
  );
}
