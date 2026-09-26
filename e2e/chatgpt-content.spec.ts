import {
  getChatGPTMessageKey,
  getChatGPTMessageOrder,
  getChatGPTMessageRole,
} from '../src/modules/chatgpt/chat-content';
import { expect, test } from '@playwright/test';

function fakeChatElement(parts: {
  bubble?: boolean;
  testid?: string | null;
  role?: string | null;
  unitKey?: string | null;
  messageIds?: string | null;
  h4Role?: string | null;
}): Element {
  return {
    matches: (selector: string) =>
      (selector === '[data-user-message-bubble="true"]' && !!parts.bubble) ||
      (selector === '[data-testid="assistant-message"]' && parts.testid === 'assistant-message'),
    getAttribute: (name: string) => {
      if (name === 'data-message-author-role') return parts.role ?? null;
      if (name === 'data-testid') return parts.testid ?? null;
      if (name === 'data-chatgpt-search-unit-key') return parts.unitKey ?? null;
      return null;
    },
    querySelector: (selector: string) =>
      selector === 'h4[data-conversation-role]' && parts.h4Role
        ? ({ getAttribute: () => parts.h4Role } as unknown as Element)
        : null,
    closest: (selector: string) => {
      if (!selector.includes('data-chatgpt-search') || !parts.unitKey) return null;
      return {
        getAttribute: (name: string) =>
          name === 'data-chatgpt-search-message-ids'
            ? (parts.messageIds ?? parts.unitKey)
            : parts.unitKey,
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

test('orders ChatGPT messages by search unit turn', () => {
  expect(getChatGPTMessageOrder(fakeChatElement({ unitKey: 'fallback-turn-0:2:assistant' }))).toBe(
    0
  );
  expect(getChatGPTMessageOrder(fakeChatElement({ unitKey: 'fallback-turn-12:0:user' }))).toBe(12);
  expect(getChatGPTMessageOrder(fakeChatElement({}))).toBeNull();
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
  expect(getChatGPTMessageKey(fakeChatElement({ bubble: true }))).toBeNull();
});
