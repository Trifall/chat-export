import browser from 'webextension-polyfill'

import optionsStorage from './options-storage'

console.log('💈 Content script loaded for', browser.runtime.getManifest().name)

const SURROUND_PASTE_FILE_IN_BACKTICKS = true

type Site = 'chatgpt' | 'claude'

const CLAUDE_URLS = ['https://claude.ai']
const CHATGPT_URLS = ['https://chat.openai.com', 'https://chatgpt.com']

function detectSite(): Site {
  const url = window.location.href
  if (CHATGPT_URLS.some((u) => url.includes(u))) {
    return 'chatgpt'
  }
  if (CLAUDE_URLS.some((u) => url.includes(u))) {
    return 'claude'
  }
  throw new Error('Unsupported site')
}

function createExportButton(): HTMLElement {
  const site = detectSite()
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'relative'

  const button = document.createElement('button')

  if (site === 'claude') {
    // match Claude's button style
    button.className = `inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 
      ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none 
      disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] 
      from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 font-medium font-styrene text-text-100/90 
      transition-colors active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 h-9 px-4 py-2 rounded-lg min-w-[5rem] 
      active:scale-[0.985] whitespace-nowrap`
    buttonContainer.className = 'mr-1'
  } else {
    // original ChatGPT style
    button.className = 'btn relative btn-secondary text-token-text-primary'
  }

  button.setAttribute('aria-label', 'Export')
  button.setAttribute('data-testid', 'export-chat-button')

  const buttonContent = document.createElement('div')
  buttonContent.className =
    site === 'claude' ? '' : 'flex w-full items-center justify-center gap-1.5'

  if (site === 'chatgpt') {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('width', '20')
    icon.setAttribute('height', '20')
    icon.setAttribute('viewBox', '0 0 20 20')
    icon.setAttribute('fill', 'none')
    icon.classList.add('icon-sm')

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M3 17h14v-6h2v8H1v-8h2v6zm7-7V2h4l-5-5-5 5h4v8z')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '1.5')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')

    icon.appendChild(path)
    buttonContent.appendChild(icon)
  }

  if (site === 'claude') {
    buttonContainer.style.position = 'relative'
  }

  buttonContent.appendChild(document.createTextNode('Export'))
  button.appendChild(buttonContent)
  buttonContainer.appendChild(button)

  // make dropdown
  const dropdown = document.createElement('div')
  dropdown.className = 'absolute hidden rounded-md shadow-lg mt-3 py-2 w-48 z-50 text-zinc-100'
  dropdown.style.top = '100%'
  dropdown.style.left = '0'
  dropdown.style.backgroundColor = 'rgb(24 24 27)' // zinc-900

  const options = [
    { text: 'Copy to Clipboard', action: copyToClipboard },
    { text: 'Save to File', action: saveToFile },
  ]

  options.forEach((option, index) => {
    const item = document.createElement('button')
    item.className = 'w-full text-left px-4 py-4 text-zinc-100'
    item.style.backgroundColor = 'rgb(24 24 27)' // zinc-900
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgb(39 39 42)' // zinc-800
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'rgb(24 24 27)' // zinc-900
    })
    item.textContent = option.text
    item.onclick = option.action
    if (index > 0) {
      item.style.marginTop = '4px'
    }
    dropdown.appendChild(item)
  })

  buttonContainer.appendChild(dropdown)

  // toggle dropdown
  button.onclick = (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('hidden')
  }

  // close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.add('hidden')
  })

  return buttonContainer
}

