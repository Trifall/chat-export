import { extractAllClaudeArtifacts } from '@/modules/claude/artifacts';
import { readClipboardText, waitForClipboardChange } from '@/modules/claude/clipboard';
import {
  extractAllClaudePastedContent,
  getClaudeNonPastedContent,
  getPastedBlockTarget,
} from '@/modules/claude/pasted-content';
import { extractFormattedText } from '@/modules/content-handlers';
import { SweepOrderedValue, orderSweepValues, sweepMountedElements } from '@/modules/scroll-sweep';
import { Message } from '@/modules/types';

/**
 * Clean up duplicated language labels in code blocks
 * Claude's copy sometimes produces "bash```bash" instead of "```bash"
 */
function cleanupCodeBlocks(content: string): string {
  return content.replace(/([a-zA-Z0-9_+-]+)\s*```\1\b/g, '```$1');
}

const CLAUDE_MESSAGE_SELECTOR =
  '[data-testid="user-message"], div.font-claude-response, div[data-test-render-count]';

type ClaudeMessageRole = 'user' | 'assistant' | null;

export function isPastedOnlyMessage(element: Element): boolean {
  return Array.from(element.querySelectorAll('.flex-col .text-text-300')).some((badge) => {
    const flexCol = badge.closest('.flex-col');
    return (
      /^pasted\b/i.test(badge.textContent?.trim() || '') &&
      getPastedBlockTarget(flexCol, element) !== null
    );
  });
}

function getClaudeMessageRole(element: Element): ClaudeMessageRole {
  if (element.matches('[data-testid="user-message"]')) return 'user';
  if (element.matches('div.font-claude-response')) return 'assistant';
  if (
    element.matches('div[data-test-render-count]') &&
    !element.querySelector('[data-testid="user-message"]') &&
    isPastedOnlyMessage(element)
  ) {
    return 'user';
  }
  return null;
}

function getClaudeMessageOrder(element: Element): number | null {
  const row = element.closest('[data-rs-index], [data-index]');
  const index = row?.getAttribute(
    row?.hasAttribute('data-rs-index') ? 'data-rs-index' : 'data-index'
  );
  const order = index === undefined || index === null ? NaN : Number.parseInt(index, 10);
  return Number.isInteger(order) ? order : null;
}

function getClaudeMessageKey(element: Element): string | null {
  const role = getClaudeMessageRole(element);
  const row = element.closest('[data-rs-index], [data-index]');
  if (!role || !row) return null;

  const indexName = row.hasAttribute('data-rs-index') ? 'data-rs-index' : 'data-index';
  const index = row.getAttribute(indexName);
  if (index === null) return null;

  const roleIndex = Array.from(row.querySelectorAll(CLAUDE_MESSAGE_SELECTOR))
    .filter((candidate) => getClaudeMessageRole(candidate) === role)
    .indexOf(element);
  return `${indexName}:${index}:${role}:${roleIndex}`;
}

function getClaudeMessages(): Element[] {
  return Array.from(document.querySelectorAll(CLAUDE_MESSAGE_SELECTOR)).filter(
    (element) => getClaudeMessageRole(element) !== null
  );
}

async function extractClaudeMessageContent(
  element: Element,
  role: Exclude<ClaudeMessageRole, null>
): Promise<string | null> {
  let content = '';

  if (role === 'assistant') {
    const messageGroup = element.closest('[data-is-streaming]')?.parentElement;
    const actionBar = messageGroup?.querySelector(
      'button[data-testid="action-bar-copy"]'
    ) as HTMLButtonElement | null;
    const bodyClone = element.cloneNode(true) as Element;
    bodyClone.querySelectorAll('[data-sheet-kind]').forEach((card) => card.remove());

    content = await extractFormattedText(bodyClone);
    if (!content.trim() && actionBar) {
      actionBar.click();
      const previousClipboard = await readClipboardText();
      content = cleanupCodeBlocks(await waitForClipboardChange(previousClipboard, 1000));
    }

    const messageContainer = messageGroup || element.closest('[data-test-render-count]');
    if (messageContainer) {
      const artifacts = await extractAllClaudeArtifacts(messageContainer);
      if (artifacts.length > 0) {
        content += '\n\n' + artifacts.join('\n\n');
      }
    }
  } else {
    const messageParts: string[] = [];
    const isPastedOnlyMessage = !element.hasAttribute('data-testid');

    if (isPastedOnlyMessage) {
      const pastedContents = await extractAllClaudePastedContent(element);
      if (pastedContents.length > 0) {
        pastedContents.forEach((pastedContent, index) => {
          messageParts.push(`Pasted Content #${index + 1}:\n\n${pastedContent}`);
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } else {
      const bodyClone = element.cloneNode(true) as Element;
      bodyClone
        .querySelectorAll('div[data-testid="file-thumbnail"]')
        .forEach((thumbnail) => thumbnail.remove());
      const textContent = await extractFormattedText(bodyClone);
      const messageContainer = element.closest('[data-test-render-count]');

      if (messageContainer) {
        const pastedContents = await extractAllClaudePastedContent(messageContainer);
        if (pastedContents.length > 0) {
          pastedContents.forEach((pastedContent, index) => {
            messageParts.push(`Pasted Content #${index + 1}:\n\n${pastedContent}`);
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const thumbnailContainer =
          messageContainer.querySelector('div.group\\/thumbnail')?.parentElement?.parentElement;
        if (thumbnailContainer) {
          const nonPastedContent = await getClaudeNonPastedContent(thumbnailContainer);
          if (nonPastedContent) {
            messageParts.push(nonPastedContent);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      if (textContent) {
        messageParts.push(textContent);
      }
    }

    content = messageParts.join('\n');
  }

  return content.trim() ? content : null;
}

export const getClaudeChatContent = async () => {
  const collectedMessages: Array<SweepOrderedValue<Message>> = [];
  let sequence = 0;
  const failedClaudeMessages = await sweepMountedElements(
    getClaudeMessages,
    getClaudeMessageKey,
    async (element) => {
      const role = getClaudeMessageRole(element);
      if (!role) return false;

      const content = await extractClaudeMessageContent(element, role);
      if (!content) return false;

      collectedMessages.push({
        order: getClaudeMessageOrder(element),
        sequence: sequence++,
        value: { role, content },
      });
      return true;
    },
    (error) => console.error('Failed to extract Claude message:', error)
  );

  return { claudeMessages: orderSweepValues(collectedMessages), failedClaudeMessages };
};
