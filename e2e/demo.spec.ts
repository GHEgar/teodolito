import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const items = (page: Page) => page.getByTestId('items').locator('li');

async function center(page: Page) {
    const rect = await page.getByTestId('map').boundingBox();
    if (!rect) throw new Error('map has no box');
    return { x: rect.x + 400, y: rect.y + 400 };
}

async function clickAt(page: Page, x: number, y: number) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(120);
}

test.beforeEach(async ({ page }) => {
    await page.route(/tile\.openstreetmap\.org|elevation-tiles-prod/, (route) => route.abort());
    await page.goto('/');
    await page.getByRole('toolbar').waitFor();
});

test('mide una distancia, la deshace y la rehace', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Distance' }).click();
    await clickAt(page, c.x - 150, c.y);
    await clickAt(page, c.x, c.y - 60);
    await expect(page.getByTestId('sketch')).toHaveText(/m$/);
    await page.mouse.dblclick(c.x + 150, c.y);
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.value')).toHaveText(/\d(\.\d+)? (m|km)$/);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(items(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(items(page)).toHaveCount(1);
});

test('mide un área y cambia de unidad', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Area' }).click();
    await clickAt(page, c.x - 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y + 100);
    await page.mouse.dblclick(c.x - 100, c.y + 100);
    await expect(items(page)).toHaveCount(1);
    await page.getByLabel('Area unit').selectOption('ha');
    await expect(items(page).first().locator('.value')).toHaveText(/ ha$/);
});

test('mueve un vértice y la medida se actualiza; deshacer la regresa', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Distance' }).click();
    await clickAt(page, c.x - 100, c.y);
    await page.mouse.dblclick(c.x + 100, c.y);
    const value = items(page).first().locator('.value');
    const before = await value.textContent();
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(c.x, c.y);
    await expect(items(page).first()).toHaveAttribute('aria-current', 'true');
    await page.mouse.move(c.x + 100, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 200, c.y, { steps: 8 });
    await page.mouse.up();
    await expect(value).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(value).toHaveText(before ?? '');
});

test('escribe un texto y lo borra con Supr', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Text' }).click();
    await clickAt(page, c.x, c.y);
    const input = page.getByRole('textbox', { name: 'Text' });
    await input.fill('Cerro del Cuatro');
    await input.press('Enter');
    await expect(items(page).first().locator('.value')).toHaveText('Cerro del Cuatro');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true');
    await items(page).first().locator('.pick').click();
    await page.keyboard.press('Delete');
    await expect(items(page)).toHaveCount(0);
});

test('traza a mano alzada', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Freehand' }).click();
    await page.mouse.move(c.x - 100, c.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) await page.mouse.move(c.x - 100 + i * 20, c.y + (i % 2) * 20);
    await page.mouse.up();
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.kind')).toHaveText('Stroke');
});

test('muestra el perfil de alturas de la línea seleccionada y lo recalcula al editar', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Distance' }).click();
    await clickAt(page, c.x - 150, c.y);
    await page.mouse.dblclick(c.x + 150, c.y);
    await expect(page.getByTestId('profile')).toHaveCount(0);
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(c.x, c.y);
    const profile = page.getByTestId('profile');
    await expect(profile).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('max')).toHaveText(/^[\d,]+ m$/);
    const ascent = page.getByTestId('ascent');
    const before = await ascent.textContent();
    const chart = page.getByRole('img', { name: 'Elevation profile' });
    await chart.hover();
    await expect(page.getByTestId('profile-readout')).toHaveText(/(m|km) · [\d,]+ m$/);
    await page.mouse.move(c.x + 150, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 250, c.y - 120, { steps: 8 });
    await page.mouse.up();
    await expect(ascent).not.toHaveText(before ?? '');
    await expect(profile).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(ascent).toHaveText(before ?? '');
});

test('muestra el relieve de un área y la altura de un punto', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Area' }).click();
    await clickAt(page, c.x - 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y + 100);
    await page.mouse.dblclick(c.x - 100, c.y + 100);
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(c.x, c.y);
    await expect(page.getByTestId('surface')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('surface-max')).toHaveText(/^[\d,]+ m$/);
    await expect(page.getByRole('img', { name: 'Hypsometric curve' })).toBeVisible();
    await page.getByRole('button', { name: 'Point' }).click();
    await clickAt(page, c.x + 250, c.y);
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(c.x + 250, c.y);
    await expect(page.getByTestId('point-elevation')).toHaveText(/^[\d,]+ m$/);
});

