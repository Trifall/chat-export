import { Message } from './types'

export async function formatContent(messages: Array<Message>, format: string): Promise<string> {
  console.log(`Messages: ${JSON.stringify(messages)}`)

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
        .map(({ role, content }) => {
          const safeRole = role === 'assistant' ? 'assistant' : 'user'

          const safeContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')

          return `  <message role="${safeRole}">\n    <content>${safeContent}</content>\n  </message>`
        })
        .join('\n')}\n</conversation>`

    case 'html':
      return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Chat Export</title>\n  <style>\n    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }\n    .message { margin-bottom: 3rem; }\n    .role { font-weight: bold; margin-bottom: 1rem; font-size: 1.1em; }\n    .content { white-space: pre-wrap; }\n    .content p { margin: 1em 0; }\n    .content h1, .content h2, .content h3, .content h4 { margin: 1.5em 0 0.5em; }\n    .content ul, .content ol { margin: 1em 0; padding-left: 2em; }\n    .content li { margin: 0.5em 0; }\n    .content strong { font-weight: 600; }\n    .content em { font-style: italic; }\n    .content code { font-family: monospace; background: #f1f1f1; padding: 0.2em 0.4em; border-radius: 3px; }\n    .content pre { background: #f8f8f8; padding: 1em; border-radius: 5px; overflow-x: auto; }\n  </style>\n</head>\n<body>\n${messages
        .map(({ role, content }) => {
          const safeRole = role === 'assistant' ? 'Assistant' : 'User'

          // escape HTML characters
          let formattedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')

          // handle code blocks ```
          formattedContent = formattedContent.replace(
            /```([a-zA-Z0-9-]*)?([^```]+)```/g,
            (_, lang, code) => {
              const safeLang = lang ? lang.trim() : ''
              return `<pre><code class="language-${safeLang}">${code.trim()}</code></pre>`
            }
          )

          // handle inline single backticks
          formattedContent = formattedContent.replace(
            /`([^`]+)`/g,
            (_, code) => `<code>${code}</code>`
          )

          // handle other markdown elements
          formattedContent = formattedContent
            // headers
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            // bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // lists
            .replace(/^[ ]*- (.*?)$/gm, '<li>$1</li>')
            .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')

          // handle paragraphs last
          formattedContent = formattedContent
            .split('\n\n')
            .map((para) => {
              if (
                para.startsWith('<h') ||
                para.startsWith('<ul') ||
                para.startsWith('<pre') ||
                !para.trim()
              ) {
                return para
              }
              return `<p>${para}</p>`
            })
            .join('\n')

          return `  <div class="message">\n    <div class="role">${safeRole}</div>\n    <div class="content">${formattedContent}</div>\n  </div>`
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

export function formatImageInput(src: string, name: string, role: string = 'user'): string {
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1)
  return `${capitalizedRole} included image: ${name ?? 'Name not provided'} - ${src ?? 'Unable to retrieve URL'}\n`
}
