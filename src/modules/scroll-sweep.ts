export async function sweepMountedElements(
  getElements: () => Element[],
  getKey: (element: Element) => string | null,
  processElement: (element: Element) => Promise<boolean>,
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

  const isDebugLoggingEnabled = () => {
    try {
      const search = window.location.search || '';
      if (new URLSearchParams(search).get('chat-export-debug') === '1') return true;
      return window.localStorage?.getItem('chat-export-debug') === '1';
    } catch {
      return false;
    }
  };

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
  let failed = 0;
  let position = 0;
  let maxScroll = 0;

  try {
    while (true) {
      maxScroll = Math.max(maxScroll, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      position = Math.min(position, maxScroll);

      while (true) {
        if (scrollContainer.scrollTop !== position) {
          scrollToPosition(scrollContainer, position);
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
        const element = pendingRows[0];
        if (!element) break;

        seen.add(getElementKey(element));
        debugLog('process row', { key: describeKey(getElementKey(element)) });
        try {
          if (!(await processElement(element))) failed++;
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
  }

  return failed;
}
