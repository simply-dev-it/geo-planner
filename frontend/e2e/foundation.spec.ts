import { expect, test } from '@playwright/test';

test('opens the accessible project workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Nowy projekt — Geo Planner');
  await expect(page.getByRole('banner')).toContainText('Geo Planner');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Nowy projekt',
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toHaveAttribute(
    'href',
    '#main-content',
  );
});
