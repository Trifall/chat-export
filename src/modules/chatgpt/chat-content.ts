import { formatImageInput } from '@/modules/content-handlers';
import { extractFormattedText } from '@/modules/content-handlers';
import { SweepOrderedValue, orderSweepValues, sweepMountedElements } from '@/modules/scroll-sweep';
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

  // create a deep clone of the message to avoid modifying the actual UI
  const contentClone = messageElement.cloneNode(true) as Element;

  // strip code block headers, collapsed-message toggles, citations and favicons
  contentClone
    .querySelectorAll('[data-markdown-copy="exclude"], [data-thread-find-skip]')
    .forEach((node) => node.remove());
  contentClone
    .querySelectorAll('a[data-testid="chatgpt-citation"]')
    .forEach((node) => node.remove());

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

  const thinkingLabel = role === 'assistant' ? findThinkingLabel(messageElement) : null;
  const extractedText = await extractFormattedText(contentClone);
  content += extractedText;

  const body = content.trim();
  if (thinkingLabel && body) return `${thinkingLabel}\n\n${body}`;
  return thinkingLabel || body;
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

export function getChatGPTMessageRole(element: Element): string | null {
  if (element.matches('[data-user-message-bubble="true"]')) return 'user';
  if (element.matches('[data-testid="assistant-message"]')) return 'assistant';
  const roleAttribute = element.getAttribute('data-message-author-role');
  if (roleAttribute) return roleAttribute;
  const unitKey = element.getAttribute('data-chatgpt-search-unit-key') || '';
  const unitRole = unitKey.match(/:(user|assistant)$/);
  if (unitRole) return unitRole[1];
  return (
    element.querySelector('h4[data-conversation-role]')?.getAttribute('data-conversation-role') ??
    null
  );
}

function getChatGPTMessageElements(): Element[] {
  const messages = Array.from(
    document.querySelectorAll(
      '[data-user-message-bubble="true"], [data-testid="assistant-message"], [data-message-author-role="user"], [data-message-author-role="assistant"]'
    )
  );
  const units = Array.from(document.querySelectorAll('[data-chatgpt-search-unit-key]')).filter(
    (unit) =>
      /:(user|assistant)$/.test(unit.getAttribute('data-chatgpt-search-unit-key') || '') &&
      !unit.querySelector(
        '[data-user-message-bubble="true"], [data-testid="assistant-message"], [data-message-author-role]'
      )
  );
  return [...messages, ...units];
}

export function getChatGPTMessageOrder(element: Element): number | null {
  const unit = element.closest('[data-chatgpt-search-unit-key]');
  const match = (unit?.getAttribute('data-chatgpt-search-unit-key') || '').match(/turn-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function getChatGPTMessageKey(element: Element): string | null {
  const role = getChatGPTMessageRole(element);
  const unit = element.closest('[data-chatgpt-search-message-ids], [data-chatgpt-search-unit-key]');
  const ids =
    unit?.getAttribute('data-chatgpt-search-message-ids') ??
    unit?.getAttribute('data-chatgpt-search-unit-key');
  return role && ids ? `${ids}:${role}` : null;
}

function findThinkingLabel(assistantElement: Element): string | null {
  let sibling = assistantElement.previousElementSibling;
  for (let depth = 0; depth < 5 && sibling; depth++) {
    const label = formatChatGPTThinkingLabel(sibling.textContent);
    if (label) return label;
    sibling = sibling.previousElementSibling;
  }
  return null;
}

async function extractChatGPTMessage(element: Element): Promise<Message | null> {
  const role = getChatGPTMessageRole(element);
  if (!role) return null;
  const content = await extractChatGPTMessageContent(element, role);
  return content.trim() ? { role, content: content.trim() } : null;
}

export const getChatGPTChatContent = async () => {
  const collectedMessages: Array<SweepOrderedValue<Message>> = [];
  let sequence = 0;
  const failedChatgptMessages = await sweepMountedElements(
    () => getChatGPTMessageElements().filter((element) => getChatGPTMessageRole(element) !== null),
    getChatGPTMessageKey,
    async (element) => {
      const message = await extractChatGPTMessage(element);
      if (!message) return false;
      collectedMessages.push({
        order: getChatGPTMessageOrder(element),
        sequence: sequence++,
        value: message,
      });
      return true;
    },
    (error) => console.error('Failed to extract message content:', error)
  );

  return { chatgptMessages: orderSweepValues(collectedMessages), failedChatgptMessages };
};
