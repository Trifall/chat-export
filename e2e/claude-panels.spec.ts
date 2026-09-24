import { findArtifactCopyButton, getArtifactCodeText } from '../src/modules/claude/artifacts';
import { isPastedOnlyMessage } from '../src/modules/claude/chat-content';
import { readClipboardText, waitForClipboardChange } from '../src/modules/claude/clipboard';
import {
  findPastedContentElement,
  findPastedCopyButton,
  getAttachmentLineCount,
  getPastedDocumentText,
} from '../src/modules/claude/pasted-content';
import { expect, test } from '@playwright/test';

function fakeScope(entries: Record<string, Element | Element[] | null>): ParentNode {
  const pick = (selector: string) => entries[selector] ?? null;
  return {
    querySelector: (selector: string) => {
      const value = pick(selector);
      return (Array.isArray(value) ? (value[0] ?? null) : value) as Element | null;
    },
    querySelectorAll: (selector: string) => {
      const value = pick(selector);
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list as unknown as NodeListOf<Element>;
    },
  } as unknown as ParentNode;
}

function fakeButton(text: string, siblingTag?: string): HTMLButtonElement {
  return {
    textContent: text,
    hasAttribute: () => false,
    nextElementSibling: siblingTag ? ({ tagName: siblingTag } as Element) : null,
  } as unknown as HTMLButtonElement;
}

test('finds the artifact copy button in the split dropdown', () => {
  const copy = fakeButton('Copy');
  const scope = fakeScope({
    'div[data-cds="SplitDropdownButton"][aria-label="Copy"] button': [copy, fakeButton('')],
  });

  expect(findArtifactCopyButton(scope)).toBe(copy);
});

test('falls back to the legacy artifact copy button', () => {
  const copy = fakeButton('Copy', 'BUTTON');
  const scope = fakeScope({
    'div[data-cds="SplitDropdownButton"][aria-label="Copy"] button': [],
    button: [copy],
  });

  expect(findArtifactCopyButton(scope)).toBe(copy);
});

test('reads artifact code lines in order', () => {
  const line = (text: string) =>
    ({
      textContent: text,
      querySelector: () => null,
    }) as unknown as Element;
  const code = {
    textContent: 'FROM xRUN y',
    querySelectorAll: () => [line('FROM x'), line('RUN y')],
  } as unknown as Element;

  expect(getArtifactCodeText(code)).toBe('FROM x\nRUN y');
});

test('reads grouped artifact code lines without duplicating groups', () => {
  const code = {
    textContent: 'group one two',
    querySelectorAll: (selector: string) =>
      (selector.includes('data-code-line-group')
        ? [{ textContent: 'one\n' }, { textContent: 'two\n' }]
        : []) as unknown as NodeListOf<Element>,
  } as unknown as Element;

  expect(getArtifactCodeText(code)).toBe('one\ntwo');
});

test('reads pasted document lines in index order', () => {
  const line = (index: string, text: string) =>
    ({
      textContent: text,
      getAttribute: () => index,
    }) as unknown as Element;
  const container = {
    querySelectorAll: () => [line('1', 'second'), line('0', 'first')],
  } as unknown as Element;

  expect(getPastedDocumentText(container)).toBe('first\nsecond');
});

test('parses the attachment line count label', () => {
  const labeled = { getAttribute: () => 'Attachment text, 80 lines' } as unknown as Element;
  const unlabeled = { getAttribute: () => null } as unknown as Element;

  expect(getAttachmentLineCount(labeled)).toBe(80);
  expect(getAttachmentLineCount(unlabeled)).toBeNull();
});

function mockClipboard(readText: () => Promise<string>): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: { readText } },
    configurable: true,
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'navigator', descriptor);
    }
  };
}

test('waits for the clipboard to change instead of reading stale content', async () => {
  const reads = ['previous artifact', 'previous artifact', 'pasted content'];
  const restore = mockClipboard(async () => reads.shift() ?? '');

  try {
    await expect(waitForClipboardChange('previous artifact', 1000)).resolves.toBe('pasted content');
  } finally {
    restore();
  }
});

test('gives up waiting when the clipboard never changes', async () => {
  const restore = mockClipboard(async () => 'stale');

  try {
    await expect(waitForClipboardChange('stale', 50)).resolves.toBe('');
  } finally {
    restore();
  }
});

test('reads empty text when the clipboard throws', async () => {
  const restore = mockClipboard(async () => {
    throw new Error('denied');
  });

  try {
    await expect(readClipboardText()).resolves.toBe('');
  } finally {
    restore();
  }
});

test('recognizes nested pasted-only attachment cards', () => {
  const group = {} as Element;
  const thumbnail = {} as Element;
  const button = { parentElement: thumbnail } as unknown as Element;
  const flexCol = {
    parentElement: button,
    querySelector: () => null,
    closest: (selector: string) =>
      selector === 'button' ? button : selector.includes('file-thumbnail') ? thumbnail : null,
  } as unknown as Element;
  const badge = {
    textContent: 'pasted',
    closest: () => flexCol,
  } as unknown as Element;

  Object.assign(group, {
    matches: (selector: string) => selector === 'div[data-test-render-count]',
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      (selector === '.flex-col .text-text-300' ? [badge] : []) as unknown as NodeListOf<Element>,
  });

  expect(isPastedOnlyMessage(group)).toBe(true);
});

test('finds the pasted panel copy button', () => {
  const copy = fakeButton('Copy attachment text');
  const scope = fakeScope({ 'button[aria-label="Copy attachment text"]': copy });

  expect(findPastedCopyButton(scope)).toBe(copy);
});

test('finds pasted content in the attachment text document', () => {
  const content = {} as Element;
  const scope = fakeScope({
    '.whitespace-pre-wrap.break-all.text-xs': null,
    'div[role="document"][aria-label^="Attachment text"]': content,
    'div[role="dialog"][data-state="open"], div[role="dialog"]': null,
  });

  expect(findPastedContentElement(scope)).toBe(content);
});
