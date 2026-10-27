/* Un tienda/catalogo.json mal escrito (Johan lo edita a mano) o que no carga no tumba la tienda: todo lo que trae es
   opcional (hora de llegada, sinónimos, WhatsApp, ubicación, fotos de las categorías), así que los productos salen,
   la cinta del pedido en curso y el enlace #p= siguen andando, y un pedido que el CRM recibió SIEMPRE llega al paso
   de pago (si no, el cliente lo pediría otra vez). Lo mismo si uno de los módulos de la tienda falla. */
import { test, expect } from '@playwright/test';
import { abrirTienda, llenarDatos, vigilar } from './ayudas.js';

const PRODUCTO = 'Agregar Contenedor icopor J1 x25 und a la canasta';
const HORA = '2026-10-22T10:00:00-05:00';   /* jueves: con el horario congelado llega hoy a las 11:00 */
const CON_HORA = '🛵 Llega hoy antes de las 11:00 a. m.';
const SIN_HORA = '🛵 Domicilio en El Espinal en menos de 1 hora';   /* el texto que trae la página */
const PEDIDO = { codigo: 'PE-ABCDE', secreto: 's', estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', medio: 'efectivo', total: 13800 };

/** Simula el CRM: cuenta los pedidos que le llegan y responde que llegó; en qué va un pedido, que sigue por confirmar. */
async function simularCrm(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {any[]} */
  const enviados = [];
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', async (r) => {
    enviados.push(r.request().postDataJSON());
    await r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } });
  });
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/*', (r) => r.fulfill({ json: { ok: true, ...PEDIDO } }));
  return enviados;
}

/** Canasta → datos → «Seguir al pago»: el pedido llega al CRM y se ve el paso de pago, una sola vez. */
async function pedir(/** @type {import('@playwright/test').Page} */ page, /** @type {any[]} */ enviados) {
  await page.getByRole('button', { name: PRODUCTO }).click();
  await page.locator('.btn-canasta').click();
  await page.locator('#seguir').click();
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pCodigo')).toHaveText('PE-ABCDE');
  await expect(page.locator('#errores')).toBeHidden();
  expect(enviados).toHaveLength(1);
}

/** [qué está mal, cómo queda catalogo.json, la franja de arriba] */
const DANADOS = [
  ['festivos es un objeto', (/** @type {any} */ s) => { s.horario.festivos = { '2026-11-02': true }; }, CON_HORA],
  ['festivos es un número', (/** @type {any} */ s) => { s.horario.festivos = 2026; }, CON_HORA],
  ['categorías no es una lista', (/** @type {any} */ s) => { s.categorias = { platos: '/img/productos/platos.webp' }; }, CON_HORA],
  ['una categoría vacía o sin nombre', (/** @type {any} */ s) => { s.categorias = [null, { nombre: 5 }, ...s.categorias]; }, CON_HORA],
  ['el archivo es null', () => ({ contentType: 'application/json', body: 'null' }), SIN_HORA],
  ['el archivo es una lista', () => ({ contentType: 'application/json', body: '[]' }), SIN_HORA],
  ['el JSON está roto', () => ({ contentType: 'application/json', body: '{"whatsapp": "5731' }), SIN_HORA],
  ['el archivo no carga (500)', () => ({ status: 500, body: 'no' }), SIN_HORA],
];

for (const [que, sitio, franja] of DANADOS) {
  test(`si ${que}, la tienda carga: productos, cinta del pedido y enlace #p=`, async ({ page }) => {
    const v = vigilar(page);
    await simularCrm(page);
    await page.addInitScript((p) => { if (!localStorage.getItem('pe-pedido-v1')) localStorage.setItem('pe-pedido-v1', JSON.stringify(p)); }, PEDIDO);
    await abrirTienda(page, { hora: HORA, ruta: '/tienda/#p=141', sitio: /** @type {any} */ (sitio) });
    await expect(page.locator('#estado')).toHaveText('');
    await expect(page.locator('#grilla li')).toHaveCount(3);
    await expect(page.locator('#franjaLlegada')).toHaveText(/** @type {string} */ (franja));
    await expect(page.locator('#avisoPedido')).toBeVisible();
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#fichaNombre')).toHaveText('Contenedor icopor J1 x25 und');
    /* Un 500 de catalogo.json se anota (lo piden tienda.js y vendedor.js); nada más puede salir mal */
    expect(v.problemas.filter((p) => !/^500 \/tienda\/catalogo\.json$/.test(p))).toEqual([]);
  });
}

