import { readClipboardText, waitForClipboardChange } from '@/modules/claude/clipboard';

export function findArtifactCopyButton(scope: ParentNode = document): HTMLButtonElement | null {
  const splitButton = Array.from(
    scope.querySelectorAll('div[data-cds="SplitDropdownButton"][aria-label="Copy"] button')
  ).find((button) => button.textContent?.trim() === 'Copy');
  if (splitButton) return splitButton as HTMLButtonElement;

  // find the Copy button for the artifact panel
  // is NOT the action-bar-copy button (which has a data-testid)
  const allCopyButtons = scope.querySelectorAll('button');
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
        return btn as HTMLButtonElement;
      }
    }
  }
  return null;
}

async function closeArtifactPanel(
  panel: Element | null,
  copyButton: HTMLButtonElement | null
): Promise<void> {
  const explicitClose = panel?.querySelector(
    'button[aria-label="Close artifact"]'
  ) as HTMLButtonElement | null;
  if (explicitClose && explicitClose !== copyButton) {
    explicitClose.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    return;
  }

  const panelContainer =
    copyButton?.closest('div[class*="flex"][class*="h-full"]') ||
    copyButton?.closest('div')?.parentElement?.parentElement;

  if (panelContainer) {
    // find a close button within the panel - look for the last button or one with X-like icon
    const panelButtons = panelContainer.querySelectorAll('button');
    const closeButton = panelButtons[panelButtons.length - 1] as HTMLButtonElement;
    if (closeButton && closeButton !== copyButton) {
      closeButton.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Extract artifact code from Claude's artifact panel
 * @param artifactBlock - The artifact block element to click
 * @returns The extracted code with title and language fence, or null if extraction failed
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  getValue: () => T | null | Promise<T | null>,
  timeout: number
): Promise<T | null> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await getValue();
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await sleep(100);
  }
}

