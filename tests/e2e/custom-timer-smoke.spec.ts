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
