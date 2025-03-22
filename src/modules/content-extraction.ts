import { SURROUND_PASTE_FILE_IN_BACKTICKS } from './constants'
import { formatImageInput } from './content-formatting'

export async function getPastedContent(div: Element): Promise<string | null> {
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
    await new Promise((resolve) => setTimeout(resolve, 125)) // wait for panel to open

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
      if (SURROUND_PASTE_FILE_IN_BACKTICKS) {
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
    const imageContent = formatImageInput(imageElement.src, imageElement.alt, 'user')
    contents.push(imageContent)
  }

  return contents.length > 0 ? contents.join('\n') : null
}

export async function extractFormattedText(element: Element): Promise<string> {
  return new Promise((resolve) => {
    let formattedText = ''
    let listLevel = 0

    function getIndentation(level: number): string {
      return '  '.repeat(level)
    }

    function extractText(node: Node, isInListItem: boolean = false) {
      if (node instanceof Element) {
        if (
          node.querySelector('svg[aria-label="Sources"]') ||
          node.textContent?.trim() === 'Sources' ||
          (node.classList &&
            (node.classList.contains('sources-container') ||
              node.classList.contains('source-item')))
        ) {
          return
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (text) formattedText += text
      } else if (node.nodeName === 'PRE') {
        const preElement = node as Element
        const codeElement = preElement.querySelector('code')
        const language = codeElement?.className.replace('language-', '').trim() || ''
        const codeContent = codeElement?.textContent || node.textContent || ''
        formattedText += '```' + (language ? language + '\n' : '\n') + codeContent + '\n```\n'
      } else if (node.nodeName === 'CODE' && node.parentElement?.nodeName !== 'PRE') {
        formattedText += '`' + node.textContent + '`'
      } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        listLevel++
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], true)
        }
        listLevel--
        if (listLevel === 0) formattedText += '\n'
      } else if (node.nodeName === 'LI') {
        formattedText += '\n' + getIndentation(listLevel - 1) + '- '
        // Process all child nodes of the list item
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i]
          // Special handling for nested lists
          if (child.nodeName === 'UL' || child.nodeName === 'OL') {
            formattedText += '\n'
            extractText(child, true)
          } else {
            extractText(child, true)
          }
        }
      } else if (node.nodeName === 'P') {
        if (!isInListItem) formattedText += '\n'
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem)
        }
        if (!isInListItem) formattedText += '\n'
      } else if (node.nodeName === 'H1') {
        formattedText += '\n# ' + node.textContent + '\n'
      } else if (node.nodeName === 'H2') {
        formattedText += '\n## ' + node.textContent + '\n'
      } else if (node.nodeName === 'H3') {
        formattedText += '\n### ' + node.textContent + '\n'
      } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
        formattedText += '**' + node.textContent + '**'
      } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
        formattedText += '*' + node.textContent + '*'
      } else if (node.nodeName === 'A') {
        const href = (node as HTMLAnchorElement).href
        formattedText += '[' + node.textContent + '](' + href + ')'
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem)
        }
      }
    }

    extractText(element)

    const cleanedText = formattedText
      .replace(/\n\n\n+/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .trim()

    resolve(cleanedText)
  })
}
