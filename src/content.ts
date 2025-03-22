import browser from 'webextension-polyfill'

import { detectSite } from '@/modules/site-detection'
import { createExportButton } from '@/modules/ui'

console.log('💈 Content script loaded for', browser.runtime.getManifest().name)

function init() {
  const site = detectSite()

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        if (site === 'claude') {
          // for Claude.ai, look for the share button container
          const shareButtonContainer = document.querySelector('button[data-testid="share-button"]')
            ?.parentElement?.parentElement
          if (
            shareButtonContainer &&
            !document.querySelector('[data-testid="export-chat-button"]')
          ) {
            const exportButton = createExportButton()
            shareButtonContainer.parentElement?.appendChild(exportButton)
          }
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
}

init()
