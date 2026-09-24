import { readClipboardText, waitForClipboardChange } from '@/modules/claude/clipboard';
import { SURROUND_PASTE_FILE_IN_BACKTICKS } from '@/modules/constants';
import { formatImageInput } from '@/modules/content-handlers';

function isPastedLabel(element: Element): boolean {
  return /^pasted\b/i.test(element.textContent?.trim() || '');
}

export function findPastedCopyButton(scope: ParentNode = document): HTMLButtonElement | null {
  return scope.querySelector(
    'button[aria-label="Copy attachment text"]'
  ) as HTMLButtonElement | null;
}

export function findPastedContentElement(scope: ParentNode = document): Element | null {
  const preview = scope.querySelector('div[role="dialog"][data-state="open"], div[role="dialog"]');

  return (
    scope.querySelector('.whitespace-pre-wrap.break-all.text-xs') ??
    scope.querySelector('div[role="document"][aria-label^="Attachment text"]') ??
    preview?.querySelector('pre code') ??
    preview?.querySelector('pre') ??
    preview?.querySelector('.whitespace-pre-wrap') ??
    preview?.querySelector('div.overflow-y-auto.whitespace-pre-wrap') ??
    null
  );
}

export function getAttachmentLineCount(contentElement: Element): number | null {
  const match = (contentElement.getAttribute('aria-label') || '').match(/(\d+)\s+lines?/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function getPastedDocumentText(contentElement: Element): string {
  const lines = Array.from(contentElement.querySelectorAll('div[data-index]'));
  if (lines.length > 0) {
    lines.sort(
      (first, second) =>
        (Number(first.getAttribute('data-index')) || 0) -
        (Number(second.getAttribute('data-index')) || 0)
    );
    return lines
      .map((line) => (line.textContent ?? '').replace(/^[\r\n]+/, '').replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');
  }
  return contentElement.textContent || '';
}

export function getPastedBlockTarget(
  flexCol: Element | null,
  messageContainer: Element
): Element | null {
  if (!flexCol) return null;

  const inThumbnail = flexCol.closest('div[data-testid="file-thumbnail"]') !== null;
  const isDirectAttachment = flexCol.parentElement === messageContainer;
  if (!inThumbnail && !isDirectAttachment) return null;

  return flexCol.querySelector('button') ?? flexCol.closest('button');
}

/**
 * Extract pasted content from Claude's pasted document side panel
 * @param pastedBlock - The pasted document element to click
 * @returns The extracted content with title and index, or null if extraction failed
 */
async function extractClaudePastedContent(pastedBlock: Element): Promise<string | null> {
  const MAX_RETRIES = 3;
  const BASE_WAIT_TIME = 1500;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const pastedTitle = 'Pasted Content';
      // click the pasted block to open the side panel
      (pastedBlock as HTMLElement).click();

      // wait for the side panel to open and load content
      const waitTime = BASE_WAIT_TIME + attempt * 500;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // find the content in the side panel
      const contentElement = findPastedContentElement();
      if (!contentElement) {
        console.error('Could not find pasted content element');
        // try to close any open panel
        const closeButtons = document.querySelectorAll(
          'button[aria-label="Close"], button svg path[d*="15.8536"]'
        );
        if (closeButtons.length > 0) {
          const closeBtn = closeButtons[0].closest('button') as HTMLButtonElement;
          if (closeBtn) closeBtn.click();
        }
        continue;
      }

      // read the panel DOM first: the copy button depends on clipboard focus,
      // but only trust it when all labeled lines are mounted
      const panelText = getPastedDocumentText(contentElement);
      const expectedLines = getAttachmentLineCount(contentElement);
      if (panelText && (expectedLines === null || panelText.split('\n').length >= expectedLines)) {
        const closeButton = document.querySelector(
          'button[data-testid="close-file-preview"]'
        ) as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return `${pastedTitle}\n\n\`\`\`\n${panelText}\n\`\`\``;
      }

      // fall back to the panel's copy button, which copies the full text
      // even when the preview only mounts part of the file
      const copyButton = findPastedCopyButton();
      if (copyButton) {
        const previousClipboard = await readClipboardText();
        copyButton.click();
        const copiedContent = await waitForClipboardChange(previousClipboard, 1500);
        if (copiedContent) {
          const closeButton = document.querySelector(
            'button[data-testid="close-file-preview"]'
          ) as HTMLButtonElement;
          if (closeButton) {
            closeButton.click();
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          return `${pastedTitle}\n\n\`\`\`\n${copiedContent}\n\`\`\``;
        }
        console.warn('Pasted copy button did not yield clipboard content, trying panel text');
      }

      // extract the content text
      const pastedContent = contentElement.textContent || '';

      if (pastedContent) {
        // close the pasted panel
        const closeButton = document.querySelector(
          'button[data-testid="close-file-preview"]'
        ) as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // return formatted with title and index
        return `${pastedTitle}\n\n\`\`\`\n${pastedContent}\n\`\`\``;
      } else {
        console.warn(
          `Pasted content extraction attempt ${attempt + 1}: No content detected, retrying...`
        );
        // close panel and retry
        const closeButton = document.querySelector(
          'button[data-testid="close-file-preview"]'
        ) as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        continue;
      }
    } catch (error) {
      console.error(`Pasted content extraction attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) {
        console.error('All pasted content extraction attempts failed');
        return null;
      }
      // wait before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.error('All pasted content extraction attempts failed');
  return null;
}

/**
 * Extract all pasted content from a Claude user message container
 * @param messageContainer - The parent container of the user message
 * @returns Array of extracted pasted content blocks
 */
export async function extractAllClaudePastedContent(messageContainer: Element): Promise<string[]> {
  const pastedContents: string[] = [];
  let extractionErrors = 0;

  try {
    // find all pasted document blocks in this message
    // look for elements with "pasted" badge
    const pastedBlocks: Element[] = [];

    // First, look for regular file thumbnails with pasted badges
    const fileThumbnails = messageContainer.querySelectorAll('div[data-testid="file-thumbnail"]');
    fileThumbnails.forEach((thumbnail) => {
      const flexCol = thumbnail.querySelector('.flex-col');
      const badgeElement = flexCol?.querySelector('.text-text-300');
      const target = getPastedBlockTarget(flexCol, messageContainer);
      if (badgeElement && isPastedLabel(badgeElement) && target && !pastedBlocks.includes(target)) {
        pastedBlocks.push(target);
      }
    });

    // Also look for pasted documents that might be direct children (for pasted-only messages)
    const directPastedElements = messageContainer.querySelectorAll('.flex-col .text-text-300');
    directPastedElements.forEach((badgeElement) => {
      const flexCol = badgeElement.closest('.flex-col');
      const target = getPastedBlockTarget(flexCol, messageContainer);
      if (isPastedLabel(badgeElement) && target && !pastedBlocks.includes(target)) {
        pastedBlocks.push(target);
      }
    });

    console.log(`Found ${pastedBlocks.length} pasted content blocks in message container`);

    for (let i = 0; i < pastedBlocks.length; i++) {
      const pastedBlock = pastedBlocks[i];
      console.log(`Extracting pasted content ${i + 1}/${pastedBlocks.length}`);

      try {
        const pastedContent = await extractClaudePastedContent(pastedBlock);
        if (pastedContent) {
          pastedContents.push(pastedContent);
          console.log(`Successfully extracted pasted content ${i + 1}`);
        } else {
          extractionErrors++;
          console.warn(`Failed to extract pasted content ${i + 1}: No content returned`);
        }
      } catch (error) {
        extractionErrors++;
        console.error(`Error extracting pasted content ${i + 1}:`, error);
      }

      // small delay between pasted contents to prevent overwhelming the UI
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (extractionErrors > 0) {
      console.warn(
        `Pasted content extraction completed with ${extractionErrors} errors out of ${pastedBlocks.length} total pasted contents`
      );
    } else {
      console.log(`Successfully extracted all ${pastedContents.length} pasted contents`);
    }

    return pastedContents;
  } catch (error) {
    console.error('Critical error in extractAllClaudePastedContent:', error);
    return pastedContents; // return whatever we managed to extract
  }
}

export async function getClaudeNonPastedContent(div: Element): Promise<string | null> {
  // find all file and image elements
  const allFileElements = div.querySelectorAll(
    'div[data-testid="file-thumbnail"]'
  ) as NodeListOf<HTMLElement>;
  const imageElements = div.querySelectorAll('img') as NodeListOf<HTMLImageElement>;

  // filter out file thumbnails that have a "pasted" badge (those are handled by extractAllClaudePastedContent)
  const fileElements: HTMLElement[] = [];
  allFileElements.forEach((thumbnail) => {
    const badgeElement = thumbnail.querySelector('.text-text-300');
    if (!badgeElement || !badgeElement.textContent?.toLowerCase().includes('pasted')) {
      fileElements.push(thumbnail);
    }
  });

  if (!fileElements.length && !imageElements.length) return null;

  const contents: string[] = [];

  // handle non-pasted files
  for (let i = 0; i < fileElements.length; i++) {
    const clickableDiv = fileElements[i];

    // extract filename from the thumbnail before clicking
    const fileNameEl = clickableDiv.querySelector('h3');
    const fileName = fileNameEl?.textContent?.trim() || 'unknown file';

    // close any stale side panel left from previous extractions
    // (prevents querySelector from finding hidden/stale content elements)
    const staleCloseButton = document.querySelector(
      'button[data-testid="close-file-preview"]'
    ) as HTMLElement;
    if (staleCloseButton) {
      staleCloseButton.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // click the button inside the thumbnail directly (more reliable than clicking the wrapper div)
    const buttonInThumbnail = clickableDiv.querySelector('button') as HTMLElement;
    (buttonInThumbnail || clickableDiv).click();
    await new Promise((resolve) => setTimeout(resolve, 750));

    // check if a "Preview isn't available" dialog appeared (non-previewable file)
    const previewDialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (previewDialog) {
      const dialogText = previewDialog.textContent || '';
      if (dialogText.includes("Preview isn't available")) {
        // non-previewable file — close the dialog and add a placeholder
        const closeBtn = previewDialog.querySelector('button[aria-label="Close"]') as HTMLElement;
        if (closeBtn) {
          closeBtn.click();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        contents.push(`User attached file: ${fileName} (preview not available)\n`);
        continue;
      }
    }

    // check if the side panel actually opened by looking for its close button
    const sidePanelCloseButton = document.querySelector(
      'button[data-testid="close-file-preview"]'
    ) as HTMLElement;
    if (!sidePanelCloseButton) {
      // side panel didn't open — this file is non-previewable (no dialog appeared either)
      contents.push(`User attached file: ${fileName} (preview not available)\n`);
      continue;
    }

    // previewable file — find the content in the side panel
    const contentElement = document.querySelector('.whitespace-pre-wrap.break-all.text-xs');
    if (!contentElement) {
      // close the panel if we couldn't find the content
      sidePanelCloseButton.click();
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

    // close the side panel
    sidePanelCloseButton.click();
  }

  // handle images
  for (let i = 0; i < imageElements.length; i++) {
    const imageElement = imageElements[i];
    const imageContent = formatImageInput(imageElement.src, imageElement.alt, 'user');
    contents.push(imageContent);
  }

  return contents.length > 0 ? contents.join('\n') : null;
}