test('traza un círculo y un rectángulo con sus medidas por segmento', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Circle' }).click();
    await clickAt(page, c.x - 150, c.y);
    await page.mouse.move(c.x - 100, c.y, { steps: 4 });
    await expect(page.getByTestId('sketch')).toHaveText(/m²|ha|km²/);
    await clickAt(page, c.x - 50, c.y);
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.kind')).toHaveText('Circle');
    await items(page).first().locator('.pick').click();
    const radius = page.getByTestId('radius');
    await expect(radius).toHaveText(/^Radius [\d,.]+ (m|km)$/);
    const before = await radius.textContent();
    await page.mouse.move(c.x - 150 + 60, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x - 150 + 60, c.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect(radius).toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Rectangle' }).click();
    await clickAt(page, c.x + 50, c.y - 80);
    await clickAt(page, c.x + 250, c.y + 40);
    await expect(items(page)).toHaveCount(2);
    await items(page).nth(1).locator('.pick').click();
    await expect(page.getByTestId('sides')).toHaveText(/× /);
    await expect(page.getByTestId('segments').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('segments').locator('li').first()).toContainText('∠ 90');
});

async function dragFrom(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
}

test('pone un símbolo y lo gira y escala con sus manijas', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Symbol', exact: true }).click();
    await page.getByRole('radio', { name: 'Symbol ⛰️' }).click();
    await clickAt(page, c.x, c.y);
    await expect(items(page).first().locator('.value')).toContainText('⛰️');
    await page.getByRole('button', { name: 'Select' }).click();
    await items(page).first().locator('.pick').click();
    const state = page.getByTestId('transform-state');
    await expect(state).toHaveText('0° · ×1.00');
    await dragFrom(page, { x: c.x, y: c.y - 60 }, { x: c.x + 60, y: c.y });
    await expect(state).toHaveText(/^90° · ×1\.00$/);
    await dragFrom(page, { x: c.x, y: c.y + 32 }, { x: c.x, y: c.y + 64 });
    await expect(state).toHaveText(/^90° · ×2\.00$/);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(state).toHaveText('90° · ×1.00');
});

test('cambia el radio del círculo con su manija y el rectángulo rotado sigue siendo rectángulo', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Circle' }).click();
    await clickAt(page, c.x - 150, c.y);
    await clickAt(page, c.x - 100, c.y);
    await page.getByRole('button', { name: 'Select' }).click();
    await items(page).first().locator('.pick').click();
    const radius = page.getByTestId('radius');
    const before = await radius.textContent();
    await dragFrom(page, { x: c.x - 150, y: c.y - 50 }, { x: c.x - 150, y: c.y - 120 });
    await expect(radius).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(radius).toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Rectangle' }).click();
    await clickAt(page, c.x + 50, c.y - 50);
    await clickAt(page, c.x + 250, c.y + 50);
    await page.getByRole('button', { name: 'Select' }).click();
    await items(page).nth(1).locator('.pick').click();
    await page.getByRole('button', { name: 'Rotate right' }).click();
    const sides = page.getByTestId('sides');
    const square = await sides.textContent();
    const corner = await page.evaluate(() => {
        const map = (window as unknown as { olMap: import('ol/Map.js').default }).olMap;
        const layer = map.getLayers().getArray().at(-1) as import('ol/layer/Vector.js').default;
        const spot = layer.getSource()?.getFeatures().find((f) => f.get('handle') === 'corner' && f.get('index') === 2);
        const point = spot?.getGeometry() as import('ol/geom/Point.js').default;
        return map.getPixelFromCoordinate(point.getCoordinates());
    });
    const box = await page.getByTestId('map').boundingBox();
    const from = { x: (box?.x ?? 0) + (corner[0] ?? 0), y: (box?.y ?? 0) + (corner[1] ?? 0) };
    await dragFrom(page, from, { x: from.x + 40, y: from.y + 30 });
    await expect(sides).not.toHaveText(square ?? '');
    const angles = page.getByTestId('segments').locator('li');
    await expect(angles).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) await expect(angles.nth(i)).toContainText(/∠ (89\.\d|90(\.\d)?)°/);
});

test('mide un ángulo de tres clics, lo renombra y prende y apaga las marcas', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Angle', exact: true }).click();
    await clickAt(page, c.x, c.y - 150);
    await clickAt(page, c.x, c.y);
    await clickAt(page, c.x + 150, c.y);
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.value')).toHaveText(/^(89|90)(\.\d)?°$/);
    await page.screenshot({ path: 'test-results/marks-angle.png' });
    await page.getByRole('button', { name: 'Select' }).click();
    await items(page).first().locator('.pick').click();
    const name = page.getByRole('textbox', { name: 'Name' });
    await name.fill('Corner');
    await name.press('Enter');
    await expect(items(page).first().locator('.kind')).toHaveText('Corner');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(items(page).first().locator('.kind')).toHaveText('Angle');
    const labels = page.getByRole('button', { name: 'Segments and angles' });
    await expect(labels).toHaveAttribute('aria-pressed', 'true');
    await labels.click();
    await expect(labels).toHaveAttribute('aria-pressed', 'false');
});
