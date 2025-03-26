# Chat Export Extension (LLM)

[![Test](https://github.com/Trifall/chat-export/actions/workflows/test.yml/badge.svg)](https://github.com/Trifall/chat-export/actions/workflows/test.yml)

<p align="center">
<a href="https://addons.mozilla.org/en-US/firefox/addon/chat-export/"><img src="https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png" alt="Get Chat Export for Firefox"></a>
<a href="https://chromewebstore.google.com/detail/chat-export/nkdibdcomniocannnkofanbikghkpbgl"><img src="https://user-images.githubusercontent.com/585534/107280622-91a8ea80-6a26-11eb-8d07-77c548b28665.png" alt="Get Chat Export for Chromium"></a>
</p>

***


This extension allows you to export chat conversations from ChatGPT, and Claude to Markdown, XML, JSON, and HTML.

The export button is placed next to the share button.

I made this extension in my free time over a couple days because I wanted this feature and also [this tweet](https://x.com/tylerangert/status/1902038162836246550). Might be scuffed on edge cases but I tried my best.

This extension does **NOT** store, upload, or share any data remotely. It does **NOT** store any personal or private/identifiable data. All content is stored on the local machine and the local users's clipboard. Only stores the configuration for the output format (string enum [markdown, html, xml, json] for ease-of-use.

![Export Video Example](https://github.com/user-attachments/assets/2705e502-9e1f-41a8-88e9-3b41242d6c0f)

Extension Settings:

![Extension Settings](https://github.com/user-attachments/assets/7a3f11bc-66af-48c6-89ce-2619fd0c34e0)

Claude Button:

![Claude Export Button](https://github.com/user-attachments/assets/d2f604bb-f563-4e0c-89a1-276804be1de4)

ChatGPT Button:

![ChatGPT Export Button](https://github.com/user-attachments/assets/9a030781-4e8d-47a0-87b2-c15461f08ce4)

## Getting started

<!--
### Install from Browser Store

- Firefox: [https://addons.mozilla.org/en-US/firefox/addon/chat-export/](https://addons.mozilla.org/en-US/firefox/addon/chat-export/)
- Chrome: [https://chrome.google.com/webstore/detail/chat-export](https://chrome.google.com/webstore/detail/chat-export) -->

### 🛠 Build locally

1. Checkout the copied repository to your local machine eg. with `git clone https://github.com/Trifall/chat-export`
1. Run `npm install` to install all required dependencies
1. Run `npm run build`

The build step will create the `dist` folder, this folder will contain the generated extension.

### 🏃 Run the extension

Using [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) is recommended for automatic reloading and running in a dedicated browser instance. Alternatively you can load the extension manually (see below).

1. Run `npm run watch` to watch for file changes and build continuously
1. Run `npm install --global web-ext` (only only for the first time)
1. In another terminal, run `web-ext run -t chromium`
1. Check that the extension is loaded by opening the extension options ([in Firefox](media/extension_options_firefox.png) or [in Chrome](media/extension_options_chrome.png)).

#### Manually

You can also [load the extension manually in Chrome](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#google-chrome-opera-vivaldi) or [Firefox](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#mozilla-firefox).

### ✏️ Make changes

Firefox will automatically reload content scripts when the extension is updated, Chrome requires you to reload the page to reload the content scripts.

### 📕 Read the documentation

Here are some websites you should refer to:

- [Parcel’s Web Extension transformer documentation](https://parceljs.org/recipes/web-extension/)
- [Chrome extensions’ API list](https://developer.chrome.com/docs/extensions/reference/)
- A lot more links in Fregante's [Awesome WebExtensions](https://github.com/fregante/Awesome-WebExtensions) list

## Credits

[See template](https://github.com/sotayamashita/browser-extension-template).

## License

MIT
