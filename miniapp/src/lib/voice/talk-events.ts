import { type Json, readTalkEvent } from 'backend/protocol';
import type { FridayFace } from '../face/friday-face.ts';
import type { createConversationCloser } from './conversation-close.ts';
export function handleTalkEvent(
  raw: Json,
  sessionId: string | undefined,
  callbacks: {
    face: FridayFace;
    closer: ReturnType<typeof createConversationCloser>;
    caption: (text: string) => void;
    error: (message: string) => void;
    ended: () => void;
  },
): void {
  const event = readTalkEvent(raw);
  if (!event || !sessionId || event.sessionId !== sessionId) return;
  const { payload, type } = event;
  const value = payload.text || payload.transcript || payload.delta || payload.message;
  const text = typeof value === 'string' ? value : '';
  callbacks.face.event(type, text);
  if (
    ['transcript.delta', 'transcript.done', 'output.text.delta', 'output.text.done'].includes(
      type,
    ) &&
    text
  )
    callbacks.caption(text);
  if (type.startsWith('transcript.')) callbacks.closer.cancel();
  if (type.startsWith('output.text.')) callbacks.closer.output();
  if (
    type === 'tool.result' &&
    payload.toolName === 'end_conversation' &&
    payload.source === 'gpt-live-delegation' &&
    payload.status === 'close_requested'
  )
    callbacks.closer.request(payload.requestId);
  if (type === 'session.error') callbacks.error(text || 'The voice session reported an error');
  if (type === 'session.closed') callbacks.ended();
}
