import {
  closeExistingOverlays,
  extractContentViaEditMode,
  extractRoleFromTurn,
  handleThinkingMessage,
  performTurnScroll,
} from '@/modules/gemini/gemini-helpers';
import { Message } from '@/modules/types';

export const getGeminiChatContent = async () => {
  // aistudio.google.com (Gemini)
  const chatTurns = document.querySelectorAll('ms-chat-turn');

  let failedGeminiMessages = 0;
  const geminiMessages: Array<Message> = [];

  for (const turn of chatTurns) {
    try {
      await closeExistingOverlays();
      await performTurnScroll(turn);

      const { role, container } = extractRoleFromTurn(turn);
      if (!container) {
        failedGeminiMessages++;
        continue;
      }

      // Handle thinking messages
      if (await handleThinkingMessage(turn, role, geminiMessages)) {
        continue;
      }

      // Handle regular messages via edit mode
      const content = await extractContentViaEditMode(turn);
      if (content?.trim()) {
        geminiMessages.push({ role, content: content.trim() });
      } else {
        failedGeminiMessages++;
      }
    } catch (error) {
      console.error('Failed to extract Gemini message:', error);
      failedGeminiMessages++;
    }

    await new Promise((resolve) => setTimeout(resolve, 25)); // Rate limiting
  }

  return { geminiMessages, failedGeminiMessages };
};