test('con festivos mal escritos, un pedido que el CRM recibió llega al paso de pago (sin pedido doble)', async ({ page }) => {
  const v = vigilar(page);
  const enviados = await simularCrm(page);
  await abrirTienda(page, { hora: HORA, sitio: (s) => { s.horario.festivos = {}; } });
  await pedir(page, enviados);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pe-pedido-v1') || 'null')?.codigo)).toBe('PE-ABCDE');
  v.sinProblemas();
});

test('sin catalogo.json (JSON roto) también se pide hasta el pago', async ({ page }) => {
  const v = vigilar(page);
  const enviados = await simularCrm(page);
  await abrirTienda(page, { sitio: () => ({ contentType: 'application/json', body: '{roto' }) });
  await pedir(page, enviados);
  expect(enviados[0].indicaciones).toBe('Casa azul');
  v.sinProblemas();
});

test('si repintar la tienda falla justo después de que el CRM recibió el pedido, igual sale el paso de pago', async ({ page }) => {
  const v = vigilar(page);
  const enviados = await simularCrm(page);
  /* buscar.js de verdad, con ordenar() que se rompe cuando la prueba lo pide: la vitrina se repinta al vaciar la canasta */
  await page.route('**/tienda/buscar.js*', async (r) => {
    const real = await (await r.fetch()).text();
    await r.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: real + '\n;(function () { var P = window.PE, o = P.ordenar; P.ordenar = function () { if (window.__romper) throw new Error(\'ordenar roto\'); return o.apply(this, arguments); }; })();',
    });
  });
  await abrirTienda(page);
  await page.getByRole('button', { name: PRODUCTO }).click();
  await page.locator('.btn-canasta').click();
  await page.locator('#seguir').click();
  await llenarDatos(page);
  await page.evaluate(() => { /** @type {any} */ (window).__romper = true; });
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pCodigo')).toHaveText('PE-ABCDE');
  await expect(page.locator('#errores')).toBeHidden();
  expect(enviados).toHaveLength(1);
  v.sinProblemas();
});

/* Un módulo de la tienda que lanza en vez de responder: lo que da es un extra y la tienda sigue sin él */
const ROTOS = [
  ['llegada.js', "(window.PE = window.PE || {}).llegada = function () { throw new Error('llegada rota'); };"],
  ['guardados.js', "var P = window.PE = window.PE || {}; function roto() { throw new Error('guardados rotos'); }\n" +
    'P.guardado = function () { return { leer: roto, escribir: roto }; }; P.alFrente = roto; P.paraLaCanasta = roto;'],
  ['ubicacion.js', "var P = window.PE = window.PE || {}; function roto() { throw new Error('ubicación rota'); }\n" +
    'P.enlaceMapa = roto; P.distanciaKm = roto; P.entregaValida = roto; P.dentroDeEntrega = roto; P.unirIndicaciones = roto;'],
];

for (const [archivo, codigo] of ROTOS) {
  test(`si ${archivo} falla, la tienda carga y el pedido llega al pago`, async ({ page }) => {
    const v = vigilar(page);
    const enviados = await simularCrm(page);
    await page.route(`**/tienda/${archivo}*`, (r) => r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: codigo }));
    await abrirTienda(page, { hora: HORA });
    await expect(page.locator('#estado')).toHaveText('');
    await pedir(page, enviados);
    expect(enviados[0].indicaciones).toBe('Casa azul');
    v.sinProblemas();
  });
}
