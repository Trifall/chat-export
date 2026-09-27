export interface SweepOrderedValue<T> {
  order: number | null;
  sequence: number;
  value: T;
}

export function isSweepDebugEnabled(): boolean {
  try {
    const search = window.location.search || '';
    if (new URLSearchParams(search).get('chat-export-debug') === '1') return true;
    return window.localStorage?.getItem('chat-export-debug') === '1';
  } catch {
    return false;
  }
}

export function sweepDebugLog(...args: unknown[]): void {
  if (isSweepDebugEnabled()) {
    console.debug('[chat-export-sweep]', ...args);
  }
}

export function orderSweepValues<T>(items: Array<SweepOrderedValue<T>>): Array<T> {
  return [...items]
    .sort(
      (first, second) =>
        (first.order ?? Number.MAX_SAFE_INTEGER) - (second.order ?? Number.MAX_SAFE_INTEGER) ||
        first.sequence - second.sequence
    )
    .map((item) => item.value);
}

export interface SweepElementInfo {
  scrollTop: number;
  prependOffset: number;
}

// Layout growth above the viewport (history segments prepending in a
// reverse container) shifts every absolute position measured afterwards.
// Attribute growth to a prepend only when the scroll position shifted by
// roughly the same amount: estimate corrections and below-viewport growth
// leave scrollTop alone, intentional moves happen without growth.
export function estimatePrependGrowth(heightDelta: number, nativeDelta: number): number {
  if (heightDelta <= 0) return 0;
  const slack = Math.max(8, heightDelta * 0.05);
  return Math.abs(Math.abs(nativeDelta) - heightDelta) <= slack ? heightDelta : 0;
}

export interface SweepOptions {
  preloadHistory?: boolean;
  isLoadingMore?: () => boolean;
}

export type ScrollDirectionMode = 'normal' | 'negative-reverse' | 'positive-reverse';

export function toNativeScrollTop(
  distFromTop: number,
  maxScroll: number,
  mode: ScrollDirectionMode
): number {
  if (mode === 'negative-reverse') return distFromTop - maxScroll;
  if (mode === 'positive-reverse') return maxScroll - distFromTop;
  return distFromTop;
}

export function fromNativeScrollTop(
  native: number,
  maxScroll: number,
  mode: ScrollDirectionMode
): number {
  if (mode === 'negative-reverse') return native + maxScroll;
  if (mode === 'positive-reverse') return maxScroll - native;
  return native;
}

export function detectScrollDirectionMode(container: HTMLElement): ScrollDirectionMode {
  let flexDirection = '';
  try {
    flexDirection = getComputedStyle(container).flexDirection;
  } catch {
    return 'normal';
  }
  if (flexDirection !== 'column-reverse') return 'normal';
  // Column-reverse puts the bottom (latest content) at scrollTop 0 in every
  // engine, but the sign convention away from bottom differs (negative in
  // Blink/WebKit, positive in Gecko). Probe empirically from the bottom: a
  // 50px nudge is harmless anywhere in a paginated thread.
  try {
    const original = container.scrollTop;
    container.scrollTop = 0;
    container.scrollTop = -50;
    if (container.scrollTop < 0) {
      container.scrollTop = original;
      return 'negative-reverse';
    }
    container.scrollTop = 50;
    if (container.scrollTop > 0) {
      container.scrollTop = original;
      return 'positive-reverse';
    }
    container.scrollTop = original;
  } catch {
    // fall through
  }
  return 'normal';
}