async function formatContent(
  messages: Array<{ role: string; content: string }>,
  format: string
): Promise<string> {
  switch (format) {
    case 'markdown':
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === 'assistant' ? 'Assistant' : 'User'}\n\n${content}\n\n`
        )
        .join('')

    case 'json':
      return JSON.stringify(
        {
          messages: messages.map(({ role, content }) => ({
            role: role === 'assistant' ? 'assistant' : 'user',
            content,
          })),
        },
        null,
        2
      )

    case 'xml':
      return `<?xml version="1.0" encoding="UTF-8"?>\n<conversation>\n${messages
        .map(
          ({ role, content }) =>
            `  <message role="${role === 'assistant' ? 'assistant' : 'user'}">\n    <content>${content
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;')}</content>\n  </message>`
        )
        .join('\n')}\n</conversation>`

    case 'html':
      return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Chat Export</title>\n  <style>\n    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }\n    .message { margin-bottom: 3rem; }\n    .role { font-weight: bold; margin-bottom: 1rem; font-size: 1.1em; }\n    .content { white-space: pre-wrap; }\n    .content p { margin: 1em 0; }\n    .content h1, .content h2, .content h3, .content h4 { margin: 1.5em 0 0.5em; }\n    .content ul, .content ol { margin: 1em 0; padding-left: 2em; }\n    .content li { margin: 0.5em 0; }\n    .content strong { font-weight: 600; }\n    .content em { font-style: italic; }\n    .content code { font-family: monospace; background: #f1f1f1; padding: 0.2em 0.4em; border-radius: 3px; }\n    .content pre { background: #f8f8f8; padding: 1em; border-radius: 5px; overflow-x: auto; font-style: italic; }\n  </style>\n</head>\n<body>\n${messages
        .map(({ role, content }) => {
          // escape HTML characters
          const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')

          // convert markdown-style paragraphs to HTML paragraphs
          const formattedContent = escapedContent
            // convert markdown headers
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            // convert markdown bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // convert markdown italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // convert multi-line code blocks with language or file specifier
            .replace(/```([a-zA-Z]*)?\n([\s\S]*?)```/g, (_, lang, code) => {
              const contextText = lang ? lang.trim() + '\n' : ''
              return `<code>Code context: ${contextText}</code><code>${code.trim()}</code>`
            })
            // convert inline code blocks
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // convert markdown lists
            .replace(/^- (.*?)$/gm, '<li>$1</li>')
            .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
            // convert double newlines to paragraph breaks
            .replace(/\n\n/g, '</p><p>')
            // wrap in paragraphs
            .replace(/^(.+?)$/m, '<p>$1</p>')

          return `  <div class="message">\n    <div class="role">${
            role === 'assistant' ? 'Assistant' : 'User'
          }</div>\n    <div class="content">${formattedContent}</div>\n  </div>`
        })
        .join('\n')}\n</body>\n</html>`

    default:
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === 'assistant' ? 'Assistant' : 'User'}\n\n${content}\n\n`
        )
        .join('')
  }
}

async function forceLoadMessages(): Promise<void> {
  const site = detectSite()
  if (site !== 'chatgpt') return

  // get the first conversation turn
  const turns = document.querySelectorAll('article.group\\/turn') as NodeListOf<HTMLElement>
  if (!turns.length) return

  const firstTurn = turns[0]
  if (!firstTurn) return

  // scroll to the first turn
  firstTurn.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })

  // wait for any new messages to load
  await new Promise((resolve) => setTimeout(resolve, 500))

  // find the last conversation turn
  const lastTurn = turns[turns.length - 1]

  if (!lastTurn) return

  lastTurn.scrollIntoView({
    behavior: 'smooth',
    block: 'end',
  })

  // wait for scroll position to be restored
  await new Promise((resolve) => setTimeout(resolve, 100))
}

async function getPastedContent(div: Element): Promise<string | null> {
  // find all file and image elements
  const fileElements = div.querySelectorAll(
    'div[data-testid="file-thumbnail"]'
  ) as NodeListOf<HTMLElement>
  const imageElements = div.querySelectorAll('img') as NodeListOf<HTMLImageElement>
  if (!fileElements.length && !imageElements.length) return null

  const contents: string[] = []

  // handle files
  for (let i = 0; i < fileElements.length; i++) {
    // click to open side panel
    const clickableDiv = fileElements[i]
    if (clickableDiv) clickableDiv.click()
    await new Promise((resolve) => setTimeout(resolve, 500)) // wait for panel to open

    // find the content in the side panel
    const contentElement = document.querySelector('.whitespace-pre-wrap.break-all.text-xs')
    if (!contentElement) {
      // close the panel if we couldn't find the content
      const closeButton = document.querySelector(
        'button[data-testid="close-file-preview"]'
      ) as HTMLElement
      if (closeButton) closeButton.click()
      continue // skip this file but continue processing others
    }

    const fileContent = contentElement.textContent || ''
    if (fileContent) {
      if (!SURROUND_PASTE_FILE_IN_BACKTICKS) {
        contents.push(`\`\`\`\n${fileContent}\n\`\`\`\n`)
      } else {
        contents.push(fileContent)
      }
    }

    // close the panel
    const closeButton = document.querySelector(
      'button[data-testid="close-file-preview"]'
    ) as HTMLElement
    if (closeButton) closeButton.click()
  }

  // handle images
  for (let i = 0; i < imageElements.length; i++) {
    const imageElement = imageElements[i]
    const imageContent = formatImageInput(imageElement.src, imageElement.alt)
    contents.push(imageContent)
  }

  return contents.length > 0 ? contents.join('\n') : null
}

function formatImageInput(src: string, name: string): string {
  return `User included image: ${name ?? 'Name not provided'} - ${src ?? 'Unable to retrieve URL'}\n`
}

async function getChatContent(): Promise<{ format: string; content: string }> {
  const site = detectSite()
  const messages: Array<{ role: string; content: string }> = []
  const originalClipboard = await navigator.clipboard.readText()

  if (site === 'chatgpt') {
    await forceLoadMessages()
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]')

    for (const turn of turns) {
      const messageDiv = turn.querySelector('[data-message-author-role]')
      if (!messageDiv) continue

      const role = messageDiv.getAttribute('data-message-author-role')
      const copyButton = turn.querySelector(
        '[data-testid="copy-turn-action-button"]'
      ) as HTMLButtonElement
      const images = turn.querySelectorAll('img')

      if (role) {
        let content = ''

        for (const image of images) {
          const imageContent = formatImageInput(image.src, image.alt)
          content += imageContent + '\n'
        }

        if (copyButton) {
          copyButton.click()
          // wait for clipboard to be updated
          await new Promise((resolve) => setTimeout(resolve, 100))
          content += await navigator.clipboard.readText()
        }

        messages.push({ role, content })
      }
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

  // restore original clipboard content
  await navigator.clipboard.writeText(originalClipboard)

  // get user's preferred format
  const options = await optionsStorage.getAll()
  const format = options.exportType || 'markdown'

  const formattedContent = await formatContent(messages, format)
  return { format, content: formattedContent }
}

async function copyToClipboard() {
  const { content } = await getChatContent()
  await navigator.clipboard.writeText(content)
}

async function saveToFile() {
  const { format, content } = await getChatContent()
  const mimeTypes: { [key: string]: string } = {
    markdown: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
  }

  const extensions: { [key: string]: string } = {
    markdown: 'md',
    json: 'json',
    xml: 'xml',
    html: 'html',
  }

  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-export-${new Date().toISOString().split('T')[0]}.${extensions[format] || 'txt'}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
