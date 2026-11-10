/* La tienda en su subdominio (tienda.plasticosespinal.com, decisión de Johan del 10-nov-2026).
   El servidor de pruebas lo imita en tienda.localhost con las mismas reglas del middleware
   (rutaDe de functions/_middleware.js): «/» sale de tienda/, sin /tienda/ en la dirección. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, sitioDe, sinSesion, CATALOGO_CRM, CUENTA } from './ayudas.js';

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

test('sin sesión, la tienda manda a la entrada en /mi-cuenta/ del subdominio y al entrar vuelve al mismo producto', async ({ page }) => {
  let entro = false;
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/tienda/mi-cuenta/api/', '');
    if (ruta === 'tienda/catalogo') return r.fulfill({ json: entro ? CATALOGO_CRM : sinSesion() });
    if (ruta === 'entrar') { entro = true; return r.fulfill({ json: { ok: true, nombre: 'Ana', estado: 'activa' } }); }
    if (ruta === 'yo' && entro) return r.fulfill({ json: CUENTA });
    return r.fulfill({ status: ruta === 'yo' ? 401 : 404, json: { ok: false } });
  });
  await page.goto(TIENDA + '/#p=141');
  await expect(page).toHaveURL(TIENDA + '/mi-cuenta/#p=141');
  await expect(page.getByRole('link', { name: 'Crear mi cuenta' })).toBeVisible();
  /* Los términos se leen sin cuenta, en su dirección limpia */
  await expect(page.locator('footer').getByRole('link', { name: 'Términos, cambios y retracto' })).toHaveJSProperty('href', TIENDA + '/terminos/');
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await page.fill('#usuario', '1105678901');
  await page.fill('#clave', 'una-clave-larga');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#ficha')).toContainText('Contenedor icopor J1 x25 und');
  expect(new URL(page.url()).origin + new URL(page.url()).pathname).toBe(TIENDA + '/');
});

test('«Salir de mi cuenta» deja en la entrada del subdominio', async ({ page }) => {
  let entro = true;
  await abrirTienda(page, { ruta: TIENDA + '/' });
  await page.route('**/tienda/mi-cuenta/api/yo', (r) => (entro ? r.fulfill({ json: CUENTA }) : r.fulfill({ status: 401, json: { ok: false } })));
  await page.route('**/tienda/mi-cuenta/api/salir', (r) => { entro = false; return r.fulfill({ json: { ok: true } }); });
  await page.locator('.cab .btn-cuenta').click();
  await page.getByRole('button', { name: 'Salir de mi cuenta' }).click();
  await expect(page).toHaveURL(TIENDA + '/mi-cuenta/#entrar');
  await expect(page.getByRole('heading', { name: 'Entre a su cuenta' })).toBeVisible();
});

test('«Quiénes somos» lleva a la página principal, no al inicio de la tienda', async ({ page }) => {
  await abrirTienda(page, { ruta: TIENDA + '/' });
  await expect(page.locator('footer.pie').getByRole('link', { name: 'Quiénes somos' })).toHaveAttribute('href', 'https://www.plasticosespinal.com/');
});
