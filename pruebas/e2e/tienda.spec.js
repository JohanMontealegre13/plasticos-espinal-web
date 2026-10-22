/* La tienda tal como está hoy: catálogo del CRM, agotados y domicilio.
   Las pruebas de cada función nueva viven en su propio archivo. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirTienda, vigilar } from './ayudas.js';

test('pinta los productos del CRM y el agotado no se puede agregar', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#grilla li', { hasText: 'Plato 23 cm' }).getByRole('button', { name: 'Agotado' })).toBeDisabled();
  v.sinProblemas();
});

test('bajo $50.000 cobra $4.000 de domicilio', async ({ page }) => {
  await abrirTienda(page);
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#dom')).toHaveText('$4.000');
  await expect(page.locator('#tot')).toHaveText('$13.800');
});

test('desde $50.000 en productos el domicilio es gratis', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  for (const n of ['Bolsa kraft #6 x100 und', 'Detergente en polvo 1 kg', 'Contenedor icopor J1 x25 und', 'Servilleta 25x25 x300 und', 'Tenedor plástico x100 und']) {
    await page.getByRole('button', { name: `Agregar ${n} a la canasta` }).click();
  }   /* 18.900 + 12.500 + 9.800 + 9.200 + 6.200 = 56.600 */
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#dom')).toHaveText('Gratis');
});

test('la franja dice desde cuánto es gratis con el valor del CRM', async ({ page }) => {
  const v = vigilar(page);
  const catalogo = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
  catalogo.domicilio.gratis_desde = 70000;
  await abrirTienda(page, { catalogo });
  await expect(page.locator('#gratisDesde')).toHaveText('$70.000');
  v.sinProblemas();
});

test('la franja y el inicio no nombran Chicoral', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('body')).not.toContainText(/Chicoral/i);
  await page.goto('/');
  await expect(page.locator('body')).not.toContainText(/Chicoral/i);
  expect(await page.content()).not.toMatch(/Chicoral/i);
});
