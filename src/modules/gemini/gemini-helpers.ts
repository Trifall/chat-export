import { extractFormattedText } from '@/modules/content-handlers';
import { Message } from '@/modules/types';

export async function closeExistingOverlays() {
  const existingBackdrop = document.querySelector('.cdk-overlay-backdrop');
  if (existingBackdrop) {
    (existingBackdrop as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function performTurnScroll(turn: Element) {
  //scroll to bottom of turn, then to top to ensure all content loads
  const turnRect = turn.getBoundingClientRect();
  const turnBottom = turnRect.bottom + window.scrollY;

  window.scrollTo({
    top: turnBottom - window.innerHeight + 100, // scroll so bottom of turn is visible
    behavior: 'smooth',
  });

  await new Promise((resolve) => setTimeout(resolve, 800)); // wait for bottom content to load

  // scroll to the top/start of the turn
  turn.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });

  await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for content to load and scrolling to complete
}

export function extractRoleFromTurn(turn: Element) {
  const container = turn.querySelector('.chat-turn-container');
  if (!container) {
    return { role: null, container: null };
  }

  const role = container.classList.contains('user') ? 'user' : 'assistant';
  return { role, container };
}

export async function handleThinkingMessage(
  turn: Element,
  role: string,
  messages: Message[]
): Promise<boolean> {
  const isThinkingMessage = turn.querySelector('ms-thought-chunk') !== null;
  if (!isThinkingMessage) return false;

  const thoughtChunk = turn.querySelector('ms-thought-chunk');
  if (thoughtChunk) {
    let content = await extractFormattedText(thoughtChunk as Element);

    // filter out UI artifacts from thinking messages
    content = content
      .replace(/Expand to view model thoughts/gi, '')
      .replace(/chevron_right/gi, '')
      .replace(/Thoughts\(experimental\)Auto/gi, '')
      .replace(/\n\s*\n\s*\n/gi, '\n\n') // remove blank lines
      .trim();

    if (content) {
      content = `*Thinking Output*\n\n${content}`;
      messages.push({ role, content });
    }
  }
  return true;
}

export async function findTextareaByScroll(turn: Element): Promise<Element | null> {
  let textareaElement: Element | null = null;
  const maxRetries = 50; // 50 * 100ms = 5 seconds
  let retryCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 20;
  let originalScrollPosition: number | null = null;

  while (!textareaElement && retryCount < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    textareaElement = turn.querySelector('ms-autosize-textarea[data-value]');
    retryCount++;

    // if textarea not found after 2 seconds, start bidirectional scrolling
    if (!textareaElement && retryCount > 20 && scrollAttempts < maxScrollAttempts) {
      // find the main scrollable container in aistudio
      const scrollContainer =
        document.querySelector('ms-autoscroll-container') ||
        document.querySelector('ms-prompt-scrollbar') ||
        document.querySelector('ms-app main') ||
        document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.documentElement;

      // store original position on first scroll attempt
      if (scrollAttempts === 0 && scrollContainer) {
        originalScrollPosition = scrollContainer.scrollTop || window.scrollY;
      }

      const halfwayPoint = Math.floor(maxScrollAttempts / 2); // 10 attempts
      const scrollAmount = 200 + (scrollAttempts % halfwayPoint) * 200;

      // first half: scroll up, second half: scroll down
      if (scrollAttempts < halfwayPoint) {
        if (scrollContainer && scrollContainer.scrollTop !== undefined) {
          scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - scrollAmount);
        } else {
          window.scrollBy(0, -scrollAmount);
        }
      } else if (scrollAttempts === halfwayPoint) {
        // reset to original position before scrolling down
        if (scrollContainer && originalScrollPosition !== null) {
          scrollContainer.scrollTop = originalScrollPosition;
        } else if (originalScrollPosition !== null) {
          window.scrollTo(0, originalScrollPosition);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        if (scrollContainer && scrollContainer.scrollTop !== undefined) {
          scrollContainer.scrollTop = scrollContainer.scrollTop + scrollAmount;
        } else {
          window.scrollBy(0, scrollAmount);
        }
      }

      scrollAttempts++;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (textareaElement) {
    // ensure textarea is properly in view
    textareaElement.scrollIntoView({
      behavior: 'instant',
      block: 'center',
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return textareaElement;
}

export async function exitEditMode(turn: Element) {
  // click the "done editing" button to exit edit mode
  const doneEditingButton =
    turn.querySelector('button[aria-label="Stop editing"]') ||
    turn.querySelector('button[aria-label="Done editing"]') ||
    turn.querySelector('.done-editing-button, .edit-done-button');

  if (doneEditingButton) {
    (doneEditingButton as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  } else {
    // try pressing escape key as fallback
    const textareaInput = turn.querySelector('textarea, input');
    if (textareaInput) {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
      textareaInput.dispatchEvent(escapeEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

export async function extractContentViaEditMode(turn: Element): Promise<string | null> {
  const editButton = turn.querySelector('.toggle-edit-button, button[aria-label="Edit"]');
  if (!editButton) {
    return null;
  }

  // click the edit button to morph message into editable textarea
  (editButton as HTMLElement).click();

  // wait for textarea to appear with scroll search
  const textareaElement = await findTextareaByScroll(turn);

  if (!textareaElement) {
    // try to exit edit mode if stuck in it
    const cancelButton = turn.querySelector(
      'button[aria-label="Cancel editing"], button[aria-label="Stop editing"]'
    );
    if (cancelButton) {
      (cancelButton as HTMLElement).click();
    }
    return null;
  }

  // extract content from data-value attribute
  const content = textareaElement.getAttribute('data-value') || '';

  await exitEditMode(turn);
  return content;
}
