import { CHATGPT_URLS, CLAUDE_URLS, GEMINI_URLS } from './constants';
import { Site } from './types';

export function detectSite(): Site {
  const url = window.location.href;
  if (CHATGPT_URLS.some((u) => url.includes(u))) {
    return 'chatgpt';
  }
  if (CLAUDE_URLS.some((u) => url.includes(u))) {
    return 'claude';
  }
  if (GEMINI_URLS.some((u) => url.includes(u))) {
    return 'gemini';
  }
  throw new Error('Unsupported site');
}
