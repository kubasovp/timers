import { expect, test } from "@playwright/test";

test("custom timer smoke", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Title").fill("Smoke");
  await page.getByLabel("Minutes").fill("0");
  await page.getByLabel("Seconds").fill("3");
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText("Smoke")).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("paused")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("running")).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("No active timers.")).toBeVisible();
});
