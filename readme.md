# browser-extension-template

[link-options-sync]: https://github.com/fregante/webext-options-sync
[link-cws-keys]: https://github.com/fregante/chrome-webstore-upload-keys
[link-amo-keys]: https://addons.mozilla.org/en-US/developers/addon/api/key

[![Test](https://github.com/sotayamashita/browser-extension-template/actions/workflows/test.yml/badge.svg)](https://github.com/sotayamashita/browser-extension-template/actions/workflows/test.yml) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fsotayamashita%2Fbrowser-extension-template.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fsotayamashita%2Fbrowser-extension-template?ref=badge_shield&issueType=license) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> Cross-browser extension boilerplate - barebones template with Parcel 2, options handler and auto-publishing.

Screenshot of extension options:

<img src="media/previewer.png" alt="Sample extension options output" width="500" />

## Features

- Uses Manifest v3
- Use npm dependencies thanks to Parcel 2.
- [Auto-syncing options](#auto-syncing-options).
- [Auto-publishing](#publishing) with auto-versioning and support for manual releases.

### Diff from the original [`fregante/browser-extension-template`](https://github.com/fregante/browser-extension-template)

```diff
- xo
- stylelint
+ React
+ TypeScript
+ with Prettier / Husky / lint-staged for linting
+ with Playwright for E2E tests
+ with Shadcn/UI and TailwindCSS for UI Components
```

Related PRs:

- Remove xo, eslint, and stylelint [#5](https://github.com/sotayamashita/browser-extension-template/pull/5)
- Add Prettier, husky and lint-staged [#8](https://github.com/sotayamashita/browser-extension-template/pull/8)
- Add Playwright for E2E tests [#11](https://github.com/sotayamashita/browser-extension-template/pull/11)
- Add TypeScript [#17](https://github.com/sotayamashita/browser-extension-template/pull/17)
- Add React [#18](https://github.com/sotayamashita/browser-extension-template/pull/18)
- Add shadcn/ui with tailwind [#21](https://github.com/sotayamashita/browser-extension-template/pull/21)

## Getting started

### 1️⃣ Create your own copy

1. Click [<kbd>Use this template</kbd>](https://github.com/fregante/browser-extension-template/generate) to make a copy of your own. 😉

Note: When you create a repository from the template, the [Template Cleanup](.github/workflows/template-cleanup.yml) workflow will be triggered to delete and edit template-specific resources. Wait a moment until the workflow finishes (you will see a commit pushed with 'Template cleanup' message).

### 🛠 Build locally

1. Checkout the copied repository to your local machine eg. with `git clone https://github.com/my-username/my-awesome-extension/`
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

### ✏️ Make the first change

1. For example, edit source\manifest.json to `"name": "My Awesome Extension",`
1. Go back to your browser, reload and see the change take effect

Note: Firefox will automatically reload content scripts when the extension is updated, Chrome requires you to reload the page to reload the content scripts.

### 📕 Read the documentation

Here are some websites you should refer to:

- [Parcel’s Web Extension transformer documentation](https://parceljs.org/recipes/web-extension/)
- [Chrome extensions’ API list](https://developer.chrome.com/docs/extensions/reference/)
- A lot more links in my [Awesome WebExtensions](https://github.com/fregante/Awesome-WebExtensions) list

## Configuration

The extension doesn't target any specific ECMAScript environment or provide any transpiling by default. The extensions output will be the same ECMAScript you write. This allows us to always target the latest browser version, which is a good practice you should be following.

### Parcel 2

Being based on Parcel 2 and its [WebExtension transformer](https://parceljs.org/recipes/web-extension/), you get all the good parts:

- Browserlist-based code transpiling (which defaults to just the latest Chrome and Firefox versions)
- Automatically picks up any new file specified in `manifest.json`

### Auto-syncing options

Options are managed by [fregante/webext-options-sync][link-options-sync], which auto-saves and auto-restores the options form, applies defaults and runs migrations.

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

Extension icon made by [Freepik](https://www.freepik.com) from [www.flaticon.com](https://www.flaticon.com) is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0).

## Extensions created using this template

- [notlmn/copy-as-markdown](https://github.com/notlmn/copy-as-markdown) - Browser extension to copy hyperlinks, images, and selected text as Markdown.

## License

This browser extension template is released under [CC0](#license) and mentioned below. There is no `license` file included in here, but when you clone this template, you should include your own license file for the specific license you choose to use.

[![CC0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](https://creativecommons.org/publicdomain/zero/1.0/)
