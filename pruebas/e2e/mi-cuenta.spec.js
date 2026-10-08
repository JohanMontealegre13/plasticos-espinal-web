/* Portal del cliente (/tienda/mi-cuenta/) en Chromium, con el intermediario simulado.
   El intermediario real tiene sus pruebas en unit/mi-cuenta.test.mjs. */
import { test, expect } from '@playwright/test';
import { vigilar } from './ayudas.js';

const YO = { ok: true, nombre: 'Ana <b>Pérez</b>', tipo_documento: 'CC', documento: '1105678901', celular: '318 355 5246', correo: 'ana@ejemplo.com', municipio: 'El Espinal', barrio: 'El Centro', direccion: 'Calle 7 # 5-35', indicaciones: '' };
const PEDIDOS = { ok: true, pedidos: [
  { id: 12, numero: 'FE-0012', fecha: '2026-10-01T10:00:00-05:00', canal: 'Domicilio', total: 61000, por_pagar: false, entrega: 'Entregado' },
] };
const PEDIDO = { ok: true, id: 12, numero: 'FE-0012', fecha: '2026-10-01T10:00:00-05:00', canal: 'Domicilio', forma_pago: 'Bre-B', total: 61000, descuento: 0, lineas: [{ producto: 'Vaso grande', cantidad: 2, valor: 57000 }], tiene_recibo: true };

/**
 * Simula el intermediario: con sesión responde datos, sin sesión 401.
 * @param {import('@playwright/test').Page} page
 * @param {{ sesion?: boolean }} [o]
 */
async function api(page, o = {}) {
  /** @type {string[]} */
  const llamadas = [];
  let sesion = !!o.sesion;
  await page.route('**/tienda/mi-cuenta/api/**', async (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/tienda/mi-cuenta/api/', '');
    llamadas.push(`${r.request().method()} ${ruta}`);
    if (ruta === 'entrar') return r.fulfill({ json: { ok: true } });
    if (ruta === 'codigo') {
      if (JSON.parse(r.request().postData() || '{}').codigo !== '123456') return r.fulfill({ status: 400, json: { ok: false, error: 'Código equivocado.' } });
      sesion = true;
      return r.fulfill({ json: { ok: true, nombre: 'Ana' } });
    }
    if (!sesion) return r.fulfill({ status: 401, json: { ok: false, error: 'Entre otra vez.' } });
    if (ruta === 'yo' || ruta === 'datos') return r.fulfill({ json: YO });
    if (ruta === 'pedidos') return r.fulfill({ json: PEDIDOS });
    if (ruta === 'pedidos/12') return r.fulfill({ json: PEDIDO });
    return r.fulfill({ status: 404, json: { ok: false, error: 'No existe.' } });
  });
  return llamadas;
}

test('entrar con documento, celular y código lleva a «Mis pedidos»', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await page.fill('#documento', '1105678901');
  await page.fill('#celular', '318 355 5246');
  await page.getByRole('button', { name: 'Pedir código' }).click();
  await expect(page.locator('#f-codigo')).toBeVisible();
  await page.fill('#codigo', '000000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-codigo')).toHaveText('Código equivocado.');
  await page.fill('#codigo', '123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/pedidos\/$/);
  await expect(page.locator('#lista')).toContainText('FE-0012');
  await expect(page.locator('#lista')).toContainText('$61.000');
  expect(llamadas).toContain('POST entrar');
  v.sinProblemas();
});

test('el formulario de entrada valida antes de llamar', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await page.fill('#documento', '12');
  await page.getByRole('button', { name: 'Pedir código' }).click();
  await expect(page.locator('#e-entrar')).toBeVisible();
  expect(llamadas).not.toContain('POST entrar');
});

for (const ruta of ['pedidos/', 'pedido/?id=12', 'datos/']) {
  test(`sin sesión, /tienda/mi-cuenta/${ruta} manda a entrar`, async ({ page }) => {
    await api(page);
    await page.goto('/tienda/mi-cuenta/' + ruta);
    await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/$/);
  });
}

test('una compra muestra sus líneas, total y el recibo por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true });
  await page.goto('/tienda/mi-cuenta/pedido/?id=12');
  await expect(page.locator('#titulo')).toHaveText('Compra FE-0012');
  await expect(page.locator('#detalle')).toContainText('Vaso grande');
  await expect(page.getByRole('link', { name: 'Ver recibo en PDF' })).toHaveAttribute('href', '/tienda/mi-cuenta/api/pedidos/12/recibo.pdf');
  v.sinProblemas();
});

test('«Mis datos» pinta lo del CRM como texto y guarda por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page, { sesion: true });
  await page.goto('/tienda/mi-cuenta/datos/');
  await expect(page.locator('#nombre')).toHaveValue('Ana <b>Pérez</b>');
  await expect(page.locator('#v-correo')).toHaveText('ana@ejemplo.com');
  await page.fill('#barrio', '  Fátima  ');
  await page.locator('#f-datos button[type=submit], #f-datos button').first().click();
  await expect(page.locator('#ok-datos')).toBeVisible();
  expect(llamadas).toContain('POST datos');
  v.sinProblemas();
});

test('si el CRM no responde, el portal lo dice y no se queda cargando', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/**', (r) => r.fulfill({ status: 502, json: { ok: false, error: 'No pudimos traer sus datos. Intente más tarde o escríbanos por WhatsApp al 318 355 5246.' } }));
  await page.goto('/tienda/mi-cuenta/pedidos/');
  await expect(page.locator('#lista')).toContainText('318 355 5246');
});

test('ninguna petición del portal sale del propio sitio', async ({ page }) => {
  /** @type {string[]} */
  const fuera = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') fuera.push(u.hostname); });
  await api(page, { sesion: true });
  for (const ruta of ['', 'pedidos/', 'pedido/?id=12', 'datos/']) {
    await page.goto('/tienda/mi-cuenta/' + ruta);
    await page.waitForLoadState('networkidle');
  }
  expect(fuera).toEqual([]);
});
