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
        const imageContent = formatImageInput(image.src, image.alt, role)
        content += imageContent + '\n'
      }

      // query select with class of .whitespace-pre-wrap OR .markdown
      const contentElement = turn.querySelector('.whitespace-pre-wrap, .markdown')
      if (contentElement) {
        const extractedText = await extractFormattedText(contentElement)
        content += extractedText
      }

      messages.push({ role, content })
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
