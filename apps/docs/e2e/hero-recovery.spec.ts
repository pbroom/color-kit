import { expect, test } from '@playwright/test';

test('a failed hero download leaves a usable static fallback and can retry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let fail = true;
  await page.route('**/assets/hero-*.js', (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto('/');
  await expect(
    page.getByRole('status').filter({ hasText: 'Live colors could not load' }),
  ).toContainText('Live colors could not load');
  await expect(
    page.getByRole('slider', { name: 'Hue', exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  fail = false;
  await page
    .getByRole('button', { name: 'Reload to retry', exact: true })
    .click();
  await expect(
    page.getByRole('slider', { name: 'Hue', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('status').filter({ hasText: 'Live colors could not load' }),
  ).toHaveCount(0);
  await page
    .getByRole('slider', { name: 'Hue', exact: true })
    .press('ArrowRight');
  await expect(
    page.getByRole('slider', { name: 'Hue', exact: true }),
  ).toHaveValue('265');
  expect(errors).toEqual([]);
});