async function preloadFullHistory(
  scrollToDist: (distFromTop: number) => void,
  maxScrollExtent: () => number,
  viewportHeight: () => number,
  waitForRender: (delay?: number) => Promise<void>,
  isLoadingMore: (() => boolean) | undefined,
  debugLog: (...args: unknown[]) => void
): Promise<void> {
  // Paginated threads (ChatGPT) only load older segments when driven to the
  // top edge. Keep going until two consecutive rounds grow nothing, then
  // nudge down and back: a slow straggler arriving during the quiet period
  // must not end the preload early.
  for (let cycle = 0; cycle < 3; cycle++) {
    let quietRounds = 0;
    let stagnantRounds = 0;
    for (let round = 0; round < 300 && quietRounds < 2 && stagnantRounds < 20; round++) {
      const before = maxScrollExtent();
      scrollToDist(0);
      await waitForRender(500);
      let started = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        await waitForRender(200);
        // Growth only: skeleton removal shrinks are not loads.
        if (maxScrollExtent() > before || isLoadingMore?.() === true) {
          started = true;
          break;
        }
      }
      if (!started) {
        quietRounds++;
        debugLog('preload quiet round', { cycle, round, quietRounds, height: maxScrollExtent() });
        continue;
      }
      quietRounds = 0;
      let stablePasses = 0;
      let lastHeight = -1;
      for (let attempt = 0; attempt < 20; attempt++) {
        await waitForRender(250);
        const height = maxScrollExtent();
        if (height === lastHeight && isLoadingMore?.() !== true) {
          stablePasses++;
          if (stablePasses >= 3) break;
        } else {
          stablePasses = 0;
          lastHeight = height;
        }
      }
      if (maxScrollExtent() === before) {
        stagnantRounds++;
      } else {
        stagnantRounds = 0;
      }
      debugLog('preload round settled', { cycle, round, height: maxScrollExtent() });
    }
    if (stagnantRounds >= 20) {
      debugLog('preload stagnant, giving up', { cycle, height: maxScrollExtent() });
      break;
    }
    const before = maxScrollExtent();
    scrollToDist(Math.min(viewportHeight(), before));
    await waitForRender(600);
    scrollToDist(0);
    let verified = true;
    for (let attempt = 0; attempt < 6; attempt++) {
      await waitForRender(200);
      if (maxScrollExtent() !== before || isLoadingMore?.() === true) {
        verified = false;
        break;
      }
    }
    debugLog('preload nudge check', { cycle, verified, height: maxScrollExtent() });
    if (verified) break;
  }
  debugLog('preload done', { height: maxScrollExtent() });
}

