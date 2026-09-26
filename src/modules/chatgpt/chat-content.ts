import { formatImageInput } from '@/modules/content-handlers';
import { extractFormattedText } from '@/modules/content-handlers';
import {
  SweepElementInfo,
  SweepOrderedValue,
  orderSweepValues,
  sweepDebugLog,
  sweepMountedElements,
} from '@/modules/scroll-sweep';
import { Message } from '@/modules/types';

export function isFaviconImage(src: string): boolean {
  // Source pills render favicons from varying hosts
  // (google.com/s2/favicons, t0.gstatic.com/faviconV2, ...).
  return src.toLowerCase().includes('favicon');
}

async function extractChatGPTMessageContent(
  messageElement: Element,
  role: string
): Promise<string> {
  let content = '';

  const images = messageElement.querySelectorAll('img');
  for (const image of images) {
    // skip favicon images which are used for sources
    if (isFaviconImage(image.src)) continue;

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
    if (isFaviconImage(image.src)) {
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

const CHATGPT_UNIT_SELECTOR =
  '[data-chatgpt-search-message-ids], [data-chatgpt-search-unit-key], [data-content-search-unit-key]';

function getChatGPTUnitKey(unit: Element | null): string | null {
  return (
    unit?.getAttribute('data-chatgpt-search-message-ids') ??
    unit?.getAttribute('data-chatgpt-search-unit-key') ??
    unit?.getAttribute('data-content-search-unit-key') ??
    null
  );
}

function getChatGPTMessageId(element: Element | null): string | null {
  return element?.getAttribute('data-message-id') ?? null;
}

export function getChatGPTMessageOrder(element: Element): number | null {
  const key = getChatGPTUnitKey(element.closest(CHATGPT_UNIT_SELECTOR)) || '';
  const match = key.match(/turn-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function getChatGPTMessageKey(element: Element): string | null {
  const role = getChatGPTMessageRole(element);
  const ids =
    getChatGPTUnitKey(element.closest(CHATGPT_UNIT_SELECTOR)) ?? getChatGPTMessageId(element);
  return role && ids ? `${ids}:${role}` : null;
}

function findSameTurn(element: Element): Element | null {
  const testid = element.getAttribute('data-testid');
  if (testid) {
    try {
      return document.querySelector(`[data-testid="${CSS.escape(testid)}"]`);
    } catch {
      return null;
    }
  }
  const messageId = getChatGPTMessageId(element);
  if (messageId) {
    try {
      return document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    } catch {
      return null;
    }
  }
  for (const name of [
    'data-chatgpt-search-message-ids',
    'data-chatgpt-search-unit-key',
    'data-content-search-unit-key',
  ]) {
    const value = element.getAttribute(name) ?? element.closest(`[${name}]`)?.getAttribute(name);
    if (!value) continue;
    try {
      const found = document.querySelector(`[${name}="${CSS.escape(value)}"]`);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

export function getChatGPTRowTop(element: Element, scrollTop: number): number {
  try {
    return (element.getBoundingClientRect?.()?.top ?? 0) + scrollTop;
  } catch {
    return scrollTop;
  }
}

export function estimateOrderFromSiblings(element: Element, siblings: Element[]): number | null {
  const index = siblings.indexOf(element);
  if (index === -1) return null;
  for (let before = index - 1; before >= 0; before--) {
    const order = getChatGPTMessageOrder(siblings[before]);
    if (order !== null) return order + 0.5;
  }
  for (let after = index + 1; after < siblings.length; after++) {
    const order = getChatGPTMessageOrder(siblings[after]);
    if (order !== null) return order - 0.5;
  }
  return null;
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
    async (element, info: SweepElementInfo) => {
      // Virtualized rows are absolutely positioned, so DOM order is
      // meaningless. The absolute vertical position is the conversation order.
      const resolveOrder = (target: Element): number | null =>
        getChatGPTMessageOrder(target) ??
        estimateOrderFromSiblings(target, getChatGPTMessageElements()) ??
        getChatGPTRowTop(target, info.scrollTop);
      const first = await extractChatGPTMessage(element);
      if (first) {
        const order = resolveOrder(element);
        sweepDebugLog('chatgpt row', {
          key: getChatGPTMessageKey(element),
          order,
          chars: first.content.length,
        });
        collectedMessages.push({ order, sequence: sequence++, value: first });
        return true;
      }
      sweepDebugLog('chatgpt row empty, retrying', { key: getChatGPTMessageKey(element) });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const fresh = findSameTurn(element) ?? (element.isConnected ? element : null);
      if (!fresh) return false;
      const second = await extractChatGPTMessage(fresh);
      if (!second) {
        sweepDebugLog('chatgpt row empty after retry', { key: getChatGPTMessageKey(fresh) });
        return false;
      }
      const order = resolveOrder(fresh);
      sweepDebugLog('chatgpt row', {
        key: getChatGPTMessageKey(fresh),
        order,
        chars: second.content.length,
      });
      collectedMessages.push({ order, sequence: sequence++, value: second });
      return true;
    },
    (error) => console.error('Failed to extract message content:', error)
  );

  const chatgptMessages = orderSweepValues(collectedMessages);
  sweepDebugLog('chatgpt done', {
    rows: chatgptMessages.length,
    chars: chatgptMessages.reduce((total, message) => total + message.content.length, 0),
    failed: failedChatgptMessages,
  });
  return { chatgptMessages, failedChatgptMessages };
};
