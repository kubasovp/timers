import { expect, test } from "@playwright/test";

test("suppresses the browser default context menu", async ({ page }) => {
  await page.goto("/");

  const wasCancelled = await page.evaluate(() => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2
    });

    return !document.dispatchEvent(event);
  });

  expect(wasCancelled).toBe(true);
});