export async function sweepMountedElements(
  getElements: () => Element[],
  getKey: (element: Element) => string | null,
  processElement: (element: Element, info: SweepElementInfo) => Promise<boolean>,
  onError: (error: unknown) => void,
  options?: SweepOptions
): Promise<number> {
  const waitForRender = (delay = 100) =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(resolve, delay));
      });
    });

  const scrollerHeight = (scrollContainer: HTMLElement) =>
    scrollContainer.clientHeight || window.innerHeight;

  const isDebugLoggingEnabled = () => isSweepDebugEnabled();

  const describeElement = (element: Element | null) => {
    if (!element || typeof (element as HTMLElement).tagName !== 'string') return null;
    const htmlElement = element as HTMLElement;
    const className =
      typeof htmlElement.className === 'string'
        ? htmlElement.className.split(/\s+/).filter(Boolean).slice(0, 5).join('.')
        : '';
    return (
      `${htmlElement.tagName.toLowerCase()}${htmlElement.id ? `#${htmlElement.id}` : ''}` +
      `${htmlElement.getAttribute('role') ? `[role=${htmlElement.getAttribute('role')}]` : ''}` +
      `${className ? `.${className}` : ''}`
    );
  };

  const describeScrollContainer = (container: HTMLElement) =>
    `${describeElement(container)} top=${container.scrollTop} height=${container.scrollHeight} client=${container.clientHeight}`;

  const debugEnabled = isDebugLoggingEnabled();
  const debugLog = (...args: unknown[]) => {
    if (debugEnabled) {
      console.debug('[chat-export-sweep]', ...args);
    }
  };

  const scrollToPosition = (target: HTMLElement, position: number) => {
    target.scrollTo({ top: position, behavior: 'instant' });
  };

  const findScrollContainer = () => {
    const elements = getElements();
    const candidates = new Set<HTMLElement>();

    for (const element of elements) {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
          candidates.add(parent as HTMLElement);
        }
      }
    }

    const sortedCandidates = [...candidates].sort((first, second) => {
      const firstCount = elements.filter((element) => first.contains(element)).length;
      const secondCount = elements.filter((element) => second.contains(element)).length;
      return secondCount - firstCount || second.scrollHeight - first.scrollHeight;
    });
    const chosen = sortedCandidates[0] ?? document.scrollingElement ?? document.documentElement;
    debugLog('scroll containers', {
      mounted: elements.length,
      candidates: sortedCandidates.map((candidate) => ({
        container: describeScrollContainer(candidate),
        mounted: elements.filter((element) => candidate.contains(element)).length,
      })),
      chosen: describeScrollContainer(chosen as HTMLElement),
    });
    return chosen;
  };

  const scrollContainer = findScrollContainer();
  const scrollMode = detectScrollDirectionMode(scrollContainer as HTMLElement);
  const maxScrollExtent = () =>
    Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  const toNative = (distFromTop: number): number =>
    toNativeScrollTop(distFromTop, maxScrollExtent(), scrollMode);
  const fromNative = (native: number): number =>
    fromNativeScrollTop(native, maxScrollExtent(), scrollMode);
  const originalNativeScrollTop = scrollContainer.scrollTop;
  debugLog('sweep start', {
    container: describeScrollContainer(scrollContainer),
    originalScrollTop: originalNativeScrollTop,
    scrollMode,
  });
  const seen = new Set<string | Element>();
  const getElementKey = (element: Element) => getKey(element) ?? element;
  const describeKey = (key: string | Element) =>
    typeof key === 'string' ? key : 'unkeyed-element';
  const mountedKeys = (): Set<string | Element> =>
    new Set(
      getElements()
        .filter((candidate) => candidate.isConnected)
        .map(getElementKey)
    );
  const sameKeySet = (first: Set<string | Element>, second: Set<string | Element>): boolean => {
    if (first.size !== second.size) return false;
    for (const key of first) {
      if (!second.has(key)) return false;
    }
    return true;
  };
  const settleScroll = async (target: number): Promise<void> => {
    // A fighting virtualizer or scroll anchoring can keep scrollTop off
    // target forever. Never spin here: a few attempts, then proceed like a
    // normal scroll wait so a full sweep stays seconds, not minutes.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Math.abs(fromNative(scrollContainer.scrollTop) - target) <= 1) return;
      scrollToPosition(scrollContainer, toNative(target));
      await waitForRender(attempt === 0 ? 100 : 0);
    }
  };
  // Virtualizers can re-mount rows in scrambled DOM order (e.g. after a big
  // jump). Follow visual order instead: within one scan every mounted row
  // shares the same scroll position, so viewport-relative tops are comparable.
  const visualTop = (candidate: Element): number => {
    try {
      return candidate.getBoundingClientRect()?.top ?? 0;
    } catch {
      return 0;
    }
  };
  let failed = 0;
  let position = 0;
  let maxScroll = 0;
  let turnoverDone = false;
  let cumPrepend = 0;
  let lastLayoutHeight = scrollContainer.scrollHeight;
  let lastLayoutNative = scrollContainer.scrollTop;
  const noteLayout = (): void => {
    const height = scrollContainer.scrollHeight;
    const native = scrollContainer.scrollTop;
    cumPrepend += estimatePrependGrowth(height - lastLayoutHeight, native - lastLayoutNative);
    lastLayoutHeight = height;
    lastLayoutNative = native;
  };

  const scrollerStyle = scrollContainer.style;
  const previousScrollBehavior = scrollerStyle.scrollBehavior;
  const documentStyle = document.documentElement.style;
  const previousDocumentScrollBehavior = documentStyle.scrollBehavior;
  scrollerStyle.scrollBehavior = 'auto';
  documentStyle.scrollBehavior = 'auto';

  try {
    if (options?.preloadHistory) {
      await preloadFullHistory(
        (dist) => scrollToPosition(scrollContainer, toNative(dist)),
        maxScrollExtent,
        () => scrollerHeight(scrollContainer),
        waitForRender,
        options.isLoadingMore,
        debugLog
      );
    }
    // Baseline layout tracking after preload: only growth during the sweep
    // itself can shift origins underneath recorded orders.
    lastLayoutHeight = scrollContainer.scrollHeight;
    lastLayoutNative = scrollContainer.scrollTop;
    cumPrepend = 0;

    while (true) {
      maxScroll = Math.max(maxScroll, maxScrollExtent());
      position = Math.min(position, maxScroll);

      if (position === 0 && !turnoverDone) {
        turnoverDone = true;
        const startedAtTop = Math.abs(fromNative(scrollContainer.scrollTop)) <= 1;
        const initialKeys = mountedKeys();
        await settleScroll(0);
        if (!startedAtTop && scrollContainer.scrollHeight > scrollContainer.clientHeight * 3) {
          for (let attempt = 0; attempt < 10; attempt++) {
            await waitForRender();
            if (!sameKeySet(mountedKeys(), initialKeys)) break;
          }
        }
      }

      while (true) {
        if (Math.abs(fromNative(scrollContainer.scrollTop) - position) > 1) {
          await settleScroll(position);
        } else {
          await waitForRender();
        }
        noteLayout();

        const mountedRows = getElements().filter((candidate) => candidate.isConnected);
        const pendingRows = mountedRows.filter((candidate) => !seen.has(getElementKey(candidate)));
        debugLog('position scan', {
          position,
          maxScroll,
          mounted: mountedRows.length,
          pending: pendingRows.length,
          firstPending: pendingRows[0] ? describeKey(getElementKey(pendingRows[0])) : null,
          lastPending: pendingRows[pendingRows.length - 1]
            ? describeKey(getElementKey(pendingRows[pendingRows.length - 1]))
            : null,
        });
        const element = [...pendingRows].sort(
          (first, second) => visualTop(first) - visualTop(second)
        )[0];
        if (!element) break;

        seen.add(getElementKey(element));
        debugLog('process row', {
          key: describeKey(getElementKey(element)),
          top: visualTop(element),
        });
        try {
          if (
            !(await processElement(element, {
              scrollTop: scrollContainer.scrollTop,
              prependOffset: cumPrepend,
            }))
          )
            failed++;
        } catch (error) {
          failed++;
          onError(error);
        }
      }

      maxScroll = Math.max(maxScroll, maxScrollExtent());
      if (position >= maxScroll - 1) {
        let settledPasses = 0;
        let lastMountedCount = -1;
        let lastScrollHeight = -1;
        while (settledPasses < 3) {
          maxScroll = Math.max(maxScroll, maxScrollExtent());
          if (Math.abs(fromNative(scrollContainer.scrollTop) - maxScroll) > 1) {
            scrollToPosition(scrollContainer, toNative(maxScroll));
          }
          await waitForRender(250);
          noteLayout();
          const mountedRows = getElements().filter((candidate) => candidate.isConnected);
          const hasPendingRows = mountedRows.some(
            (candidate) => !seen.has(getElementKey(candidate))
          );
          debugLog('bottom settle', {
            maxScroll,
            mounted: mountedRows.length,
            height: scrollContainer.scrollHeight,
            pending: hasPendingRows,
            settledPasses,
          });
          if (hasPendingRows) break;
          if (
            mountedRows.length === lastMountedCount &&
            scrollContainer.scrollHeight === lastScrollHeight
          ) {
            settledPasses++;
          } else {
            settledPasses = 0;
            lastMountedCount = mountedRows.length;
            lastScrollHeight = scrollContainer.scrollHeight;
          }
        }
        if (settledPasses >= 3) break;
        continue;
      }

      const step = Math.max(1, Math.floor(scrollerHeight(scrollContainer) * 0.75));
      position = Math.min(maxScroll, position + step);
    }
  } finally {
    const restoreTarget = scrollContainer.isConnected ? scrollContainer : findScrollContainer();
    debugLog('restore scroll', {
      container: describeScrollContainer(restoreTarget),
      originalScrollTop: originalNativeScrollTop,
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (restoreTarget.scrollTop !== originalNativeScrollTop) {
        scrollToPosition(restoreTarget, originalNativeScrollTop);
        await waitForRender(200);
      }
      debugLog('restore attempt', {
        attempt,
        actualScrollTop: restoreTarget.scrollTop,
      });
      if (Math.abs(restoreTarget.scrollTop - originalNativeScrollTop) > 1) continue;
      await waitForRender(200);
      if (Math.abs(restoreTarget.scrollTop - originalNativeScrollTop) <= 1) break;
    }
    scrollerStyle.scrollBehavior = previousScrollBehavior;
    documentStyle.scrollBehavior = previousDocumentScrollBehavior;
  }

  return failed;
}
