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
    await page.getByRole('button', { name: 'Distancia' }).click();
    await clickAt(page, c.x - 150, c.y);
    await clickAt(page, c.x, c.y - 60);
    await expect(page.getByTestId('sketch')).toHaveText(/m$/);
    await page.mouse.dblclick(c.x + 150, c.y);
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.value')).toHaveText(/\d(\.\d+)? (m|km)$/);
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(items(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Rehacer' }).click();
    await expect(items(page)).toHaveCount(1);
});

test('mide un área y cambia de unidad', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Área' }).click();
    await clickAt(page, c.x - 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y + 100);
    await page.mouse.dblclick(c.x - 100, c.y + 100);
    await expect(items(page)).toHaveCount(1);
    await page.getByLabel('Unidad de área').selectOption('ha');
    await expect(items(page).first().locator('.value')).toHaveText(/ ha$/);
});

test('mueve un vértice y la medida se actualiza; deshacer la regresa', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Distancia' }).click();
    await clickAt(page, c.x - 100, c.y);
    await page.mouse.dblclick(c.x + 100, c.y);
    const value = items(page).first().locator('.value');
    const before = await value.textContent();
    await page.getByRole('button', { name: 'Seleccionar' }).click();
    await page.mouse.click(c.x, c.y);
    await expect(items(page).first()).toHaveAttribute('aria-current', 'true');
    await page.mouse.move(c.x + 100, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 200, c.y, { steps: 8 });
    await page.mouse.up();
    await expect(value).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(value).toHaveText(before ?? '');
});

test('escribe un texto y lo borra con Supr', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Texto' }).click();
    await clickAt(page, c.x, c.y);
    const input = page.getByRole('textbox', { name: 'Texto' });
    await input.fill('Cerro del Cuatro');
    await input.press('Enter');
    await expect(items(page).first().locator('.value')).toHaveText('Cerro del Cuatro');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
    await items(page).first().locator('.pick').click();
    await page.keyboard.press('Delete');
    await expect(items(page)).toHaveCount(0);
});

test('traza a mano alzada', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Mano alzada' }).click();
    await page.mouse.move(c.x - 100, c.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) await page.mouse.move(c.x - 100 + i * 20, c.y + (i % 2) * 20);
    await page.mouse.up();
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first().locator('.kind')).toHaveText('Trazo');
});

test('muestra el perfil de alturas de la línea seleccionada y lo recalcula al editar', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Distancia' }).click();
    await clickAt(page, c.x - 150, c.y);
    await page.mouse.dblclick(c.x + 150, c.y);
    await expect(page.getByTestId('profile')).toHaveCount(0);
    await page.getByRole('button', { name: 'Seleccionar' }).click();
    await page.mouse.click(c.x, c.y);
    const profile = page.getByTestId('profile');
    await expect(profile).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('max')).toHaveText(/^[\d,]+ m$/);
    const ascent = page.getByTestId('ascent');
    const before = await ascent.textContent();
    const chart = page.getByRole('img', { name: 'Perfil de alturas' });
    await chart.hover();
    await expect(page.getByTestId('profile-readout')).toHaveText(/(m|km) · [\d,]+ m$/);
    await page.mouse.move(c.x + 150, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 250, c.y - 120, { steps: 8 });
    await page.mouse.up();
    await expect(ascent).not.toHaveText(before ?? '');
    await expect(profile).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(ascent).toHaveText(before ?? '');
});

test('muestra el relieve de un área y la altura de un punto', async ({ page }) => {
    const c = await center(page);
    await page.getByRole('button', { name: 'Área' }).click();
    await clickAt(page, c.x - 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y - 100);
    await clickAt(page, c.x + 100, c.y + 100);
    await page.mouse.dblclick(c.x - 100, c.y + 100);
    await page.getByRole('button', { name: 'Seleccionar' }).click();
    await page.mouse.click(c.x, c.y);
    await expect(page.getByTestId('surface')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('surface-max')).toHaveText(/^[\d,]+ m$/);
    await expect(page.getByRole('img', { name: 'Curva hipsométrica' })).toBeVisible();
    await page.getByRole('button', { name: 'Punto' }).click();
    await clickAt(page, c.x + 250, c.y);
    await page.getByRole('button', { name: 'Seleccionar' }).click();
    await page.mouse.click(c.x + 250, c.y);
    await expect(page.getByTestId('point-elevation')).toHaveText(/^[\d,]+ m$/);
});
