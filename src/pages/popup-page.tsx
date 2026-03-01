import { useEffect, useState } from 'react';

import browser from 'webextension-polyfill';

import optionsStorage, { ExportType } from '@/options-storage';
import '@/styles/global.css';

interface ChatContentResult {
  format: string;
  content: string;
  messageCount: number;
  failedMessages: number;
}

export default function PopupPage() {
  const [exportType, setExportType] = useState<ExportType>('markdown');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      if (options.exportType) {
        setExportType(options.exportType as ExportType);
      }
    });
  }, []);

  const handleExportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ExportType;
    setExportType(value);
    optionsStorage.set({ exportType: value });
  };

  const getChatContentFromActiveTab = async (): Promise<ChatContentResult | null> => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        alert('No active tab found');
        return null;
      }

      const response = (await browser.tabs.sendMessage(tabs[0].id, {
        type: 'GET_CHAT_CONTENT',
      })) as { success: boolean; data?: ChatContentResult; error?: string };

      if (response && response.success && response.data) {
        return response.data;
      } else {
        alert(`Failed to get chat content: ${response?.error || 'Unknown error'}`);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(
        `Could not access the page. Make sure you're on a supported chat page (Claude, ChatGPT, or Gemini). Error: ${errorMessage}`
      );
      return null;
    }
  };

  const handleCopyToClipboard = async () => {
    setIsLoading(true);
    setStatus('Copying...');

    const chatContent = await getChatContentFromActiveTab();
    if (chatContent) {
      try {
        await navigator.clipboard.writeText(chatContent.content);
        setStatus(
          `Copied! ${chatContent.messageCount} messages, ${chatContent.content.length.toLocaleString()} chars`
        );
        setTimeout(() => setStatus(''), 3000);
      } catch (error) {
        console.log(`Failed to copy to clipboard: ${error}`);
        setStatus('Failed to copy to clipboard');
      }
    }
    setIsLoading(false);
  };

  const handleSaveToFile = async () => {
    setIsLoading(true);
    setStatus('Saving...');

    const chatContent = await getChatContentFromActiveTab();
    if (chatContent) {
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

      const blob = new Blob([chatContent.content], {
        type: mimeTypes[chatContent.format] || 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${new Date().toISOString().split('T')[0]}.${extensions[chatContent.format] || 'txt'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus(`Saved! ${chatContent.messageCount} messages`);
      setTimeout(() => setStatus(''), 3000);
    }
    setIsLoading(false);
  };

  return (
    <div id="root" className="min-h-screen !bg-zinc-950 text-zinc-100">
      <div id="container" className="container mx-auto max-w-2xl p-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Chat Export</h1>
          <p className="text-sm text-zinc-400">Export your chat from any supported page.</p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={handleCopyToClipboard}
              disabled={isLoading}
              className="flex-1 rounded-md bg-zinc-800 px-4 py-2 font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleSaveToFile}
              disabled={isLoading}
              className="flex-1 rounded-md bg-zinc-800 px-4 py-2 font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Save to File'}
            </button>
          </div>

          {status && <p className="text-center text-sm text-zinc-400">{status}</p>}

          <div className="space-y-2 border-t border-zinc-800 pt-2">
            <label htmlFor="export-type" className="text-sm text-zinc-400">
              Export format
            </label>
            <select
              id="export-type"
              value={exportType}
              onChange={handleExportTypeChange}
              className="flex h-9 w-[180px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="markdown">Markdown</option>
              <option value="xml">XML</option>
              <option value="json">JSON</option>
              <option value="html">HTML</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
