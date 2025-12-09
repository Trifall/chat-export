import optionsStorage from '../options-storage';

import {
  closeExistingOverlays,
  extractContentViaEditMode,
  extractRoleFromTurn,
  handleThinkingMessage,
  performTurnScroll,
} from '@/modules/gemini-helpers';

import { extractFormattedText, getPastedContent } from './content-extraction';
import { formatContent, formatImageInput } from './content-formatting';
import { detectSite } from './site-detection';
import { ChatContent, Message } from './types';

/**
 * Extract artifact code from Claude's artifact panel
 * @param artifactBlock - The artifact block element to click
 * @returns The extracted code with title and language fence, or null if extraction failed
 */
async function extractClaudeArtifact(artifactBlock: Element): Promise<string | null> {
  try {
    // extract the artifact title before clicking
    // find the flex-col container which has the title as first child and type as second child
    const flexCol = artifactBlock.querySelector('.flex-col');
    const artifactTitle = flexCol?.children[0]?.textContent?.trim() || 'Untitled Artifact';

    // click the artifact block to open the side panel
    (artifactBlock as HTMLElement).click();

    // wait for the side panel to open
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // find the segmented control to check/switch to Code tab
    const segmentedControl = document.querySelector('[role="group"].group\\/segmented-control');
    if (segmentedControl) {
      // find the Code button
      const codeButton = segmentedControl.querySelector(
        'button[aria-label="Code"]'
      ) as HTMLButtonElement;
      const previewButton = segmentedControl.querySelector(
        'button[aria-label="Preview"]'
      ) as HTMLButtonElement;

      // if there is a Preview button (meaning Code tab exists), check if Code is active
      if (codeButton && previewButton) {
        const codeState = codeButton.getAttribute('data-state');
        if (codeState !== 'on') {
          // switch to Code tab
          codeButton.click();
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      // if no Preview button, assume already on Code view (code-only artifact)
    }

    // find the Copy button for the artifact panel
    // is NOT the action-bar-copy button (which has a data-testid)
    let copyButton: HTMLButtonElement | null = null;

    const allCopyButtons = document.querySelectorAll('button');
    for (const btn of allCopyButtons) {
      const buttonText = btn.textContent?.trim();
      // skip action bar copy buttons (they have data-testid)
      if (btn.hasAttribute('data-testid')) continue;
      // look for button with exactly "Copy" text
      if (buttonText === 'Copy') {
        // verify this is in the artifact panel by checking if near the code block
        // artifact panel copy button should have a sibling dropdown button
        const nextSibling = btn.nextElementSibling;
        if (nextSibling?.tagName === 'BUTTON') {
          copyButton = btn as HTMLButtonElement;
          break;
        }
      }
    }

    if (!copyButton) {
      console.error('Could not find artifact copy button');
      // try to close any open panel
      const closeButtons = document.querySelectorAll(
        'button[aria-label="Close"], button svg path[d*="15.8536"]'
      );
      if (closeButtons.length > 0) {
        const closeBtn = closeButtons[0].closest('button') as HTMLButtonElement;
        if (closeBtn) closeBtn.click();
      }
      return null;
    }

    // try to detect the programming language from the code element
    let language = '';

    // get the parent of the segmented control
    const copyButtonSuperParent =
      copyButton?.parentElement?.parentElement?.parentElement?.parentElement;

    // Find the artifact panel first, then search within it for the code element
    const codeElement = copyButtonSuperParent?.querySelector('.code-block__code code');

    if (codeElement) {
      // look for language class like "language-tsx", "language-javascript", etc.
      const languageMatch = codeElement.className.match(/language-(\w+)/);
      if (languageMatch) {
        language = languageMatch[1];
      }
      if (language === 'tsx') {
        language = 'typescript';
      } else if (language === 'jsx') {
        language = 'javascript';
      }
    }

    // click copy and get clipboard content
    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const artifactCode = await navigator.clipboard.readText();

    // close the artifact panel
    const panelContainer =
      copyButton.closest('div[class*="flex"][class*="h-full"]') ||
      copyButton.closest('div')?.parentElement?.parentElement;

    if (panelContainer) {
      // find a close button within the panel - look for the last button or one with X-like icon
      const panelButtons = panelContainer.querySelectorAll('button');
      const closeButton = panelButtons[panelButtons.length - 1] as HTMLButtonElement;
      if (closeButton && closeButton !== copyButton) {
        closeButton.click();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (artifactCode) {
      // return formatted with title and as a fenced code block
      return `Artifact: ${artifactTitle}\n\n\`\`\`${language}\n${artifactCode}\n\`\`\``;
    }

    return null;
  } catch (error) {
    console.error('Failed to extract Claude artifact:', error);
    return null;
  }
}

/**
 * Extract all artifacts from a Claude assistant message container
 * @param messageContainer - The parent container of the assistant message
 * @returns Array of extracted artifact code blocks
 */
async function extractAllClaudeArtifacts(messageContainer: Element): Promise<string[]> {
  const artifacts: string[] = [];

  // find all artifact blocks in this message
  // use only .artifact-block-cell to avoid duplicates from nested elements
  const artifactBlocks = messageContainer.querySelectorAll('.artifact-block-cell');

  // deduplicate by filtering out nested artifact blocks
  const uniqueArtifactBlocks: Element[] = [];
  for (const block of artifactBlocks) {
    // check if this block is nested inside another artifact block we already have
    const isNested = uniqueArtifactBlocks.some((existingBlock) => existingBlock.contains(block));
    // check if this block contains another block we already have (take the outer one)
    const containsExisting = uniqueArtifactBlocks.some((existingBlock) =>
      block.contains(existingBlock)
    );

    if (!isNested && !containsExisting) {
      uniqueArtifactBlocks.push(block);
    } else if (containsExisting) {
      // replace the nested one with this outer one
      const nestedIndex = uniqueArtifactBlocks.findIndex((existingBlock) =>
        block.contains(existingBlock)
      );
      if (nestedIndex !== -1) {
        uniqueArtifactBlocks[nestedIndex] = block;
      }
    }
  }

  for (const artifactBlock of uniqueArtifactBlocks) {
    const artifactCode = await extractClaudeArtifact(artifactBlock);
    if (artifactCode) {
      artifacts.push(artifactCode);
    }
    // small delay between artifacts
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return artifacts;
}

export async function getChatContent(restoreClipboard: boolean = false): Promise<ChatContent> {
  const site = detectSite();
  const messages: Array<Message> = [];
  let failedMessages = 0;
  const originalClipboard = await navigator.clipboard.readText();

  if (site === 'chatgpt') {
    // get all conversation turns
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');

    // process each turn individually
    for (const turn of turns) {
      const messageDiv = turn.querySelector('[data-message-author-role]');
      if (!messageDiv) {
        failedMessages++;
        continue;
      }

      const role = messageDiv.getAttribute('data-message-author-role');
      if (!role) {
        failedMessages++;
        continue;
      }

      // scroll this specific turn into view to ensure it's loaded
      const block = role === 'assistant' ? 'end' : 'start';
      turn.scrollIntoView({
        behavior: 'smooth',
        block,
      });

      // wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 500));

      // extract content using JavaScript DOM traversal instead of clipboard
      let content = '';

      try {
        // handle images first
        const images = turn.querySelectorAll('img');
        for (const image of images) {
          // skip favicon images which are used for sources
          if (image.src.includes('google.com/s2/favicons')) continue;

          const imageContent = formatImageInput(image.src, image.alt, role);
          content += imageContent + '\n';
        }

        // query select with class of .whitespace-pre-wrap OR .markdown
        const contentElement = turn.querySelector('.whitespace-pre-wrap, .markdown');
        if (contentElement) {
          // create a deep clone of the content element to avoid modifying the actual UI
          const contentClone = contentElement.cloneNode(true) as Element;

          // delete source links by finding elements with the specific structure:
          // span[data-state] > span > a[target="_blank"][rel="noopener"] > span.relative
          const sourceSpans = Array.from(contentClone.querySelectorAll('span[data-state]')).filter(
            (span) => {
              // span has the expected structure for a source link
              const hasExpectedStructure = !!span.querySelector(
                'span > a[target="_blank"][rel="noopener"] > span.relative'
              );
              return hasExpectedStructure;
            }
          );

          // remove the source spans from their parent nodes
          sourceSpans.forEach((span) => {
            if (span.parentNode) {
              span.parentNode.removeChild(span);
            }
          });

          // remove the source containers (typically at the bottom of the message)
          // these usually have a button with sources text and favicon images
          const sourceContainers = Array.from(contentClone.querySelectorAll('div')).filter(
            (div) => {
              // find buttons with sources text
              const hasSourcesButton = Array.from(div.querySelectorAll('button')).some((button) =>
                button.textContent?.includes('Sources')
              );
              // find divs that contain favicon images
              const hasFaviconImages = Array.from(div.querySelectorAll('img')).some((img) =>
                img.src.includes('google.com/s2/favicons')
              );

              return hasSourcesButton || hasFaviconImages;
            }
          );

          sourceContainers.forEach((container) => {
            if (container.parentNode) {
              container.parentNode.removeChild(container);
            }
          });

          const extractedText = await extractFormattedText(contentClone);
          content += extractedText;
        }

        if (content.trim()) {
          messages.push({ role, content });
        } else {
          failedMessages++;
        }
      } catch (error) {
        console.error('Failed to extract message content:', error);
        failedMessages++;
      }
    }
  } else if (site === 'gemini') {
    // aistudio.google.com (Gemini)
    const chatTurns = document.querySelectorAll('ms-chat-turn');

    for (const turn of chatTurns) {
      try {
        await closeExistingOverlays();
        await performTurnScroll(turn);

        const { role, container } = extractRoleFromTurn(turn);
        if (!container) {
          failedMessages++;
          continue;
        }

        // Handle thinking messages
        if (await handleThinkingMessage(turn, role, messages)) {
          continue;
        }

        // Handle regular messages via edit mode
        const content = await extractContentViaEditMode(turn);
        if (content?.trim()) {
          messages.push({ role, content: content.trim() });
        } else {
          failedMessages++;
        }
      } catch (error) {
        console.error('Failed to extract Gemini message:', error);
        failedMessages++;
      }

      await new Promise((resolve) => setTimeout(resolve, 25)); // Rate limiting
    }
  } else {
    // claude.ai
    // user messages have data-testid="user-message"
    // assistant messages have class="font-claude-response"
    const userMessages = document.querySelectorAll('[data-testid="user-message"]');
    const assistantMessages = document.querySelectorAll('div.font-claude-response');

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
          const parentContainer = div.closest('[data-is-streaming]');
          const actionBar = parentContainer?.querySelector(
            'button[data-testid="action-bar-copy"]'
          ) as HTMLButtonElement;

          if (actionBar) {
            actionBar.click();
            // wait for clipboard to be updated
            await new Promise((resolve) => setTimeout(resolve, 100));
            content = await navigator.clipboard.readText();
          } else {
            // fallback: extract text directly using our formatter
            content = await extractFormattedText(div);
          }

          // Extract artifacts from this assistant message
          // The parent container or a nearby element should contain artifact blocks
          const messageContainer = parentContainer || div.closest('[data-test-render-count]');
          if (messageContainer) {
            const artifacts = await extractAllClaudeArtifacts(messageContainer);
            if (artifacts.length > 0) {
              // Append artifacts to the message content
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
            const pastedContent = await getPastedContent(thumbnailContainer);
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
            failedMessages++;
            continue;
          }
        }

        if (content.trim()) {
          messages.push({ role, content });
        } else {
          failedMessages++;
        }
      } catch (error) {
        console.error('Failed to extract Claude message:', error);
        failedMessages++;
      }
    }
  }

  // get user's preferred format
  const options = await optionsStorage.getAll();
  const format = options.exportType || 'markdown';

  // restore original clipboard content
  if (restoreClipboard) {
    await navigator.clipboard.writeText(originalClipboard);
  }

  const formattedContent = await formatContent(messages, format);
  return { format, content: formattedContent, messageCount: messages.length, failedMessages };
}
