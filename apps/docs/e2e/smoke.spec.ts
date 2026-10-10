import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/start', '/concepts/requested-vs-displayed', '/api'];

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
