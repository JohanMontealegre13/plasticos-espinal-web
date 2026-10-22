/* Ayudas de las pruebas en navegador. */
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

/** Catálogo con la forma que devuelve el CRM (tienda_pedido.catalogo()): ocho productos, uno agotado. */
const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));

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
 * (catálogo de prueba, sin sesión, sin fotos) y la canasta empieza vacía porque
 * cada prueba trae su propio navegador limpio.
 * @param {import('@playwright/test').Page} page
 * @param {{ catalogo?: object, hora?: string, ruta?: string }} [op]
 *   catalogo: lo que responde el CRM (por omisión catalogo-crm.json);
 *   hora: instante fijo con zona, p. ej. '2026-10-22T10:00:00-05:00';
 *   ruta: por omisión '/tienda/'.
 */
export async function abrirTienda(page, op = {}) {
  await page.route('**/tienda/mi-cuenta/api/tienda/catalogo', (r) => r.fulfill({ json: op.catalogo || CATALOGO_CRM }));
  await page.route('**/tienda/mi-cuenta/api/yo', (r) => r.fulfill({ status: 401, json: { ok: false } }));
  await page.route('**/tienda/mi-cuenta/api/tienda/foto/**', (r) => r.fulfill({ status: 404 }));
  if (op.hora) await page.clock.setFixedTime(op.hora);
  await page.goto(op.ruta || '/tienda/');
  await expect(page.locator('#grilla li').first()).toBeVisible();
}
