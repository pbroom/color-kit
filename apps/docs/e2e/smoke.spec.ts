import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/start',
  '/concepts/requested-vs-displayed',
  '/api',
  '/api/core/conversion',
];

for (const path of PAGES) {
  test(`${path} hydrates cleanly and passes axe`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || /hydrat/i.test(message.text())) {
        problems.push(message.text());
      }
    });
    page.on('pageerror', (error) => problems.push(error.message));

    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.waitForLoadState('networkidle');

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('⌘K opens search and Escape closes it', async ({ page }) => {
  await page.goto('/start');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('skip link moves focus to main', async ({ page }) => {
  await page.goto('/start');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('an API row opens from its anchor and toggles from the keyboard', async ({
  page,
}) => {
  await page.goto('/api/core/conversion#toRgb');
  const row = page.locator('details#toRgb');
  await expect(row).toHaveAttribute('open', '');
  await expect(row.locator('.api-table__panel')).toBeVisible();
  const summary = page.locator('details#fromHex > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details#fromHex')).toHaveAttribute('open', '');
});

test('a retired symbol page lands on its row', async ({ page }) => {
  await page.goto('/api/core/toRgb');
  await expect(page).toHaveURL(/\/api\/core\/conversion#toRgb$/);
  await expect(page.locator('details#toRgb')).toHaveAttribute('open', '');
});