export function getArtifactCodeText(codeElement: Element): string {
  const groupedLines = Array.from(
    codeElement.querySelectorAll('span[data-code-line-group] > span')
  );
  const lineSpans =
    groupedLines.length > 0
      ? groupedLines
      : Array.from(codeElement.querySelectorAll('span.block')).filter(
          (span) => !span.querySelector('span.block')
        );
  if (lineSpans.length === 0) {
    return (codeElement.textContent || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  }
  return lineSpans
    .map((span) => (span.textContent ?? '').replace(/^[\r\n]+/, '').replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

async function extractClaudeArtifact(artifactBlock: Element): Promise<string | null> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // extract the artifact title before clicking
      // find the flex-col container which has the title as first child and type as second child
      const flexCol = artifactBlock.querySelector('.flex-col');
      const titleElement = artifactBlock.querySelector('.truncate.text-heading');
      const subtitleElement = artifactBlock.querySelector('.truncate.text-footnote');
      const viewButton = artifactBlock.querySelector('button[aria-label^="View "]');
      const viewTitle = viewButton
        ?.getAttribute('aria-label')
        ?.replace(/^View\s+/, '')
        .trim();
      const subtitle = subtitleElement?.textContent?.trim().replace(/\s+/g, ' ');
      const artifactTitle =
        titleElement?.textContent?.trim() ||
        viewTitle ||
        flexCol?.children[0]?.textContent?.trim() ||
        'Untitled Artifact';
      const artifactHeading = subtitle ? `${artifactTitle} (${subtitle})` : artifactTitle;

      // click the artifact block to open the side panel
      const openButton = artifactBlock.matches('[data-sheet-kind]')
        ? (artifactBlock.querySelector('button[aria-label^="View "], button') as HTMLElement | null)
        : null;
      ((openButton ?? artifactBlock) as HTMLElement).click();

      // wait for the side panel to open
      const panel = await waitFor(
        () => document.querySelector('[role="region"][aria-label^="Artifact panel:"]'),
        2000
      );
      if (!panel) {
        console.error('Could not find artifact panel');
        continue;
      }

      // find the segmented control to check/switch to Code tab
      const segmentedControl =
        panel.querySelector('[role="group"].group\\/segmented-control') ??
        document.querySelector('[role="group"].group\\/segmented-control');
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

      // try to detect the programming language from the code element
      let language = '';

      // find the artifact panel first, then search within it for the code element
      const codeElement = panel?.querySelector('.code-block__code code');

      if (codeElement) {
        // look for language class like "language-rust", "language-javascript", etc.
        const languageMatch = codeElement.className.match(/language-(\w+)/);
        if (languageMatch) {
          language = languageMatch[1];
        }
      }

      // read the code straight from the panel DOM; the copy button depends on
      // clipboard focus and is only a fallback when the panel has no code yet
      let artifactCode = codeElement ? getArtifactCodeText(codeElement) : '';
      let copyButton: HTMLButtonElement | null = null;
      if (!artifactCode) {
        copyButton = await waitFor(() => findArtifactCopyButton(panel), 2000);
        if (copyButton) {
          const previousClipboard = await readClipboardText();
          copyButton.click();
          artifactCode = await waitForClipboardChange(previousClipboard, 1000);
        } else {
          console.error('Could not find artifact copy button');
        }
      }

      // verify that we got actual code, not conversation text
      if (artifactCode) {
        await closeArtifactPanel(panel, copyButton);

        // return formatted with title and as a fenced code block
        return `Artifact: ${artifactHeading}\n\n\`\`\`${language}\n${artifactCode}\n\`\`\``;
      } else {
        console.warn(
          `Artifact extraction attempt ${attempt + 1}: Invalid content detected, retrying...`
        );
        await closeArtifactPanel(panel, copyButton);

        // continue to next retry
        continue;
      }
    } catch (error) {
      console.error(`Artifact extraction attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) {
        console.error('All artifact extraction attempts failed');
        return null;
      }
      // wait before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.error('All artifact extraction attempts failed');
  return null;
}

/**
 * Extract all artifacts from a Claude assistant message container
 * @param messageContainer - The parent container of the assistant message
 * @returns Array of extracted artifact code blocks
 */
export async function extractAllClaudeArtifacts(messageContainer: Element): Promise<string[]> {
  const artifacts: string[] = [];
  let extractionErrors = 0;

  try {
    // find all artifact blocks in this message
    // use only .artifact-block-cell to avoid duplicates from nested elements
    const artifactBlocks = messageContainer.querySelectorAll(
      '.artifact-block-cell, [data-sheet-kind]'
    );

    console.log(`Found ${artifactBlocks.length} artifact blocks in message container`);

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

    console.log(`Processing ${uniqueArtifactBlocks.length} unique artifact blocks`);

    for (let i = 0; i < uniqueArtifactBlocks.length; i++) {
      const artifactBlock = uniqueArtifactBlocks[i];
      console.log(`Extracting artifact ${i + 1}/${uniqueArtifactBlocks.length}`);

      try {
        const artifactCode = await extractClaudeArtifact(artifactBlock);
        if (artifactCode) {
          artifacts.push(artifactCode);
          console.log(`Successfully extracted artifact ${i + 1}`);
        } else {
          extractionErrors++;
          console.warn(`Failed to extract artifact ${i + 1}: No content returned`);
        }
      } catch (error) {
        extractionErrors++;
        console.error(`Error extracting artifact ${i + 1}:`, error);
      }

      // small delay between artifacts to prevent overwhelming the UI
      await sleep(100);
    }

    if (extractionErrors > 0) {
      console.warn(
        `Artifact extraction completed with ${extractionErrors} errors out of ${uniqueArtifactBlocks.length} total artifacts`
      );
    } else {
      console.log(`Successfully extracted all ${artifacts.length} artifacts`);
    }

    return artifacts;
  } catch (error) {
    console.error('Critical error in extractAllClaudeArtifacts:', error);
    return artifacts; // return whatever we managed to extract
  }
}
