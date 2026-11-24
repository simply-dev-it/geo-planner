import { expect, test as base, type Page } from '@playwright/test';
const origin = `http://127.0.0.1:${process.env['PLAYWRIGHT_FRONTEND_PORT'] ?? '4200'}`;
const test = base.extend<{ localOnly: void }>({
  localOnly: [
    async ({ context }, use) => {
      const external: string[] = [];
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin !== origin) {
          external.push(route.request().url());
          return route.abort();
        }
        return route.fallback();
      });
      await use();
      expect(external).toEqual([]);
    },
    { auto: true },
  ],
});
async function submit(page: Page, label: string, value: string) {
  const input = page.getByRole('searchbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}
async function choosePlace(page: Page, name = 'Brzozowo') {
  await page.locator('gp-search-panel').waitFor();
  if (!(await page.getByRole('searchbox', { name: 'Miejscowość', exact: true }).count()))
    await page
      .getByRole('navigation', { name: 'Miejsce wyszukiwania' })
      .getByRole('button')
      .first()
      .click();
  await submit(page, 'Miejscowość', name);
  await page.locator('.search-row').filter({ hasText: 'Miejscowość' }).click();
  await expect(page.getByRole('searchbox', { name: 'Ulica', exact: true })).toBeVisible();
}
async function locateParcel(page: Page, id = '999999_9.9999.1') {
  await page.locator('gp-search-panel').waitFor();
  if (!(await page.getByRole('button', { name: 'Mam pełny numer działki', exact: true }).count()))
    await page
      .getByRole('navigation', { name: 'Miejsce wyszukiwania' })
      .getByRole('button')
      .first()
      .click();
  await page.getByRole('button', { name: 'Mam pełny numer działki', exact: true }).click();
  await submit(page, 'Pełny numer działki', id);
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/parcels/resolve',
  );
  await page.locator('.search-row').click();
  await response;
}
async function chooseParcel(page: Page) {
  await locateParcel(page);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await page
    .getByRole('button', { name: 'Dodaj znalezioną działkę do projektu', exact: true })
    .click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toContainText('101/1');
}
async function drawArea(page: Page, navigate = true) {
  if (navigate) {
    await choosePlace(page);
    await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  }
  await page.getByRole('button', { name: 'Zaznacz obszar', exact: true }).click();
  const b = (await page.getByRole('region', { name: 'Mapa obszaru projektu' }).boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x - 40, y - 40);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 40, { steps: 8 });
  await page.mouse.up();
}
async function preview(page: Page, name = 'Projekt w Brzozowie') {
  if (await page.getByRole('button', { name: 'Dalej: obszar →' }).count())
    await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  if (await page.getByText('Brak zaznaczenia', { exact: true }).isVisible())
    await page.getByRole('button', { name: 'Dopasuj do działek', exact: true }).click();
  await page.getByRole('button', { name: /^Podgląd (projektu|obszaru) →$/ }).click();
  await page.getByLabel('Nazwa projektu', { exact: true }).fill(name);
  await expect(page.getByRole('button', { name: 'Zapisz projekt', exact: true })).toBeEnabled();
}

test('lookup is read-only and an explicit map-only shortcut opens project selection', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await expect(page.getByRole('searchbox')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Dalej: obszar →' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zaznacz obszar', exact: true })).toHaveCount(0);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v1/parcels/resolve') requests.push(r.url());
  });
  await page.getByRole('region', { name: 'Mapa obszaru projektu' }).click();
  expect(requests).toHaveLength(0);
  await expect(page.locator('.map-dimensions')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Pomiń wyszukiwanie — wybiorę na mapie', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Zaznacz obszar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Podgląd obszaru →' })).toBeDisabled();
});
test('keyboard-only map entry inserts a parcel-free area, previews it and shows tile attribution', async ({
  page,
}) => {
  await page.goto('/projects/new');
  const skip = page.getByRole('button', {
    name: 'Pomiń wyszukiwanie — wybiorę na mapie',
    exact: true,
  });
  await skip.focus();
  await page.keyboard.press('Enter');
  const insert = page.getByRole('button', { name: 'Wstaw obszar na środku mapy', exact: true });
  await insert.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-dimensions')).toContainText('500 × 500 m');
  await expect(insert).toHaveCount(0);
  await page.getByRole('button', { name: 'Powiększ obszar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-dimensions')).toContainText('550 × 550 m');
  await expect(page.locator('.map-attribution')).toContainText(/^\s*Podkład: \S/);
  const next = page.getByRole('button', { name: 'Podgląd obszaru →' });
  await expect(next).toBeEnabled();
  await next.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Nazwa projektu', { exact: true }).fill('Obszar z klawiatury');
  await expect(page.getByRole('button', { name: 'Zapisz projekt', exact: true })).toBeEnabled();
});

