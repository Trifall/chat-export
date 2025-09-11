import { getChatContent } from '@/modules/chat-content';

export async function copyToClipboard() {
  const { content, messageCount, failedMessages } = await getChatContent(false);
  await navigator.clipboard.writeText(content);

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  alert(
    `✅ Chat copied to clipboard successfully!\n\nStats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters${failedText}`
  );
}

export async function saveToFile() {
  const { format, content, messageCount, failedMessages } = await getChatContent(true);
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

  const failedText = failedMessages > 0 ? `\n⚠️ Failed messages: ${failedMessages}` : '';
  alert(
    `💾 Chat saved to file successfully!\n\nStats:\n📝 Total messages: ${messageCount}\n📏 Total length: ${content.length.toLocaleString()} characters\n📄 Format: ${format.toUpperCase()}\n📁 Filename: ${a.download}${failedText}`
  );
}
