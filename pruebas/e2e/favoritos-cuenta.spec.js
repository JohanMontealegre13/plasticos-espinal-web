/* Favoritos en la cuenta (pedido del dueño, 11-nov-2026): el celular y el computador muestran los mismos.
   La primera vez que la cuenta entra en un navegador se juntan los de ahí con los de la cuenta; después manda
   la cuenta. Un CRM que aún no manda «favoritos» deja todo como antes (solo en el navegador). */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, CUENTA } from './ayudas.js';

/** Abre la tienda con favoritos guardados aquí y en la cuenta; devuelve lo que la tienda le mandó al CRM. */
async function conFavoritos(/** @type {import('@playwright/test').Page} */ page, /** @type {{ aqui?: number[], nube: number[], marca?: string }} */ op) {
  /** @type {number[][]} */
  const subidos = [];
  await page.addInitScript((o) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    if (o.aqui) localStorage.setItem('pe-favoritos-v1', JSON.stringify(o.aqui));
    if (o.marca) localStorage.setItem('pe-favoritos-cuenta', o.marca);
  }, op);
  await page.route('**/tienda/mi-cuenta/api/favoritos', (r) => {
    const ids = r.request().postDataJSON().favoritos;
    subidos.push(ids);
    r.fulfill({ json: { ok: true, favoritos: ids } });
  });
  await abrirTienda(page, { cuenta: { ...CUENTA, favoritos: op.nube } });
  return subidos;
}

test('la primera vez en este navegador se juntan los de aquí con los de la cuenta y se suben', async ({ page }) => {
  const v = vigilar(page);
  const subidos = await conFavoritos(page, { aqui: [210], nube: [228] });
  await expect(page.locator('#favoritos li')).toHaveCount(2);
  await expect.poll(() => subidos.at(-1)).toEqual([228, 210]);
  expect(await page.evaluate(() => localStorage.getItem('pe-favoritos-cuenta'))).toBe(CUENTA.documento);
  v.sinProblemas();
});

test('ya unida, manda la cuenta: lo que se quitó en el otro equipo no vuelve', async ({ page }) => {
  const subidos = await conFavoritos(page, { aqui: [210, 228], nube: [228], marca: CUENTA.documento });
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await page.waitForTimeout(600);
  expect(subidos).toEqual([]);
});

test('los favoritos de otra cuenta en este navegador no se mezclan', async ({ page }) => {
  const subidos = await conFavoritos(page, { aqui: [210], nube: [], marca: '999' });
  await expect(page.locator('#favoritos')).toBeHidden();
  await page.waitForTimeout(600);
  expect(subidos).toEqual([]);
});

test('tocar el corazón guarda la lista en la cuenta', async ({ page }) => {
  const subidos = await conFavoritos(page, { nube: [], marca: CUENTA.documento });
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect.poll(() => subidos.length).toBe(1);
  expect(subidos[0]).toHaveLength(1);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Quitar de favoritos' }).click();
  await expect.poll(() => subidos.at(-1)).toEqual([]);
});

test('sin «favoritos» en la cuenta (CRM viejo) siguen solo en el navegador y no se llama al CRM', async ({ page }) => {
  /** @type {string[]} */
  const llamadas = [];
  await page.route('**/tienda/mi-cuenta/api/favoritos', (r) => { llamadas.push('x'); r.fulfill({ json: { ok: true } }); });
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await page.waitForTimeout(600);
  expect(llamadas).toEqual([]);
});
