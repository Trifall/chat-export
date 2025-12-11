import { Message } from './types';

export async function extractFormattedText(element: Element): Promise<string> {
  return new Promise((resolve) => {
    let formattedText = '';
    let listLevel = 0;

    function getIndentation(level: number): string {
      return '  '.repeat(level);
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
          return;
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) formattedText += text;
      } else if (node.nodeName === 'PRE') {
        const preElement = node as Element;
        const codeElement = preElement.querySelector('code');
        const language = codeElement?.className.replace('language-', '').trim() || '';
        const codeContent = codeElement?.textContent || node.textContent || '';
        formattedText += '```' + (language ? language + '\n' : '\n') + codeContent + '\n```\n';
      } else if (node.nodeName === 'CODE' && node.parentElement?.nodeName !== 'PRE') {
        formattedText += '`' + node.textContent + '`';
      } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        listLevel++;
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], true);
        }
        listLevel--;
        if (listLevel === 0) formattedText += '\n';
      } else if (node.nodeName === 'LI') {
        formattedText += '\n' + getIndentation(listLevel - 1) + '- ';
        // Process all child nodes of the list item
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          // Special handling for nested lists
          if (child.nodeName === 'UL' || child.nodeName === 'OL') {
            formattedText += '\n';
            extractText(child, true);
          } else {
            extractText(child, true);
          }
        }
      } else if (node.nodeName === 'P') {
        if (!isInListItem) formattedText += '\n';
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem);
        }
        if (!isInListItem) formattedText += '\n';
      } else if (node.nodeName === 'H1') {
        formattedText += '\n# ' + node.textContent + '\n';
      } else if (node.nodeName === 'H2') {
        formattedText += '\n## ' + node.textContent + '\n';
      } else if (node.nodeName === 'H3') {
        formattedText += '\n### ' + node.textContent + '\n';
      } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
        formattedText += '**' + node.textContent + '**';
      } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
        formattedText += '*' + node.textContent + '*';
      } else if (node.nodeName === 'A') {
        const href = (node as HTMLAnchorElement).href;
        formattedText += '[' + node.textContent + '](' + href + ')';
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem);
        }
      }
    }

    extractText(element);

    const cleanedText = formattedText
      .replace(/\n\n\n+/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .trim();

    resolve(cleanedText);
  });
}

export async function formatContent(messages: Array<Message>, format: string): Promise<string> {
  switch (format) {
    case 'markdown':
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === 'assistant' ? 'Assistant' : 'User'}\n\n${content}\n\n`
        )
        .join('');

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
      );

    case 'xml':
      return `<?xml version="1.0" encoding="UTF-8"?>\n<conversation>\n${messages
        .map(({ role, content }) => {
          const safeRole = role === 'assistant' ? 'assistant' : 'user';

          const safeContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          return `  <message role="${safeRole}">\n    <content>${safeContent}</content>\n  </message>`;
        })
        .join('\n')}\n</conversation>`;

    case 'html':
      return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Chat Export</title>\n  <style>\n    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }\n    .message { margin-bottom: 3rem; }\n    .role { font-weight: bold; margin-bottom: 1rem; font-size: 1.1em; }\n    .content { white-space: pre-wrap; }\n    .content p { margin: 1em 0; }\n    .content h1, .content h2, .content h3, .content h4 { margin: 1.5em 0 0.5em; }\n    .content ul, .content ol { margin: 1em 0; padding-left: 2em; }\n    .content li { margin: 0.5em 0; }\n    .content strong { font-weight: 600; }\n    .content em { font-style: italic; }\n    .content code { font-family: monospace; background: #f1f1f1; padding: 0.2em 0.4em; border-radius: 3px; }\n    .content pre { background: #f8f8f8; padding: 1em; border-radius: 5px; overflow-x: auto; }\n  </style>\n</head>\n<body>\n${messages
        .map(({ role, content }) => {
          const safeRole = role === 'assistant' ? 'Assistant' : 'User';

          // escape HTML characters
          let formattedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          // handle code blocks ```
          formattedContent = formattedContent.replace(
            /```([a-zA-Z0-9-]*)?([^```]+)```/g,
            (_, lang, code) => {
              const safeLang = lang ? lang.trim() : '';
              return `<pre><code class="language-${safeLang}">${code.trim()}</code></pre>`;
            }
          );

          // handle inline single backticks
          formattedContent = formattedContent.replace(
            /`([^`]+)`/g,
            (_, code) => `<code>${code}</code>`
          );

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
            .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');

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
                return para;
              }
              return `<p>${para}</p>`;
            })
            .join('\n');

          return `  <div class="message">\n    <div class="role">${safeRole}</div>\n    <div class="content">${formattedContent}</div>\n  </div>`;
        })
        .join('\n')}\n</body>\n</html>`;

    default:
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === 'assistant' ? 'Assistant' : 'User'}\n\n${content}\n\n`
        )
        .join('');
  }
}

export function formatImageInput(src: string, name: string, role: string = 'user'): string {
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);
  return `${capitalizedRole} included image: ${name ?? 'Name not provided'} - ${src ?? 'Unable to retrieve URL'}\n`;
}
