/* Portal del cliente (/tienda/mi-cuenta/) en Chromium, con el intermediario simulado.
   Mis pedidos, una compra y Mis datos se ven SIEMPRE en una ventana encima de la tienda
   (menu.js): por eso esas pruebas abren /tienda/#cuenta=… y miran dentro del marco.
   El intermediario real tiene sus pruebas en unit/mi-cuenta.test.mjs. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { vigilar, sitioDe } from './ayudas.js';

const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
const YO = { ok: true, nombre: 'Ana <b>Pérez</b>', estado: 'activa', tipo_documento: 'CC', documento: '1105678901', celular: '318 355 5246', correo: 'ana@ejemplo.com', municipio: 'El Espinal', barrio: 'El Centro', direccion: 'Calle 7 # 5-35', indicaciones: '' };
const PEDIDOS = { ok: true, pedidos: [
  { id: 12, numero: 'FE-0012', fecha: '2026-10-01 10:00', canal: 'Domicilio', total: 61000, por_pagar: false, entrega: 'Entregado' },
] };
const PEDIDO = { ok: true, id: 12, numero: 'FE-0012', fecha: '2026-10-01 10:00', canal: 'Domicilio', forma_pago: 'Bre-B', total: 61000, descuento: 0, lineas: [{ producto: 'Vaso grande', cantidad: 2, valor: 57000 }], tiene_recibo: true };
const CLAVE_BUENA = 'una-clave-larga';

/**
 * Simula el intermediario: con sesión responde datos, sin sesión 401. Entrar pide la contraseña
 * buena; crear cuenta pasa por el código del WhatsApp (123456) antes de poner la contraseña.
 * @param {import('@playwright/test').Page} page
 * @param {{ sesion?: boolean }} [o]
 */
async function api(page, o = {}) {
  /** @type {string[]} */
  const llamadas = [];
  let sesion = !!o.sesion;
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', async (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/tienda/mi-cuenta/api/', '');
    const cuerpo = JSON.parse(r.request().postData() || '{}');
    llamadas.push(`${r.request().method()} ${ruta}`);
    if (ruta === 'tienda/catalogo') return r.fulfill({ json: CATALOGO_CRM });
    if (ruta.startsWith('tienda/foto/')) return r.fulfill({ status: 404 });
    if (ruta === 'entrar') {
      if (cuerpo.clave !== CLAVE_BUENA) return r.fulfill({ status: 401, json: { ok: false, error: 'Cédula, celular o contraseña equivocados.' } });
      sesion = true;
      return r.fulfill({ json: { ok: true, nombre: 'Ana', estado: 'activa' } });
    }
    if (ruta === 'registro') return r.fulfill({ json: { ok: true, modo: 'enviar_codigo' } });
    if (ruta === 'verificar') {
      if (cuerpo.codigo !== '123456') return r.fulfill({ status: 400, json: { ok: false, error: 'Código equivocado.' } });
      return r.fulfill({ json: { ok: true, listo: true } });
    }
    if (ruta === 'clave') { sesion = true; return r.fulfill({ json: { ok: true, nombre: 'Ana', estado: 'activa' } }); }
    if (!sesion) return r.fulfill({ status: 401, json: { ok: false, error: 'Entre otra vez.' } });
    if (ruta === 'yo' || ruta === 'datos') return r.fulfill({ json: YO });
    if (ruta === 'pedidos') return r.fulfill({ json: PEDIDOS });
    if (ruta === 'pedidos/12') return r.fulfill({ json: PEDIDO });
    return r.fulfill({ status: 404, json: { ok: false, error: 'No existe.' } });
  });
  return llamadas;
}

/** @param {import('@playwright/test').Page} page */
const marco = (page) => page.frameLocator('iframe.vc-marco');

/** @param {import('@playwright/test').Page} page @param {string} ruta lo que va después de /tienda/mi-cuenta/ */
const abrirEnVentana = (page, ruta) => page.goto('/tienda/#cuenta=' + encodeURIComponent('/tienda/mi-cuenta/' + ruta));

test('entrar con cédula y contraseña lleva a «Mis pedidos», encima de la tienda', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await page.fill('#usuario', '1105678901');
  await page.fill('#clave', 'otra-clave');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Cédula, celular o contraseña equivocados.');
  await page.fill('#clave', CLAVE_BUENA);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/tienda\/#cuenta=%2Ftienda%2Fmi-cuenta%2Fpedidos%2F$/);
  await expect(marco(page).locator('#lista')).toContainText('FE-0012');
  await expect(marco(page).locator('#lista')).toContainText('$61.000');
  expect(llamadas.filter((l) => l === 'POST entrar')).toHaveLength(2);
  v.sinProblemas();
});

