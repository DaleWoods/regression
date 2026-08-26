import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('a coordinator can close, finalise, and reach the feedback view', async ({ page }) => {
  await signIn(page, 'E2E Admin');

  await page.goto('/rounds');
  await page.waitForSelector('table');
  const roundLink = page.locator('a', { hasText: 'Demo round' });
  await roundLink.click();

  await page.waitForSelector('text=Round actions');
  await expect(page.locator('table').last()).toBeVisible(); // live results table

  await page.getByRole('button', { name: 'Close scoring' }).click();
  await expect(page.locator('.badge.closed')).toBeVisible();

  await page.getByRole('button', { name: 'Finalise round' }).click();
  await expect(page.getByRole('link', { name: 'Open feedback view' })).toBeVisible();

  await page.getByRole('link', { name: 'Open feedback view' }).click();
  await expect(page.getByRole('heading', { name: /How the committee scored/ })).toBeVisible();
  await expect(page.getByText('The round at a glance')).toBeVisible();
});
