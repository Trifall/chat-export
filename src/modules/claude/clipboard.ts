export async function readClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

export async function waitForClipboardChange(previous: string, timeout: number): Promise<string> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const text = await readClipboardText();
    if (text && text !== previous) return text;
    if (Date.now() >= deadline) return '';
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
