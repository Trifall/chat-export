import { extractAllClaudeArtifacts } from '@/modules/claude/artifacts';
import {
  extractAllClaudePastedContent,
  getClaudePastedContent,
} from '@/modules/claude/pasted-content';
import { extractFormattedText } from '@/modules/content-handlers';
import { Message } from '@/modules/types';

/**
 * Clean up duplicated language labels in code blocks
 * Claude's copy sometimes produces "bash```bash" instead of "```bash"
 */
function cleanupCodeBlocks(content: string): string {
  return content.replace(/([a-zA-Z0-9_+-]+)\s*```\1\b/g, '```$1');
}

export const getClaudeChatContent = async () => {
  // claude.ai
  // user messages have data-testid="user-message"
  // assistant messages have class="font-claude-response"
  // also look for pasted-only messages (no data-testid but contain pasted documents)
  const userMessages = document.querySelectorAll('[data-testid="user-message"]');
  const assistantMessages = document.querySelectorAll('div.font-claude-response');

  // find pasted-only messages (messages that contain pasted documents but no data-testid)
  const pastedOnlyMessages: Element[] = [];
  const messageGroups = document.querySelectorAll('div[data-test-render-count]');

  messageGroups.forEach((group) => {
    const badgeElement = group.querySelector('.text-text-300');
    if (badgeElement && badgeElement.textContent?.toLowerCase().includes('pasted')) {
      pastedOnlyMessages.push(group);
    }
  });

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

  // add pasted-only messages as user messages
  pastedOnlyMessages.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const position = rect.top + window.scrollY;
    allMessages.push({ element: el, role: 'user', position });
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

        // check if this is a pasted-only message (no data-testid attribute)
        const isPastedOnlyMessage = !div.hasAttribute('data-testid');

        if (isPastedOnlyMessage) {
          // this is a pasted-only message, extract pasted content directly from the message element
          const pastedContents = await extractAllClaudePastedContent(div);
          if (pastedContents.length > 0) {
            // format pasted content with indices
            pastedContents.forEach((pastedContent, index) => {
              messageParts.push(`Pasted Content #${index + 1}:\n\n${pastedContent}`);
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } else {
          // this is a regular user message, handle both pasted content and text
          // look for pasted/attached content (images, files)
          // find the parent message container and look for thumbnails
          const messageContainer = div.closest('[data-test-render-count]');

          if (messageContainer) {
            // extract pasted content from pasted document blocks
            const pastedContents = await extractAllClaudePastedContent(messageContainer);
            if (pastedContents.length > 0) {
              // format pasted content with indices
              pastedContents.forEach((pastedContent, index) => {
                messageParts.push(`Pasted Content #${index + 1}:\n\n${pastedContent}`);
              });
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // also handle regular file thumbnails (non-pasted)
            const thumbnailContainer = messageContainer?.querySelector('div.group\\/thumbnail')
              ?.parentElement?.parentElement as HTMLElement;
            if (thumbnailContainer) {
              const regularPastedContent = await getClaudePastedContent(thumbnailContainer);
              if (regularPastedContent) {
                messageParts.push(regularPastedContent);
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }
          }

          // extract text content from user message
          const textContent = await extractFormattedText(div);
          if (textContent) {
            messageParts.push(textContent);
          }
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
