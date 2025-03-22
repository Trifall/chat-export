import { type BrowserContext, test as base, chromium } from '@playwright/test'

import fs from 'node:fs'
import path from 'node:path'

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
  optionsPage: string
}>({
  // eslint-disable-next-line no-empty-pattern
  async context({}, use) {
    const pathToExtension = path.join(__dirname, '../dist')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        process.env.CI ? `--headless=new` : '',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    })
    await use(context)
    await context.close()
  },
  async extensionId({ context }, use) {
    // Navigate to the extensions page
    const page = await context.newPage()
    await page.goto('chrome://extensions/')

    // Get the extension ID from the extensions page
    const extensionId = await page.evaluate(() => {
      const extensions = document
        .querySelector('extensions-manager')
        ?.shadowRoot?.querySelector('extensions-item-list')
        ?.shadowRoot?.querySelectorAll('extensions-item')

      if (!extensions?.length) return null

      // Get the first (and should be only) extension's ID
      const extensionItem = extensions[0]
      return extensionItem.getAttribute('id')
    })

    if (!extensionId) {
      throw new Error('Could not find extension ID')
    }

    await page.close()
    await use(extensionId)
  },
  // eslint-disable-next-line no-empty-pattern
  async optionsPage({}, use) {
    const distDir = path.join(__dirname, '../dist')
    const files = fs.readdirSync(distDir)
    const optionsFile = files.find((file) => file.startsWith('options.') && file.endsWith('.html'))
    if (!optionsFile) {
      throw new Error('Options page not found in dist directory')
    }

    await use(optionsFile)
  },
})

export const expect = test.expect
