import {
  extractAllClaudePastedContent,
  getPastedBlockTarget,
} from '../src/modules/claude/pasted-content';
import { orderSweepValues, sweepMountedElements } from '../src/modules/scroll-sweep';
import { expect, test } from '@playwright/test';

class MockElement {
  constructor(
    readonly id: number,
    public parentElement: MockElement | null
  ) {}

  get isConnected(): boolean {
    return this.parentElement instanceof MockScrollContainer
      ? this.parentElement.isRowConnected(this.id)
      : true;
  }

  contains(element: MockElement): boolean {
    let current: MockElement | null = element;
    while (current) {
      if (current === this) return true;
      current = current.parentElement;
    }
    return false;
  }

  getBoundingClientRect(): { top: number } {
    return { top: this.id * 100 };
  }
}

class MockScrollContainer extends MockElement {
  readonly scrollHeight = 5000;
  readonly clientHeight = 300;
  readonly style = { scrollBehavior: '' };
  scrollTop = 1250;

  scrollTo(options: { top: number }): void {
    this.scrollTop = options.top;
  }

  isRowConnected(id: number): boolean {
    const start = Math.max(0, Math.floor(this.scrollTop / 100) - 1);
    return id >= start && id < start + 8;
  }
}

test('ignores pasted words in message content', async () => {
  const messageContainer = {} as Element;
  const attachment = {
    parentElement: messageContainer,
    querySelector: () => null,
    closest: () => null,
  } as unknown as Element;
  const badge = {
    textContent: 'const pasted = true;',
    closest: () => attachment,
  } as unknown as Element;

  Object.assign(messageContainer, {
    querySelectorAll: (selector: string) =>
      (selector === '.flex-col .text-text-300' ? [badge] : []) as unknown as NodeListOf<Element>,
  });

  await expect(extractAllClaudePastedContent(messageContainer)).resolves.toEqual([]);
});

test('uses the button wrapping a pasted thumbnail', () => {
  const messageContainer = {} as Element;
  const thumbnail = {} as Element;
  const button = { parentElement: thumbnail } as unknown as Element;
  const flexCol = {
    parentElement: button,
    querySelector: () => null,
    closest: (selector: string) => (selector === 'button' ? button : thumbnail),
  } as unknown as Element;

  expect(getPastedBlockTarget(flexCol, messageContainer)).toBe(button);
});

test('orders collected rows by logical index with encounter fallback', () => {
  const values = orderSweepValues([
    { order: 35, sequence: 0, value: 'tail' },
    { order: 0, sequence: 1, value: 'head' },
    { order: null, sequence: 2, value: 'unkeyed' },
  ]);

  expect(values).toEqual(['head', 'tail', 'unkeyed']);
});

test('processes rows in visual order when the DOM order is scrambled', async () => {
  const scroller = new MockScrollContainer(-1, null);
  scroller.scrollTop = 0;
  const rows = [3, 1, 4, 0, 2].map((id) => new MockElement(id, null));
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  Object.assign(globalThis, {
    document: { scrollingElement: scroller, documentElement: scroller },
    window: { innerHeight: 300 },
    getComputedStyle: () => ({ overflowY: 'auto' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });

  try {
    const processed: number[] = [];
    const scrollTops: number[] = [];
    const failed = await sweepMountedElements(
      () => [...rows] as unknown as Element[],
      (element) => String((element as unknown as MockElement).id),
      async (element, info) => {
        processed.push((element as unknown as MockElement).id);
        scrollTops.push(info.scrollTop);
        return true;
      },
      (error) => {
        throw error;
      }
    );

    expect(failed).toBe(0);
    expect(processed).toEqual([0, 1, 2, 3, 4]);
    expect(scrollTops).toEqual([0, 0, 0, 0, 0]);
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
      getComputedStyle: originalGetComputedStyle,
      requestAnimationFrame: originalRequestAnimationFrame,
    });
  }
});

class DriftingScrollContainer extends MockScrollContainer {
  scrollToCalls = 0;

  scrollTo(options: { top: number }): void {
    this.scrollToCalls++;
    this.scrollTop = options.top + 5;
  }
}

test('proceeds without spinning when the container never settles', async () => {
  const scroller = new DriftingScrollContainer(-1, null);
  scroller.scrollTop = 0;
  (scroller as { scrollHeight: number }).scrollHeight = 1000;
  const rows = [0, 1, 2, 3, 4].map((id) => new MockElement(id, null));
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  Object.assign(globalThis, {
    document: { scrollingElement: scroller, documentElement: scroller },
    window: { innerHeight: 300 },
    getComputedStyle: () => ({ overflowY: 'auto' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });

  try {
    const processed: number[] = [];
    const failed = await sweepMountedElements(
      () => [...rows] as unknown as Element[],
      (element) => String((element as unknown as MockElement).id),
      async (element) => {
        processed.push((element as unknown as MockElement).id);
        return true;
      },
      (error) => {
        throw error;
      }
    );

    expect(failed).toBe(0);
    expect(processed).toEqual([0, 1, 2, 3, 4]);
    expect(scroller.scrollToCalls).toBeLessThan(30);
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
      getComputedStyle: originalGetComputedStyle,
      requestAnimationFrame: originalRequestAnimationFrame,
    });
  }
});

test('captures every virtualized row and restores the scroll position', async () => {
  const scroller = new MockScrollContainer(-1, null);
  const rows = Array.from({ length: 50 }, (_, id) => new MockElement(id, scroller));
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  Object.assign(globalThis, {
    document: { scrollingElement: scroller, documentElement: scroller },
    window: { innerHeight: 300 },
    getComputedStyle: () => ({ overflowY: 'auto' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });

  try {
    const messages: number[] = [];
    const failed = await sweepMountedElements(
      () => {
        const start = Math.max(0, Math.floor(scroller.scrollTop / 100) - 1);
        return rows.slice(start, start + 8) as unknown as Element[];
      },
      (element) => String((element as unknown as MockElement).id),
      async (element) => {
        messages.push((element as unknown as MockElement).id);
        scroller.scrollTop = 0;
        return true;
      },
      (error) => {
        throw error;
      }
    );

    expect(failed).toBe(0);
    expect(messages).toEqual(rows.map((row) => row.id));
    expect(scroller.scrollTop).toBe(1250);
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      window: originalWindow,
      getComputedStyle: originalGetComputedStyle,
      requestAnimationFrame: originalRequestAnimationFrame,
    });
  }
});
