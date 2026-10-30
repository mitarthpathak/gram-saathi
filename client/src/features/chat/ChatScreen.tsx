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
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 pt-4 pb-3">
        <MicButton busy={busy} onRecorded={(audio) => void askVoice(audio)} />
        <ChatInput disabled={busy} onSend={(text) => void askText(text)} />
      </div>
    </div>
  );
}
