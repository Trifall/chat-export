import { getChatContent } from '@/modules/chat-content';

function downloadFile(content: string, format: string): string {
  const mimeTypes: { [key: string]: string } = {
    markdown: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
  };

  const extensions: { [key: string]: string } = {
    markdown: 'md',
    json: 'json',
    xml: 'xml',
    html: 'html',
  };

  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${new Date().toISOString().split('T')[0]}.${extensions[format] || 'txt'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return a.download;
}

export async function copyToClipboard() {
  const { format, content, messageCount, failedMessages } = await getChatContent(false);

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  const stats = `Stats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters${failedText}`;
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    // Clipboard needs a focused page; a long export easily outlives focus.
    // Fall back to a download so the extracted content is never lost.
    const filename = downloadFile(content, format);
    alert(
      `⚠️ Clipboard unavailable (page lost focus?) — saved to file instead.\n\n${stats}\n📁 Filename: ${filename}`
    );
    return;
  }
  alert(`✅ Chat copied to clipboard successfully!\n\n${stats}`);
}

export async function saveToFile() {
  const { format, content, messageCount, failedMessages } = await getChatContent(true);
  const filename = downloadFile(content, format);

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  alert(
    `💾 Chat saved to file successfully!\n\nStats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters\n📄 Format: ${format.toUpperCase()}\n📁 Filename: ${filename}${failedText}`
  );
}
