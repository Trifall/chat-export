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
}

export async function sweepMountedElements(
  getElements: () => Element[],
  getKey: (element: Element) => string | null,
  processElement: (element: Element, info: SweepElementInfo) => Promise<boolean>,
  onError: (error: unknown) => void
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
  const originalScrollTop = scrollContainer.scrollTop;
  debugLog('sweep start', {
    container: describeScrollContainer(scrollContainer),
    originalScrollTop,
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
      if (Math.abs(scrollContainer.scrollTop - target) <= 1) return;
      scrollToPosition(scrollContainer, target);
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

  const scrollerStyle = scrollContainer.style;
  const previousScrollBehavior = scrollerStyle.scrollBehavior;
  const documentStyle = document.documentElement.style;
  const previousDocumentScrollBehavior = documentStyle.scrollBehavior;
  scrollerStyle.scrollBehavior = 'auto';
  documentStyle.scrollBehavior = 'auto';

  try {
    while (true) {
      maxScroll = Math.max(maxScroll, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      position = Math.min(position, maxScroll);

      if (position === 0 && !turnoverDone) {
        turnoverDone = true;
        const startedAtTop = Math.abs(scrollContainer.scrollTop) <= 1;
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
        if (Math.abs(scrollContainer.scrollTop - position) > 1) {
          await settleScroll(position);
        } else {
          await waitForRender();
        }

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
          if (!(await processElement(element, { scrollTop: scrollContainer.scrollTop }))) failed++;
        } catch (error) {
          failed++;
          onError(error);
        }
      }

      maxScroll = Math.max(maxScroll, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      if (position >= maxScroll - 1) {
        let settledPasses = 0;
        let lastMountedCount = -1;
        let lastScrollHeight = -1;
        while (settledPasses < 3) {
          maxScroll = Math.max(
            maxScroll,
            scrollContainer.scrollHeight - scrollContainer.clientHeight
          );
          if (scrollContainer.scrollTop !== maxScroll) {
            scrollToPosition(scrollContainer, maxScroll);
          }
          await waitForRender(250);
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
      originalScrollTop,
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (restoreTarget.scrollTop !== originalScrollTop) {
        scrollToPosition(restoreTarget, originalScrollTop);
        await waitForRender(200);
      }
      debugLog('restore attempt', {
        attempt,
        actualScrollTop: restoreTarget.scrollTop,
      });
      if (Math.abs(restoreTarget.scrollTop - originalScrollTop) > 1) continue;
      await waitForRender(200);
      if (Math.abs(restoreTarget.scrollTop - originalScrollTop) <= 1) break;
    }
    scrollerStyle.scrollBehavior = previousScrollBehavior;
    documentStyle.scrollBehavior = previousDocumentScrollBehavior;
  }

  return failed;
}
