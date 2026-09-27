import {
  getChatGPTMessageKey,
  getChatGPTMessageRole,
  getChatGPTRowTop,
  isFaviconImage,
} from '../src/modules/chatgpt/chat-content';
import { expect, test } from '@playwright/test';

function fakeChatElement(parts: {
  bubble?: boolean;
  testid?: string | null;
  role?: string | null;
  messageId?: string | null;
  unitKey?: string | null;
  contentKey?: string | null;
  messageIds?: string | null;
  h4Role?: string | null;
  top?: number | null;
}): Element {
  return {
    matches: (selector: string) =>
      (selector === '[data-user-message-bubble="true"]' && !!parts.bubble) ||
      (selector === '[data-testid="assistant-message"]' && parts.testid === 'assistant-message'),
    getAttribute: (name: string) => {
      if (name === 'data-message-author-role') return parts.role ?? null;
      if (name === 'data-message-id') return parts.messageId ?? null;
      if (name === 'data-testid') return parts.testid ?? null;
      if (name === 'data-chatgpt-search-unit-key') return parts.unitKey ?? null;
      return null;
    },
    querySelector: (selector: string) =>
      selector === 'h4[data-conversation-role]' && parts.h4Role
        ? ({ getAttribute: () => parts.h4Role } as unknown as Element)
        : null,
    getBoundingClientRect: () => ({ top: parts.top ?? 0 }),
    closest: (selector: string) => {
      if (!selector.includes('search-unit-key') && !selector.includes('search-message-ids')) {
        return null;
      }
      if (!parts.unitKey && !parts.contentKey && !parts.messageIds) return null;
      return {
        getAttribute: (name: string) => {
          if (name === 'data-chatgpt-search-message-ids') return parts.messageIds ?? null;
          if (name === 'data-chatgpt-search-unit-key') return parts.unitKey ?? null;
          if (name === 'data-content-search-unit-key') return parts.contentKey ?? null;
          return null;
        },
      };
    },
  } as unknown as Element;
}

test('detects new ChatGPT message roles', () => {
  expect(getChatGPTMessageRole(fakeChatElement({ bubble: true }))).toBe('user');
  expect(getChatGPTMessageRole(fakeChatElement({ testid: 'assistant-message' }))).toBe('assistant');
  expect(getChatGPTMessageRole(fakeChatElement({ role: 'user' }))).toBe('user');
  expect(getChatGPTMessageRole(fakeChatElement({ unitKey: 'fallback-turn-0:2:assistant' }))).toBe(
    'assistant'
  );
  expect(getChatGPTMessageRole(fakeChatElement({ h4Role: 'assistant' }))).toBe('assistant');
  expect(getChatGPTMessageRole(fakeChatElement({}))).toBeNull();
});

test('keys ChatGPT messages by content search unit key', () => {
  expect(
    getChatGPTMessageKey(fakeChatElement({ bubble: true, contentKey: 'fallback-turn-7:1:user' }))
  ).toBe('fallback-turn-7:1:user:user');
});

test('recognizes favicon images from any host', () => {
  expect(
    isFaviconImage('https://www.google.com/s2/favicons?domain=https://github.com&sz=128')
  ).toBe(true);
  expect(
    isFaviconImage(
      'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=https%3A%2F%2Fdocs.typesafe.ai'
    )
  ).toBe(true);
  expect(isFaviconImage('https://example.com/photos/cat.png')).toBe(false);
});

test('measures ChatGPT rows by absolute top', () => {
  expect(getChatGPTRowTop(fakeChatElement({ top: 1518 }), 13762)).toBe(15280);
  expect(getChatGPTRowTop(fakeChatElement({}), 0)).toBe(0);
  expect(getChatGPTRowTop({} as Element, 100)).toBe(100);
});

test('ignores turn metadata when measuring row position', () => {
  expect(
    getChatGPTRowTop(fakeChatElement({ unitKey: 'fallback-turn-0:2:assistant', top: 500 }), -250000)
  ).toBe(-249500);
});

test('keys ChatGPT messages by unit and role', () => {
  expect(
    getChatGPTMessageKey(
      fakeChatElement({
        testid: 'assistant-message',
        unitKey: 'fallback-turn-0:2:assistant',
        messageIds: 'uuid-1 uuid-1',
      })
    )
  ).toBe('uuid-1 uuid-1:assistant');
  expect(
    getChatGPTMessageKey(fakeChatElement({ bubble: true, unitKey: 'fallback-turn-0:0:user' }))
  ).toBe('fallback-turn-0:0:user:user');
  expect(
    getChatGPTMessageKey(fakeChatElement({ role: 'assistant', messageId: 'a424f827-9ab8-452d' }))
  ).toBe('a424f827-9ab8-452d:assistant');
  expect(
    getChatGPTMessageKey(
      fakeChatElement({
        role: 'assistant',
        messageId: 'message-1',
        unitKey: 'fallback-turn-1:0:assistant',
      })
    )
  ).toBe('fallback-turn-1:0:assistant:assistant');
  expect(getChatGPTMessageKey(fakeChatElement({ bubble: true }))).toBeNull();
});
