import { expect, test } from "@playwright/test";

test("active custom timer survives app reload", async ({ page }) => {
  await page.goto("/");
  const timers = page.locator('section[aria-label="Timers"]');
  const activeTimers = timers.locator('[aria-label="Active timers"]');

  await timers.getByLabel("Title").fill("Recover timer");
  await timers.getByLabel("Minutes").fill("3");
  await timers.getByLabel("Seconds").fill("0");
  await timers.getByRole("button", { name: "Start" }).click();

  await expect(activeTimers.getByText("Recover timer")).toBeVisible();
  await page.reload();

  await expect(activeTimers.getByText("Recover timer")).toBeVisible();
  await expect(activeTimers.getByText("running")).toBeVisible();

  await activeTimers.getByRole("button", { name: "Stop" }).click();
  await expect(timers.getByText("No active timers.")).toBeVisible();
});

test("active focus session survives app reload", async ({ page }) => {
  await page.goto("/");
  const focus = page.locator('section[aria-label="Focus"]');

  await focus.locator(".focus-start").getByRole("button", { name: "Start" }).click();
  await expect(focus.getByText("running_focus")).toBeVisible();

  await page.reload();

  await expect(focus.getByText("running_focus")).toBeVisible();
  await focus.getByRole("button", { name: "Stop session" }).click();
  await expect(focus.locator(".focus-start")).toBeVisible();
});
