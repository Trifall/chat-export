import { extractAllClaudeArtifacts } from '@/modules/claude/artifacts';
import { SURROUND_PASTE_FILE_IN_BACKTICKS } from '@/modules/constants';
import { extractFormattedText, formatImageInput } from '@/modules/content-handlers';
import { Message } from '@/modules/types';

/**
 * Clean up duplicated language labels in code blocks
 * Claude's copy sometimes produces "bash```bash" instead of "```bash"
 */
function cleanupCodeBlocks(content: string): string {
  return content.replace(/([a-zA-Z0-9_+-]+)\s*```\1\b/g, '```$1');
}

export async function getClaudePastedContent(div: Element): Promise<string | null> {
  // find all file and image elements
  const fileElements = div.querySelectorAll(
    'div[data-testid="file-thumbnail"]'
  ) as NodeListOf<HTMLElement>;
  const imageElements = div.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
  if (!fileElements.length && !imageElements.length) return null;

  const contents: string[] = [];

  // handle files
  for (let i = 0; i < fileElements.length; i++) {
    // click to open side panel
    const clickableDiv = fileElements[i];
    if (clickableDiv) clickableDiv.click();
    await new Promise((resolve) => setTimeout(resolve, 125)); // wait for panel to open

    // find the content in the side panel
    const contentElement = document.querySelector('.whitespace-pre-wrap.break-all.text-xs');
    if (!contentElement) {
      // close the panel if we couldn't find the content
      const closeButton = document.querySelector(
        'button[data-testid="close-file-preview"]'
      ) as HTMLElement;
      if (closeButton) closeButton.click();
      continue; // skip this file but continue processing others
    }

    const fileContent = contentElement.textContent || '';
    if (fileContent) {
      if (SURROUND_PASTE_FILE_IN_BACKTICKS) {
        contents.push(`\`\`\`\n${fileContent}\n\`\`\`\n`);
      } else {
        contents.push(fileContent);
      }
    }

    // close the panel
    const closeButton = document.querySelector(
      'button[data-testid="close-file-preview"]'
    ) as HTMLElement;
    if (closeButton) closeButton.click();
  }

  // handle images
  for (let i = 0; i < imageElements.length; i++) {
    const imageElement = imageElements[i];
    const imageContent = formatImageInput(imageElement.src, imageElement.alt, 'user');
    contents.push(imageContent);
  }

  return contents.length > 0 ? contents.join('\n') : null;
}

export const getClaudeChatContent = async () => {
  // claude.ai
  // user messages have data-testid="user-message"
  // assistant messages have class="font-claude-response"
  const userMessages = document.querySelectorAll('[data-testid="user-message"]');
  const assistantMessages = document.querySelectorAll('div.font-claude-response');

  let failedClaudeMessages = 0;
  const claudeMessages: Array<Message> = [];

  // create a combined list with position info for ordering
  const allMessages: Array<{ element: Element; role: string; position: number }> = [];

  userMessages.forEach((el) => {
    const rect = el.getBoundingClientRect();
    // use document position for ordering
    const position = rect.top + window.scrollY;
    allMessages.push({ element: el, role: 'user', position });
  });

  assistantMessages.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const position = rect.top + window.scrollY;
    allMessages.push({ element: el, role: 'assistant', position });
  });

  // sort by position (top to bottom)
  allMessages.sort((a, b) => a.position - b.position);

  for (const { element: div, role } of allMessages) {
    try {
      let content = '';

      if (role === 'assistant') {
        // for assistant messages, find the copy button in the action bar
        // the action bar is in a sibling div with class "absolute"
        const messageGroup = div.closest('[data-is-streaming]')?.parentElement;
        const actionBar = messageGroup?.querySelector(
          'button[data-testid="action-bar-copy"]'
        ) as HTMLButtonElement;

        if (actionBar) {
          actionBar.click();
          // wait for clipboard to be updated
          await new Promise((resolve) => setTimeout(resolve, 100));
          content = await navigator.clipboard.readText();
          // clean up duplicate language labels in code blocks
          content = cleanupCodeBlocks(content);
        } else {
          // fallback: extract text directly using our formatter
          content = await extractFormattedText(div);
        }

        // extract artifacts from this assistant message
        // the parent container or a nearby element should contain artifact blocks
        const messageContainer = messageGroup || div.closest('[data-test-render-count]');
        if (messageContainer) {
          const artifacts = await extractAllClaudeArtifacts(messageContainer);
          if (artifacts.length > 0) {
            // append artifacts to the message content
            content += '\n\n' + artifacts.join('\n\n');
          }
        }
      } else {
        // for user messages, handle regular text, code blocks, and pasted content
        const messageParts: string[] = [];

        // look for pasted/attached content (images, files)
        // find the parent message container and look for thumbnails
        const messageContainer = div.closest('[data-test-render-count]');
        const thumbnailContainer = messageContainer?.querySelector('div.group\\/thumbnail')
          ?.parentElement?.parentElement as HTMLElement;

        if (thumbnailContainer) {
          const pastedContent = await getClaudePastedContent(thumbnailContainer);
          if (pastedContent) {
            messageParts.push(pastedContent);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // extract text content from user message
        const textContent = await extractFormattedText(div);
        if (textContent) {
          messageParts.push(textContent);
        }

        content = messageParts.join('\n');
        if (!content) {
          failedClaudeMessages++;
          continue;
        }
      }

      if (content.trim()) {
        claudeMessages.push({ role, content });
      } else {
        failedClaudeMessages++;
      }
    } catch (error) {
      console.error('Failed to extract Claude message:', error);
      failedClaudeMessages++;
    }
  }

  return { claudeMessages, failedClaudeMessages };
};
