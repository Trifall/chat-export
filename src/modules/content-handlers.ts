import { Message } from './types';

export async function extractFormattedText(element: Element): Promise<string> {
  return new Promise((resolve) => {
    let formattedText = '';
    let listLevel = 0;

    function extractText(node: Node, isInListItem: boolean = false) {
      if (node instanceof Element) {
        if (node.getAttribute('aria-hidden') === 'true') {
          return;
        }
        if (node.classList?.contains('sr-only')) {
          return;
        }
        if (node.getAttribute('data-markdown-copy') === 'exclude') {
          return;
        }
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
        const rawText = node.textContent || '';
        if (!rawText.trim()) {
          if (formattedText && !formattedText.endsWith('\n') && !formattedText.endsWith(' ')) {
            formattedText += ' ';
          }
          return;
        }
        let text = rawText.replace(/\s+/g, ' ');
        if (formattedText === '' || formattedText.endsWith('\n')) {
          text = text.replace(/^ /, '');
        }
        formattedText += text;
      } else if (node.nodeName === 'PRE') {
        const preElement = node as Element;
        const codeElement = preElement.querySelector('code');
        const language = codeElement?.className.replace('language-', '').trim() || '';
        const codeContent = getCodeBlockContent(codeElement || preElement);
        formattedText += '\n```' + (language ? language + '\n' : '\n') + codeContent + '\n```\n';
      } else if (node.nodeName === 'CODE' && node.parentElement?.nodeName !== 'PRE') {
        formattedText += '`' + node.textContent + '`';
      } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        if (listLevel === 0) formattedText += '\n';
        listLevel++;
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], true);
        }
        listLevel--;
        if (listLevel === 0) formattedText += '\n\n';
      } else if (node.nodeName === 'LI') {
        formattedText = formattedText.replace(/ +$/, '');
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
      } else if (
        node instanceof Element &&
        node.getAttribute('data-markdown-copy') === 'code-block'
      ) {
        appendMarkdownCodeBlock(node);
      } else if (node.nodeName === 'TABLE') {
        appendMarkdownTable(node as Element);
      } else if (node.nodeName === 'P') {
        if (!isInListItem) formattedText += '\n\n';
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem);
        }
        if (!isInListItem) {
          formattedText = formattedText.replace(/ +$/, '');
          formattedText += '\n\n';
        }
      } else if (node.nodeName === 'H1') {
        formattedText += '\n# ' + node.textContent?.trim() + '\n';
      } else if (node.nodeName === 'H2') {
        formattedText += '\n## ' + node.textContent?.trim() + '\n';
      } else if (node.nodeName === 'H3') {
        formattedText += '\n### ' + node.textContent?.trim() + '\n';
      } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
        formattedText += '**' + (node.textContent || '').replace(/\s+/g, ' ').trim() + '**';
      } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
        formattedText += '*' + (node.textContent || '').replace(/\s+/g, ' ').trim() + '*';
      } else if (node.nodeName === 'A') {
        const href = (node as HTMLAnchorElement).href;
        formattedText +=
          '[' + (node.textContent || '').replace(/\s+/g, ' ').trim() + '](' + href + ')';
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          extractText(node.childNodes[i], isInListItem);
        }
      }
    }

    function getIndentation(level: number): string {
      return '  '.repeat(level);
    }

    function getCodeBlockContent(preElement: Element): string {
      const codeElement = preElement.querySelector('code');
      const codeSource = codeElement || preElement;

      // The outer ChatGPT `<pre>` contains toolbar/chrome. The real code lives
      // in an editor-rendered shape like:
      //
      //   <div class="... cm-editor ...">
      //     <div class="cm-scroller">
      //       <pre class="cm-content ...">
      //         <code>
      //           <span># comment</span><br>
      //           <span>command</span><br><br>
      //           <span># next comment</span><br>
      //           <span>next-command</span>
      //         </code>
      //       </pre>
      //     </div>
      //   </div>
      //
      // The inner `<code>` uses `<br>` elements for line breaks. `textContent`
      // drops those breaks, and `innerText` is not reliable after cloning the
      // DOM, so preserve `<br>` explicitly while reading the code subtree.
      return getTextWithLineBreaks(codeSource).replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    }

    function getTextWithLineBreaks(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeName === 'BR') {
        return '\n';
      }

      return Array.from(node.childNodes)
        .map((childNode) => getTextWithLineBreaks(childNode))
        .join('');
    }

    function getTableCellText(cell: Node): string {
      const parts: string[] = [];
      const appendInlineText = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push((node.textContent || '').replace(/\s+/g, ' '));
        } else if (node.nodeName === 'BR') {
          parts.push(' ');
        } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
          parts.push('**');
          Array.from(node.childNodes).forEach(appendInlineText);
          parts.push('**');
        } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
          parts.push('*');
          Array.from(node.childNodes).forEach(appendInlineText);
          parts.push('*');
        } else if (node.nodeName === 'CODE' && node.parentElement?.nodeName !== 'PRE') {
          parts.push(`\`${(node.textContent || '').replace(/\s+/g, ' ').trim()}\``);
        } else if (node.nodeName === 'A') {
          parts.push('[');
          Array.from(node.childNodes).forEach(appendInlineText);
          parts.push(`](${(node as HTMLAnchorElement).href})`);
        } else {
          Array.from(node.childNodes).forEach(appendInlineText);
        }
      };

      appendInlineText(cell);
      return parts.join('').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
    }

    function appendMarkdownCodeBlock(block: Element): void {
      const header = block.querySelector('[data-markdown-copy="exclude"]');
      const label =
        (header?.querySelector('.truncate') ?? header)?.textContent?.trim().replace(/\s+/g, ' ') ||
        '';
      const code = block.querySelector('code');
      const codeContent = code ? getCodeBlockContent(code) : '';
      formattedText += `\n\`\`\`${label}\n${codeContent}\n\`\`\`\n`;
    }

    function appendMarkdownTable(table: Element): void {
      const rows = Array.from(
        table.querySelectorAll(
          ':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'
        )
      )
        .map((row) =>
          Array.from(row.children)
            .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
            .map((cell) => getTableCellText(cell))
        )
        .filter((row) => row.length > 0);
      if (rows.length === 0) return;

      const columnCount = Math.max(...rows.map((row) => row.length));
      const normalizedRows = rows.map((row) => [
        ...row,
        ...Array(columnCount - row.length).fill(''),
      ]);
      formattedText += `\n${normalizedRows[0].join(' | ')}\n`;
      formattedText += `${normalizedRows[0].map(() => '---').join(' | ')}\n`;
      for (let index = 1; index < normalizedRows.length; index++) {
        formattedText += `${normalizedRows[index].join(' | ')}\n`;
      }
      formattedText += '\n';
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
