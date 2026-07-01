import { expect, test } from "@playwright/test";

test("custom timer smoke", async ({ page }) => {
  await page.goto("/");
  const timers = page.locator('section[aria-label="Timers"]');

  await timers.getByLabel("Title").fill("Smoke");
  await timers.getByLabel("Minutes").fill("0");
  await timers.getByLabel("Seconds").fill("3");
  await timers.getByRole("button", { name: "Start" }).click();

  await expect(timers.getByText("Smoke")).toBeVisible();
  await timers.getByRole("button", { name: "Pause" }).click();
  await expect(timers.getByText("paused")).toBeVisible();
  await timers.getByRole("button", { name: "Resume" }).click();
  await expect(timers.getByText("running")).toBeVisible();
  await timers.getByRole("button", { name: "Stop" }).click();
  await expect(timers.getByText("No active timers.")).toBeVisible();
});

test("completed custom timers can run again and be deleted", async ({ page }) => {
  await page.goto("/");
  const timers = page.locator('section[aria-label="Timers"]');
  const activeTimers = timers.locator('[aria-label="Active timers"]');

  await timers.getByLabel("Title").fill("Reuse");
  await timers.getByLabel("Minutes").fill("0");
  await timers.getByLabel("Seconds").fill("1");
  await timers.getByRole("button", { name: "Start" }).click();

  const completedTimers = timers.locator('[aria-label="Completed timers"]');
  await expect(completedTimers.getByText("Reuse")).toBeVisible({ timeout: 5000 });
  await expect(timers.getByText("No active timers.")).toBeVisible();

  await completedTimers.getByRole("button", { name: "Run again" }).click();
  await expect(activeTimers.getByText("Reuse")).toBeVisible();
  await expect(timers.getByText("No completed timers.")).toBeVisible();

  await activeTimers.getByRole("button", { name: "Stop" }).click();
  await expect(completedTimers.getByText("Reuse")).toBeVisible();
  await expect(completedTimers.getByText("Reuse")).toHaveCount(1);

  await completedTimers.getByRole("button", { name: "Run again" }).click();
  await expect(activeTimers.getByText("Reuse")).toBeVisible();
  await expect(timers.getByText("No completed timers.")).toBeVisible();

  await expect(completedTimers.getByText("Reuse")).toBeVisible({ timeout: 5000 });
  await expect(completedTimers.getByText("Reuse")).toHaveCount(1);

  await completedTimers.getByRole("button", { name: "Delete" }).click();
  await expect(timers.getByText("No completed timers.")).toBeVisible();
});

test("focus smoke", async ({ page }) => {
  await page.goto("/");
  const focus = page.locator('section[aria-label="Focus"]');

  await focus.locator(".focus-start").getByRole("button", { name: "Start" }).click();
  await expect(focus.getByText("running_focus")).toBeVisible();
  await focus.getByRole("button", { name: "Pause" }).click();
  await expect(focus.getByText("paused_focus")).toBeVisible();
  await focus.getByRole("button", { name: "Resume" }).click();
  await expect(focus.getByText("running_focus")).toBeVisible();
  await focus.getByRole("button", { name: "Skip phase" }).click();
  await expect(focus.getByText("running_break")).toBeVisible();
  await focus.getByRole("button", { name: "Skip break" }).click();
  await expect(focus.getByText("running_focus")).toBeVisible();
  await focus.getByRole("button", { name: "Stop session" }).click();
  await expect(focus.locator(".focus-start")).toBeVisible();
});
