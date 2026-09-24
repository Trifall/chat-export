import { formatImageInput } from '@/modules/content-handlers';
import { extractFormattedText } from '@/modules/content-handlers';
import { sweepMountedElements } from '@/modules/scroll-sweep';
import { Message } from '@/modules/types';

async function extractChatGPTMessageContent(
  messageElement: Element,
  role: string
): Promise<string> {
  let content = '';

  const images = messageElement.querySelectorAll('img');
  for (const image of images) {
    // skip favicon images which are used for sources
    if (image.src.includes('google.com/s2/favicons')) continue;

    const imageContent = formatImageInput(image.src, image.alt, role);
    content += imageContent + '\n';
  }

  // query select with class of .whitespace-pre-wrap OR .markdown
  const contentElement = messageElement.querySelector('.whitespace-pre-wrap, .markdown');
  if (!contentElement) {
    return content.trim();
  }

  // create a deep clone of the content element to avoid modifying the actual UI
  const contentClone = contentElement.cloneNode(true) as Element;

  // delete source links by finding elements with the specific structure:
  // span[data-state] > span > a[target="_blank"][rel="noopener"] > span.relative
  const sourceSpans = Array.from(contentClone.querySelectorAll('span[data-state]')).filter(
    (span) => {
      // span has the expected structure for a source link
      const hasExpectedStructure = !!span.querySelector(
        'span > a[target="_blank"][rel="noopener"] > span.relative'
      );
      return hasExpectedStructure;
    }
  );

  // remove the source spans from their parent nodes
  sourceSpans.forEach((span) => {
    if (span.parentNode) {
      span.parentNode.removeChild(span);
    }
  });

  const sourceContainers = new Set<Element>();

  for (const button of contentClone.querySelectorAll('button')) {
    if (button.textContent?.includes('Sources')) {
      const sourceContainer = button.closest('div');
      if (sourceContainer) {
        sourceContainers.add(sourceContainer);
      }
    }
  }

  for (const image of contentClone.querySelectorAll('img')) {
    if (image.src.includes('google.com/s2/favicons')) {
      const sourceContainer = image.closest('div');
      if (sourceContainer) {
        sourceContainers.add(sourceContainer);
      }
    }
  }

  sourceContainers.forEach((container) => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  const extractedText = await extractFormattedText(contentClone);
  content += extractedText;

  return content.trim();
}

function formatChatGPTThinkingLabel(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const trimmedText = text.trim();
  if (!/\bThought for\b/.test(trimmedText)) {
    return null;
  }

  return trimmedText;
}

async function extractChatGPTTurn(turn: Element): Promise<Message | null> {
  const messageDivs = Array.from(turn.querySelectorAll('[data-message-author-role]'));
  const role = messageDivs[0]?.getAttribute('data-message-author-role');
  if (!role) return null;

  const turnParts = Array.from(turn.querySelectorAll('[data-message-author-role], button'));
  const contentParts: string[] = [];

  for (const turnPart of turnParts) {
    if (turnPart.hasAttribute('data-message-author-role')) {
      const messageRole = turnPart.getAttribute('data-message-author-role') || role;
      const contentPart = await extractChatGPTMessageContent(turnPart, messageRole);

      if (contentPart) {
        contentParts.push(contentPart);
      }
      continue;
    }

    const thinkingLabel = formatChatGPTThinkingLabel(turnPart.textContent);
    if (thinkingLabel) {
      contentParts.push(thinkingLabel);
    }
  }

  const content = contentParts.filter(Boolean).join('\n\n').trim();
  return content ? { role, content } : null;
}

export const getChatGPTChatContent = async () => {
  const chatgptMessages: Array<Message> = [];
  const failedChatgptMessages = await sweepMountedElements(
    () => Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]')),
    (turn) =>
      turn.getAttribute('data-turn-id') ??
      turn.getAttribute('data-message-id') ??
      turn.getAttribute('data-testid'),
    async (turn) => {
      const message = await extractChatGPTTurn(turn);
      if (!message) return false;
      chatgptMessages.push(message);
      return true;
    },
    (error) => console.error('Failed to extract message content:', error)
  );

  return { chatgptMessages, failedChatgptMessages };
};
