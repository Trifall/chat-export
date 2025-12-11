import optionsStorage from '../options-storage';

import { getChatGPTChatContent } from '@/modules/chatgpt/chat-content';
import { getClaudeChatContent } from '@/modules/claude/chat-content';
import { getGeminiChatContent } from '@/modules/gemini/chat-content';

import { formatContent } from './content-handlers';
import { detectSite } from './site-detection';
import { ChatContent, Message } from './types';

export async function getChatContent(restoreClipboard: boolean = false): Promise<ChatContent> {
  const site = detectSite();
  const messages: Array<Message> = [];
  let failedMessages = 0;
  const originalClipboard = await navigator.clipboard.readText();

  if (site === 'chatgpt') {
    const { chatgptMessages, failedChatgptMessages } = await getChatGPTChatContent();
    messages.push(...chatgptMessages);
    failedMessages += failedChatgptMessages;
  } else if (site === 'gemini') {
    const { geminiMessages, failedGeminiMessages } = await getGeminiChatContent();
    messages.push(...geminiMessages);
    failedMessages += failedGeminiMessages;
  } else {
    const { claudeMessages, failedClaudeMessages } = await getClaudeChatContent();
    messages.push(...claudeMessages);
    failedMessages += failedClaudeMessages;
  }

  // get user's preferred format
  const options = await optionsStorage.getAll();
  const format = options.exportType || 'markdown';

  // restore original clipboard content
  if (restoreClipboard) {
    await navigator.clipboard.writeText(originalClipboard);
  }

  const formattedContent = await formatContent(messages, format);
  return { format, content: formattedContent, messageCount: messages.length, failedMessages };
}
