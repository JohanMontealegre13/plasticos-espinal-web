/* La tienda en su subdominio (tienda.plasticosespinal.com, decisión de Johan del 10-nov-2026).
   El servidor de pruebas lo imita en tienda.localhost con las mismas reglas del middleware
   (rutaDe de functions/_middleware.js): «/» sale de tienda/, sin /tienda/ en la dirección. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const PUERTO = Number(process.env.PUERTO || 4173);
const TIENDA = `http://tienda.localhost:${PUERTO}`;

test('la tienda abre en la raíz del subdominio, con sus estilos y sin errores', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: TIENDA + '/' });
  expect(new URL(page.url()).pathname).toBe('/');
  /* Si tienda.css no cargara, la cabecera no tendría su fondo blanco fijo */
  await expect(page.locator('.cab')).toHaveCSS('position', /sticky|fixed/);
  v.sinProblemas();
});

test('una dirección vieja con /tienda/ delante termina en la dirección limpia', async ({ page }) => {
  await abrirTienda(page, { ruta: TIENDA + '/tienda/' });
  expect(page.url()).toBe(TIENDA + '/');
});

test('el pie lleva a los términos de la tienda en /terminos/, no a los de la página', async ({ page }) => {
  await abrirTienda(page, { ruta: TIENDA + '/' });
  await page.locator('footer.pie').getByRole('link', { name: 'Términos, cambios y retracto' }).click();
  await expect(page).toHaveURL(TIENDA + '/terminos/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Términos de la tienda, cambios y retracto');
  /* Y de vuelta a la tienda con el logo */
  await page.locator('.cab .logo').click();
  await expect(page).toHaveURL(TIENDA + '/');
});

test('«Mi cuenta» sin sesión lleva a entrar en /mi-cuenta/ del subdominio', async ({ page }) => {
  await abrirTienda(page, { ruta: TIENDA + '/' });
  await page.locator('.cab .btn-cuenta').click();
  await expect(page).toHaveURL(TIENDA + '/mi-cuenta/');
  await expect(page.getByRole('heading', { name: 'Entre a su cuenta' })).toBeVisible();
});

test('«Quiénes somos» lleva a la página principal, no al inicio de la tienda', async ({ page }) => {
  await abrirTienda(page, { ruta: TIENDA + '/' });
  await expect(page.locator('footer.pie').getByRole('link', { name: 'Quiénes somos' })).toHaveAttribute('href', 'https://www.plasticosespinal.com/');
});
