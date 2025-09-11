import browser from 'webextension-polyfill';

import { detectSite } from '@/modules/site-detection';
import { createExportButton } from '@/modules/ui';

console.log(' Content script loaded for', browser.runtime.getManifest().name);

function init() {
  const site = detectSite();

  // track if we've already added the button to prevent infinite loops
  let buttonAdded = false;
  let observer: MutationObserver | null = null;

  // throttle function to prevent excessive DOM queries
  let throttleTimeout: number | null = null;
  const throttledButtonCheck = () => {
    if (throttleTimeout) return;

    throttleTimeout = window.setTimeout(() => {
      throttleTimeout = null;

      if (buttonAdded) {
        observer?.disconnect();
        return;
      }

      if (site === 'claude') {
        // for Claude.ai, look for the share button container
        const shareButtonContainer = document.querySelector('button[data-testid="share-button"]')
          ?.parentElement?.parentElement;
        if (shareButtonContainer && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          shareButtonContainer.parentElement?.appendChild(exportButton);
          buttonAdded = true;
          observer?.disconnect();
        }
      } else if (site === 'gemini') {
        const toolbarRight = document.querySelector('ms-toolbar .toolbar-right');
        if (toolbarRight && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          // insert before the last button (tune/settings button)
          const lastButton = toolbarRight.lastElementChild;
          if (lastButton && lastButton.tagName === 'BUTTON') {
            toolbarRight.insertBefore(exportButton, lastButton);
          } else {
            toolbarRight.appendChild(exportButton);
          }
          buttonAdded = true;
          observer?.disconnect();
        }
      } else {
        // for ChatGPT, look for the share button
        const shareButton = document.querySelector('[data-testid="share-chat-button"]');
        if (shareButton && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          shareButton.parentElement?.insertBefore(exportButton, shareButton);
          buttonAdded = true;
          observer?.disconnect();
        }
      }
    }, 500); // 500ms throttle
  };

  // for Gemini, wait a bit before starting to observe since the Angular app needs time to load
  const startDelay = site === 'gemini' ? 2000 : 0;

  setTimeout(() => {
    // Try immediate button insertion first
    throttledButtonCheck();

    // Only set up observer if button wasn't added immediately
    if (!buttonAdded) {
      observer = new MutationObserver((mutations) => {
        // Only check if we see significant DOM changes (not just text changes)
        const hasSignificantChanges = mutations.some(
          (mutation) =>
            mutation.addedNodes.length > 0 &&
            Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
        );

        if (hasSignificantChanges) {
          throttledButtonCheck();
        }
      });

      // Observe more selectively - target likely parent containers instead of entire body
      const targetElement =
        site === 'gemini'
          ? document.querySelector('ms-app, main, [role="main"]') || document.body
          : document.body;

      observer.observe(targetElement, {
        childList: true,
        subtree: true,
      });

      // Stop observing after 30 seconds to prevent indefinite monitoring
      setTimeout(() => {
        observer?.disconnect();
      }, 30000);
    }
  }, startDelay);
}

init();