test('locality to street to house number shows one input and never selects project subjects', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await choosePlace(page);
  await expect(page.getByRole('searchbox')).toHaveCount(1);
  const street = page.getByRole('searchbox', { name: 'Ulica', exact: true });
  await street.fill('Lip');
  await expect(page.locator('.search-row')).toHaveCount(1);
  await page.locator('.search-row').click();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Numer budynku', exact: true }).click();
  await submit(page, 'Numer budynku', '1');
  await expect(page.locator('.search-row')).toContainText('Brzozowo, Lipowa 1');
  await page.locator('.search-row').click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await expect(page.locator('.map-dimensions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await expect(page.getByRole('heading', { name: 'Obszar i działki', exact: true })).toBeVisible();
});
test('skips the street and locates a short parcel number only in the visible map scope', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await choosePlace(page);
  await page.getByRole('button', { name: 'Pomiń ulicę', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Numer budynku', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Krótki numer działki', exact: true }).click();
  await expect(page.locator('.search-guidance')).toContainText('widocznej okolicy');
  await submit(page, 'Krótki numer działki', '101/1');
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/parcels/resolve',
  );
  await page.locator('.search-row').filter({ hasText: 'Brzozowo' }).click();
  await response;
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await page
    .getByRole('button', { name: 'Dodaj znalezioną działkę do projektu', exact: true })
    .click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toContainText('101/1');
});
test('full identifier locates the parcel and only stage two can add, toggle or draw', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await locateParcel(page);
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zaznacz obszar', exact: true })).toHaveCount(0);
  const map = page.getByRole('region', { name: 'Mapa obszaru projektu' });
  const b = (await map.boundingBox())!;
  await map.click({ position: { x: b.width / 2, y: b.height / 2 } });
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await page
    .getByRole('button', { name: 'Dodaj znalezioną działkę do projektu', exact: true })
    .click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toContainText('101/1');
  await map.click({ position: { x: b.width / 2, y: b.height / 2 } });
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Dodaj znalezioną działkę do projektu', exact: true })
    .click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toContainText('101/1');
});
test('upstream locality changes invalidate street and house context without guessing input type', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await choosePlace(page);
  await submit(page, 'Ulica', 'Lipowa');
  await page.locator('.search-row').click();
  await page.getByRole('button', { name: 'Numer budynku', exact: true }).click();
  await choosePlace(page, 'Jeziorna');
  await expect(page.getByRole('searchbox', { name: 'Ulica', exact: true })).toHaveValue('');
  await submit(page, 'Ulica', 'Lipowa');
  await page.locator('.search-row').click();
  await page.getByRole('button', { name: 'Numer budynku', exact: true }).click();
  await submit(page, 'Numer budynku', '1');
  await expect(page.locator('.search-row')).toContainText('Jeziorna');
  await expect(page.locator('.search-row')).not.toContainText('Brzozowo');
});
test('search errors are recoverable, short street fragments do not fetch, and keyboard results work', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await submit(page, 'Miejscowość', '__fixture_unavailable__');
  await expect(page.getByRole('region', { name: 'Wyniki wyszukiwania' })).toContainText(
    'Wyszukiwanie jest niedostępne.',
  );
  await choosePlace(page);
  const street = page.getByRole('searchbox', { name: 'Ulica', exact: true });
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v1/search') requests.push(r.url());
  });
  await street.fill('Li');
  await page.waitForTimeout(450);
  expect(requests).toHaveLength(0);
  await street.fill('Lip');
  await expect(page.locator('.search-row')).toHaveCount(1);
  await street.press('ArrowDown');
  await expect(page.locator('.search-row')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(street).toBeFocused();
});
test('skipping a number opens area-only selection without inventing subjects or a rectangle', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await choosePlace(page);
  await page.getByRole('button', { name: 'Pomiń ulicę', exact: true }).click();
  await page.getByRole('button', { name: 'Pomiń numer — wybiorę na mapie', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await expect(page.getByText('Brak zaznaczenia', { exact: true })).toBeVisible();
  await drawArea(page, false);
  await preview(page, 'Bez działek');
  await expect(page.getByText(/Bez wybranych działek · obszar gotowy/)).toBeVisible();
});
test('area selection and fit are explicit, review is read-only, and save opens a bounded map', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await chooseParcel(page);
  await expect(page.getByText('Brak zaznaczenia', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dopasuj do działek', exact: true }).click();
  await expect(page.locator('.map-dimensions')).toContainText('260 × 260 m');
  await page.screenshot({ path: 'test-results/workspace-area.png', animations: 'disabled' });
  await preview(page, 'Projekt zapisany');
  await expect(page.getByRole('button', { name: 'Zaznacz obszar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Wybrane działki' }).getByRole('button')).toHaveCount(
    0,
  );
  await page.screenshot({ path: 'test-results/workspace-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Projekt zapisany' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Mapa zapisanego projektu' })).toBeVisible();
  await expect(page.getByText(/Wycinek projektu/)).toBeVisible();
  await page.getByTitle('Zoom out', { exact: true }).click({ clickCount: 6 });
  await page.screenshot({ path: 'test-results/workspace-saved.png', animations: 'disabled' });
});
test('lookup keeps outlines read-only and fills the panel without page scroll', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await choosePlace(page);
  await expect(page.getByText('Wczytywanie obrysów działek…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zaznacz obszar', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/workspace-search.png', animations: 'disabled' });
});
test('portrait guided lookup, skip, draw, preview and save remain usable without coordinate inputs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/new');
  await choosePlace(page);
  await expect(page.getByRole('searchbox')).toHaveCount(1);
  await page.screenshot({
    path: 'test-results/workspace-simple-search-mobile.png',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Pomiń ulicę', exact: true }).click();
  await page.getByRole('button', { name: 'Pomiń numer — wybiorę na mapie', exact: true }).click();
  await drawArea(page, false);
  await preview(page, 'Bez działek');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/workspace-mobile.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mapa zapisanego projektu' })).toBeVisible();
});
test('invalid areas are blocked in selection, remain red, and can return for correction', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await page
    .getByRole('button', { name: 'Pomiń wyszukiwanie — wybiorę na mapie', exact: true })
    .click();
  await drawArea(page, false);
  await expect(page.getByRole('button', { name: 'Podgląd obszaru →' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('limit');
  await page.screenshot({ path: 'test-results/workspace-invalid.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Wstecz', exact: true }).click();
  await choosePlace(page);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await drawArea(page, false);
  await expect(page.getByRole('button', { name: 'Podgląd obszaru →' })).toBeEnabled();
});
test('returning to area invalidates review and keyboard resizing preserves map availability', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await drawArea(page);
  await preview(page);
  await page.getByRole('button', { name: 'Edytuj obszar', exact: true }).click();
  const before = await page.locator('.map-dimensions').innerText();
  await page.getByRole('button', { name: 'Powiększ obszar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-dimensions')).not.toHaveText(before);
  await expect(page.getByRole('button', { name: 'Zapisz projekt', exact: true })).toHaveCount(0);
});
test('simulator catalogue is a separate development dialog', async ({ page }) => {
  await page.goto('/projects/new');
  await page.getByRole('button', { name: 'Dane testowe', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('101/1');
  await expect(dialog).toContainText('Brzozowo');
});
test('unknown committed save replays the exact key and payload after reload', async ({ page }) => {
  await page.goto('/projects/new');
  await expect(
    page.getByRole('button', { name: 'Obszar na środku mapy', exact: true }),
  ).toHaveCount(0);
  await drawArea(page);
  await preview(page, 'Niepewny projekt');
  let key = '',
    id = '';
  let body: unknown;
  await page.route('**/api/v1/projects', async (route) => {
    key = route.request().headers()['idempotency-key'];
    body = route.request().postDataJSON();
    const response = await route.fetch();
    id = (await response.json()).id;
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await expect(page.getByText('Wynik zapisu jest niepewny.', { exact: true })).toBeVisible();
  await page.unroute('**/api/v1/projects');
  await page.reload();
  await expect(page.getByLabel('Nazwa projektu', { exact: true })).toBeDisabled();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/projects') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ponów tę samą próbę', exact: true }).click();
  const replay = await response;
  expect(replay.request().headers()['idempotency-key']).toBe(key);
  expect(replay.request().postDataJSON()).toEqual(body);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
});

test('archived Ciezkowice lookup shows real orthophoto and parcels, then adds only in selection', async ({
  page,
}) => {
  await page.goto('/projects/new');
  const raster = page.waitForResponse(
    (r) => r.headers()['x-simulator-fixture'] === 'archived-ciezkowice-orthophoto-256px-png',
  );
  await locateParcel(page, '121601_4.0001.1092/2');
  await raster;
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dalej: obszar →' }).click();
  await page
    .getByRole('button', { name: 'Dodaj znalezioną działkę do projektu', exact: true })
    .click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toContainText('1092/2');
  await page.getByRole('button', { name: 'Dopasuj do działek', exact: true }).click();
  await expect(page.getByText('Wczytywanie obrysów działek…')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/workspace-ciezkowice.png', animations: 'disabled' });
  await preview(page, 'Ciężkowice');
  await page.getByRole('button', { name: 'Zapisz projekt', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mapa zapisanego projektu' })).toBeVisible();
  await expect(page.locator('.map-attribution')).toContainText('Archived GUGiK ORTO snapshot');
});

test('replays real locality ambiguity and qualified street-house lookup from public captures', async ({
  page,
}) => {
  await page.goto('/projects/new');
  await page.locator('gp-search-panel').waitFor();
  await submit(page, 'Miejscowość', 'Ciężkowice');
  await expect(page.locator('.search-row')).toHaveCount(3);
  await page.locator('.search-row').filter({ hasText: 'tarnowski' }).click();
  await submit(page, 'Ulica', 'Kolejowa');
  await page.locator('.search-row').click();
  await page.getByRole('button', { name: 'Numer budynku', exact: true }).click();
  await submit(page, 'Numer budynku', '10');
  await expect(page.locator('.search-row')).toContainText('Ciężkowice, Kolejowa 10');
  await page.locator('.search-row').click();
  await expect(page.getByRole('list', { name: 'Wybrane działki' })).toHaveCount(0);
});
