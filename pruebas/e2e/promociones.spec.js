/* Promociones: el CRM manda `promo` (precio, normal, porcentaje, hasta, tope) solo mientras vale.
   La tienda pone el sello «-20 %», el precio de promoción con el normal tachado y «Hasta el …»;
   el último día, cuánto falta. La canasta cobra igual que el CRM: la promoción gana al precio por
   cantidad y lo que pasa del tope va al precio normal. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { abrirTienda, abrirCanasta, vigilar } from './ayudas.js';

const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
const HORA = '2026-11-12T15:00:00-05:00';
const J1 = 'Contenedor icopor J1 x25 und';   /* id 141, $9.800 */
const tarjeta = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ nombre) => page.locator('#grilla li', { hasText: nombre });
const agregarUno = (/** @type {import('@playwright/test').Page} */ page) => page.locator('#grilla').getByRole('button', { name: new RegExp(`^Agregar (uno más de )?${J1}`) }).click();

/** El catálogo con una promoción en el J1 y los precios por cantidad que se le pongan. */
function conPromo(/** @type {any} */ promo, /** @type {any[]} */ escalones = []) {
  const catalogo = structuredClone(CATALOGO_CRM);
  const j1 = catalogo.productos.find((/** @type {any} */ p) => p.id === 141);
  j1.promo = { precio: 7840, normal: 9800, porcentaje: 20, hasta: '2026-11-15', tope: null, ...promo };
  j1.escalones = escalones;
  return catalogo;
}

test('la tarjeta y la ficha muestran el sello, el precio tachado y hasta cuándo va', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { catalogo: conPromo({}), hora: HORA });
  await page.locator('#verTodo').click();
  const t = tarjeta(page, J1);
  await expect(t.locator('.sello.promo')).toHaveText('-20 %');
  await expect(t.locator('.precio .ahora')).toHaveText('$7.840');
  await expect(t.locator('.precio .antes')).toHaveText('$9.800');
  await expect(t.locator('.fin-promo')).toHaveText('Hasta el 15 nov');
  await expect(t.locator('.por-unidad')).toHaveText('$314 c/u');   /* $7.840 / 25: el precio que se paga */
  await t.locator('button.nombre').click();
  await expect(page.locator('#fichaPrecio .ahora')).toHaveText('$7.840');
  await expect(page.locator('#fichaPrecio .antes')).toHaveText('$9.800');
  await expect(page.locator('#fichaPromo')).toContainText('-20 %');
  await expect(page.locator('#fichaPromo .fin-promo')).toHaveText('Hasta el 15 nov');
  v.sinProblemas();
});

test('el último día dice cuánto falta, y no antes', async ({ page }) => {
  await abrirTienda(page, { catalogo: conPromo({ hasta: '2026-11-12' }), hora: HORA });
  await page.locator('#verTodo').click();
  const fin = tarjeta(page, J1).locator('.fin-promo');
  await expect(fin).toHaveText('Termina en 8 h 59 min');
  await expect(fin).toHaveClass(/ultimo-dia/);
});

test('la que ya terminó no se anuncia ni se cobra, aunque el catálogo viejo la traiga', async ({ page }) => {
  await abrirTienda(page, { catalogo: conPromo({ hasta: '2026-11-11' }), hora: HORA });
  await page.locator('#verTodo').click();
  const t = tarjeta(page, J1);
  await expect(t.locator('.precio')).toHaveText('$9.800');
  await expect(t.locator('.sello.promo, .fin-promo')).toHaveCount(0);
});

test('la canasta cobra la promoción hasta el tope y lo demás a precio normal', async ({ page }) => {
  await abrirTienda(page, { catalogo: conPromo({ tope: 2 }), hora: HORA });
  await page.locator('#verTodo').click();
  for (let i = 0; i < 3; i++) await agregarUno(page);
  await abrirCanasta(page);
  const linea = page.locator('#items li', { hasText: J1 });
  await expect(linea.locator('.v')).toHaveText('$25.480');   /* 2 × 7.840 + 9.800 */
  await expect(linea.locator('.cada-uno')).toHaveText('Promoción: $7.840 cada uno hasta 2; los demás a $9.800');
});

test('sin tope, la promoción gana al precio por cantidad y la ficha no lo ofrece', async ({ page }) => {
  await abrirTienda(page, { catalogo: conPromo({}, [{ desde: 2, precio: 7000 }]), hora: HORA });
  await page.locator('#verTodo').click();
  for (let i = 0; i < 3; i++) await agregarUno(page);
  await abrirCanasta(page);
  await expect(page.locator('#items li', { hasText: J1 }).locator('.v')).toHaveText('$23.520');   /* 3 × 7.840 */
  await page.evaluate(() => { location.hash = '#p=141'; });
  await expect(page.locator('#escalonesCaja')).toBeHidden();
});

test('una promoción dañada no rompe la tienda: se ve el precio normal', async ({ page }) => {
  const v = vigilar(page);
  const catalogo = conPromo({ precio: 'barato', hasta: 'mañana' });
  await abrirTienda(page, { catalogo, hora: HORA });
  await page.locator('#verTodo').click();
  await expect(tarjeta(page, J1).locator('.precio')).toHaveText('$9.800');
  v.sinProblemas();
});
