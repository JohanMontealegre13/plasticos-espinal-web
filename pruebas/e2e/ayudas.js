/* Ayudas de las pruebas en navegador. */
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

/** Catálogo con la forma que devuelve el CRM (tienda_pedido.catalogo()): ocho productos, uno agotado. */
const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));

const fijo = (/** @type {string} */ nombre) => JSON.parse(readFileSync(new URL(`../unit/fixtures/${nombre}`, import.meta.url), 'utf8'));
/**
 * Lo de tienda/catalogo.json que Johan cambia a mano, congelado con los valores del 22-oct-2026: las pruebas
 * en navegador nunca dependen de lo que diga hoy el archivo de verdad (que esté bien escrito lo revisa
 * unit/catalogo.test.mjs). El resto del archivo (pago, fotos de las categorías) sí sale del de verdad.
 */
export const SITIO_FIJO = Object.freeze({
  whatsapp: '573183555246',
  horario: fijo('horario.json'),
  sinonimos: fijo('sinonimos.json'),
  entrega: { tienda: { lat: 4.1525081, lng: -74.8828245 }, radio_km: 8 },
  vendedor: { nombre: '', documento: '', direccion: 'Calle 7 #5-35, Centro, El Espinal, Tolima', telefono: '318 355 5246', correo: '' },
});
const SITIO_REAL = new URL('../../tienda/catalogo.json', import.meta.url);

/**
 * Responde /tienda/catalogo.json con el de verdad y encima SITIO_FIJO. Con `cambiar`, la prueba recibe esa
 * copia y la cambia en su lugar; si `cambiar` devuelve algo, eso es la respuesta (opciones de route.fulfill,
 * p. ej. `() => ({ status: 500, body: 'no' })`).
 * Para la tienda no se llama a mano: se le pasa a abrirTienda como `sitio` (una ruta propia de catalogo.json
 * registrada antes de abrirTienda quedaría tapada por la de abrirTienda, que se registra después).
 * @param {import('@playwright/test').Page} page
 * @param {(sitio: any) => any} [cambiar]
 */
export async function sitioDe(page, cambiar) {
  await page.route('**/tienda/catalogo.json', (r) => {
    let real = {};
    try { real = JSON.parse(readFileSync(SITIO_REAL, 'utf8')); } catch { /* roto: lo dice unit/catalogo.test.mjs */ }
    const sitio = { ...real, ...structuredClone(SITIO_FIJO) };
    const otra = cambiar ? cambiar(sitio) : undefined;
    return r.fulfill(otra === undefined ? { json: sitio } : otra);
  });
}

/**
 * Anota todo lo que sale mal en la página: errores de JS, avisos de la CSP,
 * recursos propios que no cargan. Al final de la prueba se exige que esté vacío.
 * @param {import('@playwright/test').Page} page
 */
export function vigilar(page) {
  /** @type {string[]} */
  const problemas = [];
  page.on('pageerror', (e) => problemas.push('JS: ' + e.message));
  page.on('console', (m) => {
    /* Los recursos que no cargan ya se anotan abajo con su dirección */
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problemas.push('consola: ' + m.text());
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    /* Las respuestas de la API (401 sin sesión, 400 código malo) son parte del contrato y se prueban aparte */
    if (u.hostname === '127.0.0.1' && r.status() >= 400 && r.request().resourceType() !== 'document' && !u.pathname.includes('/api/')) {
      problemas.push(`${r.status()} ${u.pathname}`);
    }
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.hostname === '127.0.0.1') problemas.push(`falló ${u.pathname}: ${r.failure()?.errorText}`);
  });
  return {
    problemas,
    sinProblemas: () => expect(problemas, 'la página tuvo errores').toEqual([]),
  };
}

/**
 * Abre la tienda como la vería alguien que llega sin cuenta: el CRM se simula
 * (catálogo de prueba, sin sesión, sin fotos), tienda/catalogo.json lleva los valores
 * congelados de SITIO_FIJO y la canasta empieza vacía porque cada prueba trae su
 * propio navegador limpio.
 * @param {import('@playwright/test').Page} page
 * @param {{ catalogo?: object, hora?: string, ruta?: string, sitio?: (sitio: any) => any }} [op]
 *   catalogo: lo que responde el CRM (por omisión catalogo-crm.json);
 *   hora: instante fijo con zona, p. ej. '2026-10-22T10:00:00-05:00';
 *   ruta: por omisión '/tienda/';
 *   sitio: cambia tienda/catalogo.json para esta prueba (ver sitioDe).
 */
export async function abrirTienda(page, op = {}) {
  await sitioDe(page, op.sitio);
  await page.route('**/tienda/mi-cuenta/api/tienda/catalogo', (r) => r.fulfill({ json: op.catalogo || CATALOGO_CRM }));
  await page.route('**/tienda/mi-cuenta/api/yo', (r) => r.fulfill({ status: 401, json: { ok: false } }));
  await page.route('**/tienda/mi-cuenta/api/tienda/foto/**', (r) => r.fulfill({ status: 404 }));
  if (op.hora) await page.clock.setFixedTime(op.hora);
  await page.goto(op.ruta || '/tienda/');
  await expect(page.locator('#grilla li').first()).toBeVisible();
}

/**
 * Llena los datos de entrega de la canasta (el formulario ya tiene que estar a la vista):
 * Ana Prueba, CC 1105678901, celular 3001234567, barrio Belén, «Calle 1 # 2-3» y la autorización marcada.
 * No toca «Indicaciones», para que cada prueba escriba las suyas.
 * @param {import('@playwright/test').Page} page
 */
export async function llenarDatos(page) {
  await page.locator('#d-nombre').fill('Ana Prueba');
  await page.locator('#d-doc').fill('1105678901');
  await page.locator('#d-cel').fill('3001234567');
  await page.locator('#d-barrio').fill('Belén');
  await page.locator('#d-dir').fill('Calle 1 # 2-3');
  await page.locator('#d-acepto').check();
}
