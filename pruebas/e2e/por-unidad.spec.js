/* Precio por unidad junto al del paquete, como lo muestra MercadoLibre: sale de `contenido` del CRM
   (lo que trae el paquete, de la ficha completa). Sin ese dato, o si la unidad se mide, no sale. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
const tarjeta = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ nombre) => page.locator('#grilla li', { hasText: nombre });

test('la tarjeta dice el precio por unidad de lo que viene en paquete', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  await expect(tarjeta(page, 'Contenedor icopor J1 x25 und').locator('.por-unidad')).toHaveText('$392 c/u');   /* $9.800 / 25 */
  await expect(tarjeta(page, 'Tenedor plástico x100 und').locator('.por-unidad')).toHaveText('$62 c/u');
  await expect(tarjeta(page, 'Detergente en polvo 1 kg').locator('.por-unidad')).toHaveCount(0);       /* se mide: no */
  await expect(tarjeta(page, 'Servilleta 25x25 x300 und').locator('.por-unidad')).toHaveCount(0);      /* sin contenido del CRM: no */
  v.sinProblemas();
});

test('la ficha dice «Precio por unidad»; sin el dato del CRM no dice nada', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await expect(page.locator('#fichaUnidad')).toHaveText('Precio por unidad: $392');
  await page.evaluate(() => { location.hash = '#p=191'; });
  await expect(page.locator('#fichaNombre')).toHaveText('Servilleta 25x25 x300 und');
  await expect(page.locator('#fichaUnidad')).toBeHidden();
});

test('con un empaque creado dice «c/rollo»; bajo $100 lleva centavos; un paquete de uno no se divide', async ({ page }) => {
  const catalogo = structuredClone(CATALOGO_CRM);
  const por = Object.fromEntries(catalogo.productos.map((/** @type {any} */ p) => [p.id, p]));
  por[191].contenido = { cantidad: 4, unidad: 'rollo', se_mide: false };     /* $9.200 / 4 */
  por[228].contenido = { cantidad: 300, unidad: 'und', se_mide: false };     /* $3.100 / 300 = $10,33 */
  por[305].contenido = { cantidad: 1, unidad: 'und', se_mide: false };       /* uno solo: el precio ya es por unidad */
  await abrirTienda(page, { catalogo });
  await page.locator('#verTodo').click();
  await expect(tarjeta(page, 'Servilleta 25x25 x300 und').locator('.por-unidad')).toHaveText('$2.300 c/rollo');
  await expect(tarjeta(page, 'Pitillo flexible x100 und').locator('.por-unidad')).toHaveText('$10,33 c/u');
  await expect(tarjeta(page, 'Bolsa kraft #6 x100 und').locator('.por-unidad')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#p=191'; });
  await expect(page.locator('#fichaUnidad')).toHaveText('Precio por rollo: $2.300');
});

test('un contenido dañado no rompe la tienda: solo no sale el precio por unidad', async ({ page }) => {
  const v = vigilar(page);
  const catalogo = structuredClone(CATALOGO_CRM);
  catalogo.productos[0].contenido = { cantidad: 'muchos', unidad: 'und' };
  catalogo.productos[1].contenido = 'x100';
  await abrirTienda(page, { catalogo });
  await expect(page.locator('#grilla li').first()).toBeVisible();
  await expect(page.locator('#grilla .por-unidad', { hasText: 'NaN' })).toHaveCount(0);
  v.sinProblemas();
});
