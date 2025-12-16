import { SURROUND_PASTE_FILE_IN_BACKTICKS } from '@/modules/constants';
import { formatImageInput } from '@/modules/content-handlers';

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
      const contentElement = document.querySelector('.whitespace-pre-wrap.break-all.text-xs');
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
        return null;
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
      if (flexCol) {
        const badgeElement = flexCol.querySelector('.text-text-300');
        if (badgeElement && badgeElement.textContent?.toLowerCase().includes('pasted')) {
          pastedBlocks.push(flexCol);
        }
      }
    });

    // Also look for pasted documents that might be direct children (for pasted-only messages)
    const directPastedElements = messageContainer.querySelectorAll('.flex-col .text-text-300');
    directPastedElements.forEach((badgeElement) => {
      if (badgeElement.textContent?.toLowerCase().includes('pasted')) {
        const flexCol = badgeElement.closest('.flex-col');
        if (flexCol && !pastedBlocks.includes(flexCol)) {
          pastedBlocks.push(flexCol);
        }
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
