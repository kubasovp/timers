import { expect, test, type Locator } from "@playwright/test";

test("one-time reminder smoke", async ({ page }) => {
  await page.goto("/");
  const reminders = page.locator('section[aria-label="Reminders"]');

  await createReminder(reminders, "Check build", new Date(Date.now() + 5 * 60_000));
  await expect(reminders.getByText("Check build")).toBeVisible();
  await reminders.getByRole("button", { name: "Disable" }).click();
  await expectStatus(reminders, "disabled");
  await reminders.getByRole("button", { name: "Enable" }).click();
  await expect(reminders.locator(".timer-meta").getByText(/in \d/)).toBeVisible();
  await reminders.getByRole("button", { name: "Delete" }).click();
  await expect(reminders.getByText("No reminders.")).toBeVisible();

  await createReminder(reminders, "Take meds", new Date(Date.now() - 60_000), "After lunch");
  await expect(reminders.getByText("Take meds")).toBeVisible();
  await expectStatus(reminders, "due", 4000);
  await reminders.getByRole("button", { name: "Done" }).click();
  await expectStatus(reminders, "done");
  await reminders.getByRole("button", { name: "Delete" }).click();
  await expect(reminders.getByText("No reminders.")).toBeVisible();

  await createReminder(reminders, "Stretch", new Date(Date.now() - 60_000));
  await expect(reminders.getByText("Stretch")).toBeVisible();
  await expectStatus(reminders, "due", 4000);
  await reminders.getByRole("button", { name: "Snooze 5m" }).click();
  await expect(reminders.getByText(/snoozed until/)).toBeVisible();
  await reminders.getByRole("button", { name: "Delete" }).click();
  await expect(reminders.getByText("No reminders.")).toBeVisible();
});

async function createReminder(
  reminders: Locator,
  title: string,
  fireAt: Date,
  message = ""
): Promise<void> {
  await reminders.getByLabel("Title").fill(title);
  await reminders.getByLabel("Message").fill(message);
  await reminders.locator('input[name="reminder-time"]').fill(toLocalInputValue(fireAt));
  await reminders.getByRole("button", { name: "Create" }).click();
}

async function expectStatus(
  reminders: Locator,
  status: string,
  timeout = 5000
): Promise<void> {
  await expect(reminders.locator(".timer-meta").getByText(status, { exact: true })).toBeVisible({
    timeout
  });
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
