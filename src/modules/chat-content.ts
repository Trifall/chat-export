import optionsStorage from '../options-storage'

import { extractFormattedText, getPastedContent } from './content-extraction'
import { formatContent, formatImageInput } from './content-formatting'
import { detectSite } from './site-detection'
import { ChatContent, Message } from './types'

export async function getChatContent(restoreClipboard: boolean = false): Promise<ChatContent> {
  const site = detectSite()
  const messages: Array<Message> = []
  const originalClipboard = await navigator.clipboard.readText()

  if (site === 'chatgpt') {
    // get all conversation turns
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]')

    // process each turn individually
    for (const turn of turns) {
      const messageDiv = turn.querySelector('[data-message-author-role]')
      if (!messageDiv) continue

      const role = messageDiv.getAttribute('data-message-author-role')
      if (!role) continue

      // scroll this specific turn into view to ensure it's loaded
      const block = role === 'assistant' ? 'end' : 'start'
      turn.scrollIntoView({
        behavior: 'smooth',
        block,
      })

      // wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 500))

      // extract content using JavaScript DOM traversal instead of clipboard
      let content = ''

      // handle images first
      const images = turn.querySelectorAll('img')
      for (const image of images) {
        // skip favicon images which are used for sources
        if (image.src.includes('google.com/s2/favicons')) continue

        const imageContent = formatImageInput(image.src, image.alt, role)
        content += imageContent + '\n'
      }

      // query select with class of .whitespace-pre-wrap OR .markdown
      const contentElement = turn.querySelector('.whitespace-pre-wrap, .markdown')
      if (contentElement) {
        // create a deep clone of the content element to avoid modifying the actual UI
        const contentClone = contentElement.cloneNode(true) as Element

        // delete source links by finding elements with the specific structure:
        // span[data-state] > span > a[target="_blank"][rel="noopener"] > span.relative
        const sourceSpans = Array.from(contentClone.querySelectorAll('span[data-state]')).filter(
          (span) => {
            // span has the expected structure for a source link
            const hasExpectedStructure = !!span.querySelector(
              'span > a[target="_blank"][rel="noopener"] > span.relative'
            )
            return hasExpectedStructure
          }
        )

        // remove the source spans from their parent nodes
        sourceSpans.forEach((span) => {
          if (span.parentNode) {
            span.parentNode.removeChild(span)
          }
        })

        // remove the source containers (typically at the bottom of the message)
        // these usually have a button with sources text and favicon images
        const sourceContainers = Array.from(contentClone.querySelectorAll('div')).filter((div) => {
          // find buttons with sources text
          const hasSourcesButton = Array.from(div.querySelectorAll('button')).some((button) =>
            button.textContent?.includes('Sources')
          )
          // find divs that contain favicon images
          const hasFaviconImages = Array.from(div.querySelectorAll('img')).some((img) =>
            img.src.includes('google.com/s2/favicons')
          )

          return hasSourcesButton || hasFaviconImages
        })

        sourceContainers.forEach((container) => {
          if (container.parentNode) {
            container.parentNode.removeChild(container)
          }
        })

        const extractedText = await extractFormattedText(contentClone)
        content += extractedText
      }

      messages.push({ role, content })
    }
  } else if (site === 'gemini') {
    // aistudio.google.com (Gemini)
    const chatTurns = document.querySelectorAll('ms-chat-turn')

    for (const turn of chatTurns) {
      // scroll this specific turn into view to ensure it's loaded
      turn.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      // wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 500))

      // determine role based on the chat-turn-container class
      const container = turn.querySelector('.chat-turn-container')
      if (!container) {
        continue
      }

      const role = container.classList.contains('user') ? 'user' : 'assistant'

      // find the more options button
      const optionsElement = turn.querySelector('ms-chat-turn-options')
      if (!optionsElement) {
        continue
      }

      const moreOptionsButton = optionsElement.querySelector(
        'button[aria-label="Open options"]'
      ) as HTMLButtonElement
      if (!moreOptionsButton) {
        continue
      }

      // click the more options button to open the overlay menu
      moreOptionsButton.click()

      // wait for overlay to appear
      await new Promise((resolve) => setTimeout(resolve, 300))

      // find the overlay container (it's a sibling of body)
      const overlayContainer = document.querySelector('.cdk-overlay-container')
      if (!overlayContainer) {
        // if we can't find the overlay, skip this message
        continue
      }

      // find the "Copy as markdown" button in the overlay
      let copyMarkdownButton: HTMLButtonElement | null = null

      // try different approaches to find the copy as markdown button
      const buttons = Array.from(overlayContainer.querySelectorAll('button'))
      for (const btn of buttons) {
        if (btn.textContent?.includes('Copy as markdown')) {
          copyMarkdownButton = btn as HTMLButtonElement
          break
        }
      }

      // also try finding by the specific icon class mentioned in the HTML
      if (!copyMarkdownButton) {
        copyMarkdownButton = overlayContainer.querySelector(
          'button .copy-markdown-button'
        ) as HTMLButtonElement
      }

      if (!copyMarkdownButton) {
        // close the overlay by clicking outside or pressing Escape
        const backdrop = document.querySelector('.cdk-overlay-backdrop')
        if (backdrop) {
          ;(backdrop as HTMLElement).click()
        }
        continue
      }

      // click the copy as markdown button
      copyMarkdownButton.click()

      // wait for clipboard to be updated
      await new Promise((resolve) => setTimeout(resolve, 200))

      // get the content from clipboard
      let content = await navigator.clipboard.readText()

      // Check if this is a thinking message and add prefix
      if (role === 'assistant' && content && content.trim()) {
        const thinkingChunk = turn.querySelector('ms-thought-chunk')
        if (thinkingChunk) {
          content = `*Thinking Output*\n\n${content.trim()}`
        }
        messages.push({ role, content })
      } else if (content && content.trim()) {
        messages.push({ role, content: content.trim() })
      }

      // wait a bit to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } else {
    // claude.ai
    const messageDivs = document.querySelectorAll('div.font-claude-message, div.font-user-message')

    for (const div of messageDivs) {
      const role = div.classList.contains('font-claude-message') ? 'assistant' : 'user'
      let content = ''

      if (role === 'assistant') {
        // for assistant messages, use the copy button approach
        const container = div.nextElementSibling as HTMLElement
        if (!container || !container.classList.contains('absolute')) continue

        const copyButton = container.querySelector(
          'button[data-state="closed"]'
        ) as HTMLButtonElement
        if (!copyButton) continue

        copyButton.click()
        // wait for clipboard to be updated
        await new Promise((resolve) => setTimeout(resolve, 100))
        content = await navigator.clipboard.readText()
      } else {
        // for user messages, handle regular text, code blocks, and pasted content
        const messageParts: string[] = []

        // get all direct children
        const children = Array.from(div.children)

        // look for pasted content first
        const pastedDiv = div.parentElement?.parentElement?.previousElementSibling?.querySelector(
          'div.group\\/thumbnail.relative'
        )?.parentElement as HTMLElement

        if (pastedDiv) {
          const pastedContent = await getPastedContent(pastedDiv)
          if (pastedContent) {
            messageParts.push(pastedContent)
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }

        for (const child of children) {
          if (child.tagName === 'P') {
            // regular text content
            const text = child.textContent?.trim()
            if (text) messageParts.push(text)
          } else {
            // if it's a code block, try copy button
            if (child.classList.contains('relative')) {
              const copyButton = child.querySelector(
                'button[data-state="closed"]'
              ) as HTMLButtonElement
              if (copyButton) {
                copyButton.click()
                // wait for clipboard to be updated
                await new Promise((resolve) => setTimeout(resolve, 100))
                const copiedContent = await navigator.clipboard.readText()
                if (copiedContent) messageParts.push(copiedContent)
              }
            }
          }
        }

        content = messageParts.join('\n')
        if (!content) continue
      }

      messages.push({ role, content })
    }
  }

  // get user's preferred format
  const options = await optionsStorage.getAll()
  const format = options.exportType || 'markdown'

  // restore original clipboard content
  if (restoreClipboard) {
    await navigator.clipboard.writeText(originalClipboard)
  }

  const formattedContent = await formatContent(messages, format)
  return { format, content: formattedContent }
}
