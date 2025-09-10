import browser from 'webextension-polyfill'

import { detectSite } from '@/modules/site-detection'
import { createExportButton } from '@/modules/ui'

console.log(' Content script loaded for', browser.runtime.getManifest().name)

function init() {
  const site = detectSite()

  // track if we've already added the button to prevent infinite loops
  let buttonAdded = false

  // for Gemini, wait a bit before starting to observe since the Angular app needs time to load
  const startDelay = site === 'gemini' ? 2000 : 0

  setTimeout(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          if (site === 'claude') {
            // for Claude.ai, look for the share button container
            const shareButtonContainer = document.querySelector(
              'button[data-testid="share-button"]'
            )?.parentElement?.parentElement
            if (
              shareButtonContainer &&
              !document.querySelector('[data-testid="export-chat-button"]')
            ) {
              const exportButton = createExportButton()
              shareButtonContainer.parentElement?.appendChild(exportButton)
            }
          } else if (site === 'gemini' && !buttonAdded) {
            // for Gemini (aistudio.google.com), add retry logic due to delayed Angular UI loading
            const tryAddGeminiButton = (retryCount = 0) => {
              const toolbarRight = document.querySelector('ms-toolbar .toolbar-right')
              if (
                toolbarRight &&
                !document.querySelector('[data-testid="export-chat-button"]') &&
                !buttonAdded
              ) {
                const exportButton = createExportButton()
                // insert before the last button (tune/settings button)
                const lastButton = toolbarRight.lastElementChild
                if (lastButton && lastButton.tagName === 'BUTTON') {
                  toolbarRight.insertBefore(exportButton, lastButton)
                } else {
                  toolbarRight.appendChild(exportButton)
                }
                buttonAdded = true
              } else if (!toolbarRight && retryCount < 4 && !buttonAdded) {
                // retry up to 5 times with increasing delay
                setTimeout(() => tryAddGeminiButton(retryCount + 1), 1000 + retryCount * 500)
              }
            }
            tryAddGeminiButton()
          } else {
            // for ChatGPT, look for the share button
            const shareButton = document.querySelector('[data-testid="share-chat-button"]')
            if (shareButton && !document.querySelector('[data-testid="export-chat-button"]')) {
              const exportButton = createExportButton()
              shareButton.parentElement?.insertBefore(exportButton, shareButton)
            }
          }
        }
      })
    })

    // start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }, startDelay)
}

init()
