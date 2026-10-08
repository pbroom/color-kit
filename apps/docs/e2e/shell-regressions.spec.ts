import { expect, test } from '@playwright/test';

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/start');
  await page.waitForLoadState('networkidle');
}

test('same-page search selection focuses the document', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('start');
  await page
    .getByRole('option')
    .filter({ hasText: /^Start/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#main')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Search the docs' }),
  ).toBeFocused();
});

test('same-page drawer selection focuses the document', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Start', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toBeFocused();
});

test('desktop breakpoint closes the modal navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#main')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const failure of ['blocked', 'quota']) {
  test(`package selection works with ${failure} storage`, async ({ page }) => {
    await page.addInitScript((mode) => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Unavailable', 'QuotaExceededError');
      };
      if (mode === 'blocked')
        Storage.prototype.getItem = () => {
          throw new DOMException('Blocked', 'SecurityError');
        };
    }, failure);
    await ready(page);
    await page
      .getByRole('button', { name: 'npm', exact: true })
      .first()
      .click();
    for (const button of await page
      .getByRole('button', { name: 'npm', exact: true })
      .all()) {
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(
      page.locator('.install-line__command code').first(),
    ).toContainText('npm install');
  });
}

test('failed prose search exits loading without an unhandled rejection', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export async function options() {} export async function init() {} export async function debouncedSearch() { throw new Error("search unavailable"); }',
    }),
  );
  await ready(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('nothingmatcheszz');
  await expect(page.getByRole('status')).toContainText(
    'Full-text search is unavailable',
  );
  expect(errors).toEqual([]);
});

test('route failures retain the main landmark and recovery focus', async ({
  page,
}) => {
  await page.route('**/assets/start-*.js', (route) => route.abort());
  await page.goto('/start');
  await expect(
    page.getByRole('heading', { name: 'This page failed to render' }),
  ).toBeVisible();
  await expect(page.locator('main#main')).toHaveCount(1);
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('link', { name: 'Go home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#main')).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'This page failed to render' }),
  ).toHaveCount(0);
});
