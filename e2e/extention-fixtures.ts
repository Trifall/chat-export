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
        // Enable headless mode when running in CI environment, otherwise run with browser UI
        process.env.CI ? `--headless=new` : '',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    })
    await use(context)
    await context.close()
  },
  async extensionId({ context }, use) {
    let [background] = context.serviceWorkers()
    background ||= await context.waitForEvent('serviceworker')

    const extensionId = background.url().split('/')[2]
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
