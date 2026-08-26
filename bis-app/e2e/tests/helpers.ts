import { Page } from '@playwright/test';

export async function signIn(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('text=Who are you?');
  const listed = page.getByRole('button', { name: new RegExp(`^${name}\\b`) });
  if (await listed.count()) {
    await listed.first().click();
  } else {
    await page.click('text=Sign in with an email address instead');
    await page.fill('#signin-email', `${name.toLowerCase()}@example.com`);
    await page.click('button:has-text("Sign in")');
  }
  await page.waitForSelector('header.app-header', { timeout: 15_000 });
}
