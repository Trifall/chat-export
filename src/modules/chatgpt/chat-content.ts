import { formatImageInput } from '@/modules/content-handlers';
import { extractFormattedText } from '@/modules/content-handlers';
import { Message } from '@/modules/types';

export const getChatGPTChatContent = async () => {
  // get all conversation turns
  const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');

  let failedChatgptMessages = 0;
  const chatgptMessages: Array<Message> = [];

  // process each turn individually
  for (const turn of turns) {
    const messageDiv = turn.querySelector('[data-message-author-role]');
    if (!messageDiv) {
      failedChatgptMessages++;
      continue;
    }

    const role = messageDiv.getAttribute('data-message-author-role');
    if (!role) {
      failedChatgptMessages++;
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
        const sourceContainers = Array.from(contentClone.querySelectorAll('div')).filter((div) => {
          // find buttons with sources text
          const hasSourcesButton = Array.from(div.querySelectorAll('button')).some((button) =>
            button.textContent?.includes('Sources')
          );
          // find divs that contain favicon images
          const hasFaviconImages = Array.from(div.querySelectorAll('img')).some((img) =>
            img.src.includes('google.com/s2/favicons')
          );

          return hasSourcesButton || hasFaviconImages;
        });

        sourceContainers.forEach((container) => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        });

        const extractedText = await extractFormattedText(contentClone);
        content += extractedText;
      }

      if (content.trim()) {
        chatgptMessages.push({ role, content });
      } else {
        failedChatgptMessages++;
      }
    } catch (error) {
      console.error('Failed to extract message content:', error);
      failedChatgptMessages++;
    }
  }

  return { chatgptMessages, failedChatgptMessages };
};
