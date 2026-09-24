import {
  closeExistingOverlays,
  extractContentViaEditMode,
  extractRoleFromTurn,
  handleThinkingMessage,
  performTurnScroll,
} from '@/modules/gemini/gemini-helpers';
import { sweepMountedElements } from '@/modules/scroll-sweep';
import { Message } from '@/modules/types';

export const getGeminiChatContent = async () => {
  const geminiMessages: Array<Message> = [];
  const failedGeminiMessages = await sweepMountedElements(
    () => Array.from(document.querySelectorAll('ms-chat-turn')),
    (turn) =>
      turn.id ||
      turn.getAttribute('data-turn-id') ||
      turn.closest('[data-index]')?.getAttribute('data-index') ||
      null,
    async (turn) => {
      await closeExistingOverlays();
      await performTurnScroll(turn);

      const { role, container } = extractRoleFromTurn(turn);
      if (!container) return false;

      if (await handleThinkingMessage(turn, role, geminiMessages)) return true;

      const content = await extractContentViaEditMode(turn);
      if (!content?.trim()) return false;

      geminiMessages.push({ role, content: content.trim() });
      return true;
    },
    (error) => console.error('Failed to extract Gemini message:', error)
  );

  return { geminiMessages, failedGeminiMessages };
};
