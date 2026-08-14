import { expect, test } from '@playwright/test';

test('host creates a room and a second browser joins it', async ({ browser, page }) => {
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  await page.goto('/');
  await page.getByRole('link', { name: 'Create a room' }).click();
  await page.getByLabel('Host display name').fill('Host One');
  await page.getByRole('button', { name: 'Create room' }).click();

  await expect(page.getByText('Playback control center')).toBeVisible();

  const roomUrl = new URL(page.url());
  const roomId = roomUrl.pathname.split('/').pop();
  if (!roomId) {
    throw new Error('Room id was not present in the URL.');
  }

  await guestPage.goto(`/join/${roomId}`);
  await guestPage.getByLabel('Display name').fill('Guest Two');
  await guestPage.getByRole('button', { name: 'Join room' }).click();

  await expect(guestPage.getByText('Playback control center')).toBeVisible();
  await expect(page.getByText('Guest Two')).toBeVisible();
  await guestContext.close();
});