test('crear cuenta: nombre, cédula y celular, el código del WhatsApp y la contraseña', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/#crear');
  await page.fill('#nombre', '  Ana   Pérez ');
  await page.fill('#documento', '1.105.678.901');
  await page.fill('#celular', '318 355 5246');
  const registro = page.waitForRequest('**/tienda/mi-cuenta/api/registro');
  await page.getByRole('button', { name: 'Seguir' }).click();
  expect((await registro).postDataJSON()).toEqual({ nombre: 'Ana Pérez', documento: '1105678901', celular: '3183555246' });
  await expect(page.locator('#f-codigo')).toBeVisible();
  await page.fill('#codigo', '000000');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.locator('#e-verificar')).toHaveText('Código equivocado.');
  await page.fill('#codigo', '123456');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.locator('#v-clave')).toBeVisible();
  await page.fill('#nueva', CLAVE_BUENA);
  await page.fill('#repetir', 'otra-cosa');
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(page.locator('#e-clave')).toHaveText('Las dos contraseñas no son iguales.');
  expect(llamadas).not.toContain('POST clave');
  await page.fill('#repetir', CLAVE_BUENA);
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(marco(page).locator('#lista')).toContainText('FE-0012');
});

test('el formulario de entrada valida antes de llamar', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await page.fill('#usuario', '12');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Escriba su cédula o su celular.');
  await page.fill('#usuario', '1105678901');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Escriba su contraseña.');
  expect(llamadas).not.toContain('POST entrar');
});

for (const ruta of ['pedidos/', 'pedido/?id=12', 'datos/']) {
  test(`sin sesión, /tienda/mi-cuenta/${ruta} abre la ventana en «Entre a su cuenta»`, async ({ page }) => {
    await api(page);
    await page.goto('/tienda/mi-cuenta/' + ruta);
    await expect(page).toHaveURL(/\/tienda\/#cuenta=/);
    await expect(marco(page).getByRole('heading', { name: 'Entre a su cuenta' })).toBeVisible();
  });
}

test('una compra muestra sus líneas, total y el recibo por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true });
  await abrirEnVentana(page, 'pedido/?id=12');
  const m = marco(page);
  await expect(m.locator('#titulo')).toHaveText('Compra FE-0012');
  await expect(m.locator('#detalle')).toContainText('Vaso grande');
  await expect(m.locator('#detalle')).toContainText('$61.000');
  await expect(m.getByRole('link', { name: 'Ver recibo en PDF' })).toHaveAttribute('href', '/tienda/mi-cuenta/api/pedidos/12/recibo.pdf');
  v.sinProblemas();
});

test('«Mis datos» pinta lo del CRM como texto y guarda por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page, { sesion: true });
  await abrirEnVentana(page, 'datos/');
  const m = marco(page);
  await expect(m.locator('#nombre')).toHaveValue('Ana <b>Pérez</b>');
  await expect(m.locator('#v-correo')).toHaveText('ana@ejemplo.com');
  await m.locator('#barrio').fill('  Fátima  ');
  const guardar = page.waitForRequest('**/tienda/mi-cuenta/api/datos');
  await m.locator('#f-datos button').first().click();
  expect((await guardar).postDataJSON()).toMatchObject({ barrio: 'Fátima' });
  await expect(m.locator('#ok-datos')).toBeVisible();
  expect(llamadas).toContain('POST datos');
  v.sinProblemas();
});

test('si el CRM no responde, el portal lo dice y no se queda cargando', async ({ page }) => {
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', (r) => r.fulfill({ status: 502, json: { ok: false, error: 'No pudimos traer sus datos. Intente más tarde o escríbanos por WhatsApp al 318 355 5246.' } }));
  await abrirEnVentana(page, 'pedidos/');
  await expect(marco(page).locator('#lista')).toContainText('318 355 5246');
});

test('ninguna petición del portal sale del propio sitio', async ({ page }) => {
  /** @type {string[]} */
  const fuera = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') fuera.push(u.hostname); });
  await api(page, { sesion: true });
  await page.goto('/tienda/mi-cuenta/');
  await page.waitForLoadState('networkidle');
  for (const ruta of ['pedidos/', 'pedido/?id=12', 'datos/']) {
    await abrirEnVentana(page, ruta);
    await page.waitForLoadState('networkidle');
  }
  expect(fuera).toEqual([]);
});
