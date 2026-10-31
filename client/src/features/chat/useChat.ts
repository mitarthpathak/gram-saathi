import type { QueryResponse } from '@gram-saathi/shared';
import { createContext, useContext } from 'react';
import type { VoiceNote } from '@/features/voice/speak';

export type ChatMessage =
  | { id: string; role: 'user'; text: string; via: 'text' | 'voice'; pending?: boolean }
  | {
      id: string;
      role: 'assistant';
      response: QueryResponse;
      /** Set after the answer was read aloud automatically with a non-dialect voice. */
      voiceNote?: VoiceNote | null;
    }
  | { id: string; role: 'error'; text: string };

export interface ChatState {
  messages: ChatMessage[];
  /** True while a question is being answered. */
  busy: boolean;
  askText: (text: string) => Promise<void>;
  askVoice: (audio: Blob) => Promise<void>;
  /** The most recent answer (the SMS screen previews it). */
  lastAnswer: QueryResponse | null;
}

export const ChatContext = createContext<ChatState | null>(null);

/** The conversation, kept in ChatProvider so it survives switching screens. */
export function useChat(): ChatState {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error('useChat must be used inside <ChatProvider>');
  return chat;
}
