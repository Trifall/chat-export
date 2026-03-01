import browser from 'webextension-polyfill';

import { getChatContent } from '@/modules/chat-content';
import { detectSite } from '@/modules/site-detection';
import { createExportButton } from '@/modules/ui';

console.log(' Content script loaded for', browser.runtime.getManifest().name);

// listen for messages from popup
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'GET_CHAT_CONTENT'
  ) {
    getChatContent(false)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error: error.message });
      });
  }
  // return true for handled messages to keep the message channel open for async response
  return true;
});

function init() {
  const site = detectSite();

  // track if we've already added the button to prevent infinite loops
  let buttonAdded = false;
  let observer: MutationObserver | null = null;
  let currentUrl = window.location.href;

  // throttle function to prevent excessive DOM queries
  let throttleTimeout: number | null = null;
  const throttledButtonCheck = () => {
    if (throttleTimeout) return;

    throttleTimeout = window.setTimeout(() => {
      throttleTimeout = null;

      // check if button still exists in DOM (might have been removed by SPA navigation)
      const existingButton = document.querySelector('[data-testid="export-chat-button"]');
      if (buttonAdded && !existingButton) {
        // button was removed (likely due to navigation), reset flag
        buttonAdded = false;
      }

      if (buttonAdded) {
        return;
      }

      if (site === 'claude') {
        // for Claude.ai, look for the wiggle-controls-actions container which holds the Share button
        const chatActionsContainer = document.querySelector(
          '[data-testid="wiggle-controls-actions"]'
        );
        if (chatActionsContainer && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          // insert export button before the Share button in the actions container
          chatActionsContainer.insertBefore(exportButton, chatActionsContainer.firstChild);
          buttonAdded = true;
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
        }
      } else {
        // for ChatGPT, look for the share button
        const shareButton = document.querySelector('[data-testid="share-chat-button"]');
        if (shareButton && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          shareButton.parentElement?.insertBefore(exportButton, shareButton);
          buttonAdded = true;
        }
      }
    }, 500); // 500ms throttle
  };

  const startObserving = () => {
    // disconnect existing observer if any
    observer?.disconnect();

    observer = new MutationObserver((mutations) => {
      // check for URL changes (SPA navigation)
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        buttonAdded = false; // reset flag on navigation
      }

      // only check if we see significant DOM changes (not just text changes)
      const hasSignificantChanges = mutations.some(
        (mutation) =>
          mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
      );

      if (hasSignificantChanges || !buttonAdded) {
        throttledButtonCheck();
      }
    });

    // observe more selectively - target likely parent containers instead of entire body
    const targetElement =
      site === 'gemini'
        ? document.querySelector('ms-app, main, [role="main"]') || document.body
        : document.body;

    observer.observe(targetElement, {
      childList: true,
      subtree: true,
    });
  };

  // listen for popstate events (browser back/forward navigation)
  window.addEventListener('popstate', () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      throttledButtonCheck();
    }
  });

  // for SPAs that use pushState/replaceState, we need to intercept those calls
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      // delay check to allow DOM to update
      setTimeout(throttledButtonCheck, 500);
    }
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      // delay check to allow DOM to update
      setTimeout(throttledButtonCheck, 500);
    }
  };

  // for Gemini, wait a bit before starting to observe since the Angular app needs time to load
  const startDelay = site === 'gemini' ? 2000 : 0;

  setTimeout(() => {
    // try immediate button insertion first
    throttledButtonCheck();

    // start observing - dont stop after 30 seconds for SPAs
    startObserving();
  }, startDelay);
}

init();
