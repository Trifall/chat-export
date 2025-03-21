import { expect } from '@playwright/test'

import { test } from './extention-fixtures'

test.describe('Chrome Extension Options Page', () => {
  test.beforeEach(async ({ page, extensionId, optionsPage }) => {
    await page.goto(`chrome-extension://${extensionId}/${optionsPage}`)
  })

  test('should be able to change the value of the select menu', async ({ page }) => {
    const select = page.locator('select#export-type')
    await select.selectOption('xml')
    await expect(select).toHaveValue('xml')
    await select.selectOption('html')
    await expect(select).toHaveValue('html')
    await select.selectOption('json')
    await expect(select).toHaveValue('json')
    await select.selectOption('markdown')
    await expect(select).toHaveValue('markdown')
  })

  test('should store the selected value to storage', async ({ page }) => {
    const select = page.locator('select#export-type')

    // change to XML
    await select.selectOption('xml')
    await expect(select).toHaveValue('xml')

    // wait for the change to take effect
    await page.waitForTimeout(500)

    // reload the page to verify that the value was saved
    await page.reload()
    await page.waitForSelector('select#export-type')
    await expect(select).toHaveValue('xml')

    // change to HTML
    await select.selectOption('html')
    await expect(select).toHaveValue('html')
    await page.waitForTimeout(500)

    // reload the page again to verify the new value was saved
    await page.reload()
    await page.waitForSelector('select#export-type')
    await expect(select).toHaveValue('html')
  })
})
