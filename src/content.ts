import browser from "webextension-polyfill";
import optionsStorage from "./options-storage";

console.log("💈 Content script loaded for", browser.runtime.getManifest().name);

function createExportButton(): HTMLElement {
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "relative";

  const button = document.createElement("button");
  button.className = "btn relative btn-secondary text-token-text-primary";
  button.setAttribute("aria-label", "Export");
  button.setAttribute("data-testid", "export-chat-button");

  const buttonContent = document.createElement("div");
  buttonContent.className = "flex w-full items-center justify-center gap-1.5";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("viewBox", "0 0 20 20");
  icon.setAttribute("fill", "none");
  icon.classList.add("icon-sm");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 17h14v-6h2v8H1v-8h2v6zm7-7V2h4l-5-5-5 5h4v8z");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  icon.appendChild(path);
  buttonContent.appendChild(icon);
  buttonContent.appendChild(document.createTextNode("Export"));
  button.appendChild(buttonContent);
  buttonContainer.appendChild(button);

  // make dropdown
  const dropdown = document.createElement("div");
  dropdown.className =
    "absolute hidden bg-zinc-900 rounded-md shadow-lg mt-3 py-2 w-48 z-50 text-zinc-100";
  dropdown.style.top = "100%";
  dropdown.style.left = "0";

  const options = [
    { text: "Copy to Clipboard", action: copyToClipboard },
    { text: "Save to File", action: saveToFile },
  ];

  options.forEach((option, index) => {
    const item = document.createElement("button");
    item.className =
      "w-full text-left px-4 py-3 hover:bg-zinc-800 text-zinc-100";
    item.textContent = option.text;
    item.onclick = option.action;
    if (index > 0) {
      item.style.marginTop = "4px";
    }
    dropdown.appendChild(item);
  });

  buttonContainer.appendChild(dropdown);

  // toggle dropdown
  button.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  };

  // close dropdown when clicking outside
  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
  });

  return buttonContainer;
}

async function formatContent(
  messages: Array<{ role: string; content: string }>,
  format: string,
): Promise<string> {
  switch (format) {
    case "markdown":
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === "assistant" ? "Assistant" : "User"}\n\n${content}\n\n`,
        )
        .join("");

    case "json":
      return JSON.stringify(
        {
          messages: messages.map(({ role, content }) => ({
            role: role === "assistant" ? "assistant" : "user",
            content,
          })),
        },
        null,
        2,
      );

    case "xml":
      return `<?xml version="1.0" encoding="UTF-8"?>\n<conversation>\n${messages
        .map(
          ({ role, content }) =>
            `  <message role="${role === "assistant" ? "assistant" : "user"}">\n    <content>${content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;")}</content>\n  </message>`,
        )
        .join("\n")}\n</conversation>`;

    case "html":
      return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Chat Export</title>\n  <style>\n    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }\n    .message { margin-bottom: 2rem; }\n    .role { font-weight: bold; margin-bottom: 0.5rem; }\n    .content { white-space: pre-wrap; }\n  </style>\n</head>\n<body>\n${messages
        .map(
          ({ role, content }) =>
            `  <div class="message">\n    <div class="role">${role === "assistant" ? "Assistant" : "User"}</div>\n    <div class="content">${content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;")}</div>\n  </div>`,
        )
        .join("\n")}\n</body>\n</html>`;

    default:
      return messages
        .map(
          ({ role, content }) =>
            `### ${role === "assistant" ? "Assistant" : "User"}\n\n${content}\n\n`,
        )
        .join("");
  }
}

async function getChatContent(): Promise<{ format: string; content: string }> {
  const turns = document.querySelectorAll(
    '[data-testid^="conversation-turn-"]',
  );
  const messages: Array<{ role: string; content: string }> = [];
  const originalClipboard = await navigator.clipboard.readText();

  for (const turn of turns) {
    const messageDiv = turn.querySelector("[data-message-author-role]");
    if (!messageDiv) continue;

    const role = messageDiv.getAttribute("data-message-author-role");
    const copyButton = turn.querySelector(
      '[data-testid="copy-turn-action-button"]',
    ) as HTMLButtonElement;

    if (copyButton && role) {
      copyButton.click();
      // wait for clipboard to be updated
      await new Promise((resolve) => setTimeout(resolve, 100));
      const content = await navigator.clipboard.readText();
      messages.push({ role, content });
    }
  }

  // restore original clipboard content
  await navigator.clipboard.writeText(originalClipboard);

  // get user's preferred format
  const options = await optionsStorage.getAll();
  const format = options.exportType || "markdown";

  const formattedContent = await formatContent(messages, format);
  return { format, content: formattedContent };
}

async function copyToClipboard() {
  const { content } = await getChatContent();
  await navigator.clipboard.writeText(content);
}

async function saveToFile() {
  const { format, content } = await getChatContent();
  const mimeTypes: { [key: string]: string } = {
    markdown: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
  };

  const extensions: { [key: string]: string } = {
    markdown: "md",
    json: "json",
    xml: "xml",
    html: "html",
  };

  const blob = new Blob([content], { type: mimeTypes[format] || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-export-${new Date().toISOString().split("T")[0]}.${extensions[format] || "txt"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function init() {
  // mutation observer for share button
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        const shareButton = document.querySelector(
          '[data-testid="share-chat-button"]',
        );
        if (
          shareButton &&
          !document.querySelector('[data-testid="export-chat-button"]')
        ) {
          const exportButton = createExportButton();
          shareButton.parentElement?.insertBefore(exportButton, shareButton);
        }
      }
    });
  });

  // start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

init();
