import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('a committee member can score a ticket', async ({ page }) => {
  // Priya is seeded with no submissions yet in the demo round, so this
  // exercises the first-time "Submit my score" path, not an edit.
  await signIn(page, 'Priya');

  await page.waitForSelector('h1');
  const card = page.locator('.ticket-card').first();
  await card.scrollIntoViewIfNeeded();

  await card.getByLabel('Yes – It aligns with Business Strategy').check();
  const firstSlider = card.locator('input[type="range"]').first();
  await expect(firstSlider).toBeVisible();
  await firstSlider.fill('7');

  await card.getByRole('button', { name: 'Submit my score' }).click();
  await expect(card.locator('.status.saved')).toContainText('Saved');
});
