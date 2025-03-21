import { test } from './extention-fixtures'

// import { defaultOptions } from "../src/options-storage";

test.describe('Chrome Extension Options Page', () => {
  test.beforeEach(async ({ page, extensionId, optionsPage }) => {
    await page.goto(`chrome-extension://${extensionId}/${optionsPage}`)
  })

  // test("should have default input values", async ({ page }) => {
  //   const colorRedInput = page.locator('input[type="number"][name="colorRed"]');
  //   await expect(colorRedInput).toHaveValue(defaultOptions.colorRed.toString());

  //   const colorGreenInput = page.locator(
  //     'input[type="number"][name="colorGreen"]',
  //   );
  //   await expect(colorGreenInput).toHaveValue(
  //     defaultOptions.colorGreen.toString(),
  //   );

  //   const colorBlueInput = page.locator(
  //     'input[type="number"][name="colorBlue"]',
  //   );
  //   await expect(colorBlueInput).toHaveValue(
  //     defaultOptions.colorBlue.toString(),
  //   );

  //   const textInput = page.locator('input[type="text"][name="text"]');
  //   await expect(textInput).toHaveValue(defaultOptions.text);
  // });

  // test("should update input values", async ({ page }) => {
  //   const colorRedInput = page.locator('input[type="number"][name="colorRed"]');
  //   await page.waitForTimeout(1000);
  //   await colorRedInput.fill("0");

  //   const colorGreenInput = page.locator(
  //     'input[type="number"][name="colorGreen"]',
  //   );
  //   await page.waitForTimeout(1000);
  //   await colorGreenInput.fill("0");

  //   const colorBlueInput = page.locator(
  //     'input[type="number"][name="colorBlue"]',
  //   );
  //   await page.waitForTimeout(1000);
  //   await colorBlueInput.fill("0");

  //   const textInput = page.locator('input[type="text"][name="text"]');
  //   await page.waitForTimeout(1000);
  //   await textInput.fill("Test notice content");

  //   // Reload the page to see the changes
  //   await page.reload();

  //   // Check if the values are updated after reloading the page
  //   await expect(colorRedInput).toHaveValue("0");
  //   await expect(colorGreenInput).toHaveValue("0");
  //   await expect(colorBlueInput).toHaveValue("0");
  //   await expect(textInput).toHaveValue("Test notice content");
  // });
})
