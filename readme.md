# Chat Export Extension (LLM)

[link-cws-keys]: https://github.com/fregante/chrome-webstore-upload-keys
[link-amo-keys]: https://addons.mozilla.org/en-US/developers/addon/api/key

[![Test](https://github.com/Trifall/chat-export/actions/workflows/test.yml/badge.svg)](https://github.com/Trifall/chat-export/actions/workflows/test.yml)

This extension allows you to export chat conversations from ChatGPT, and Claude to Markdown, XML, JSON, and HTML.

The export button is placed next to the share button.

I made this extension in my free time over a couple days because I wanted this feature and also [this tweet](https://x.com/tylerangert/status/1902038162836246550). Might be scuffed on edge cases but I tried my best.

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
- A lot more links in my [Awesome WebExtensions](https://github.com/fregante/Awesome-WebExtensions) list

### Publishing

It's possible to automatically publish to both the Chrome Web Store and Mozilla Addons at once by adding these secrets on GitHub Actions:

1. `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN` from [Google APIs][link-cws-keys].
2. `WEB_EXT_API_KEY`, and `WEB_EXT_API_SECRET` from [AMO][link-amo-keys].

Also include `EXTENSION_ID` in the secrets ([how to find it](https://stackoverflow.com/a/8946415/288906)) and add Mozilla’s [`gecko.id`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) to `manifest.json`.

The GitHub Actions workflow will:

1. Build the extension
2. Create a version number based on the current UTC date time, like [`19.6.16`](https://github.com/fregante/daily-version-action) and sets it in the manifest.json
3. Deploy it to both stores

#### Auto-publishing

Thanks to the included [GitHub Action Workflows](.github/workflows), if you set up those secrets in the repo's Settings, the deployment will automatically happen:

- on a schedule, by default [every week](.github/workflows/release.yml) (but only if there are any new commits in the last tag)
- manually, by clicking ["Run workflow"](https://github.blog/changelog/2020-07-06-github-actions-manual-triggers-with-workflow_dispatch/) in the Actions tab.

## Credits

[See template](https://github.com/sotayamashita/browser-extension-template).

## License

MIT
