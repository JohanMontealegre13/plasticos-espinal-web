/* Seguimiento del pedido de la tienda: una escena en video por estado (hecha con Higgsfield; sin video o con
   menos movimiento, el ícono), lo que pidió y cada novedad con su hora, como texto del CRM. «Mis pedidos»
   lo muestra arriba mientras va en curso y al tocarlo abre el seguimiento sobre la tienda. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const PEDIDO = {
  ok: true, codigo: 'PE-ABCDE', secreto: 'secreto-de-prueba-123', estado: 'POR_ALISTAR', titulo: 'Pedido confirmado',
  detalle: 'Lo estamos alistando. Le avisamos cuando salga.', medio: 'efectivo', total: 13800, paga_con: 0, final: false,
  lineas: [{ nombre: 'Vaso <b>8 oz</b> x50 und', cantidad: 2 }, { nombre: 'Plato 23 cm', cantidad: 1 }],
  novedades: [{ hora: '2026-11-11T08:05', texto: 'Recibimos su pedido' }, { hora: '2026-11-11T08:20', texto: 'La tienda confirmó su pedido y lo está alistando' }],
};

/** @param {import('@playwright/test').Page} page @param {any} [pedido] */
async function conPedido(page, pedido = PEDIDO) {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/*', (r) => r.fulfill({ json: pedido }));
  await page.route('**/tienda/img/pedido/**', (r) => r.fulfill({ status: 404 }));
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify(p)); }, pedido);
}

test('el seguimiento muestra la escena del estado, lo que pidió y cada novedad con su hora', async ({ page }) => {
  const v = vigilar(page);
  await conPedido(page);
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#final')).toBeVisible();
  await expect(page.locator('#fVideo')).toHaveAttribute('src', '/tienda/img/pedido/alistando.mp4');
  /* El video no cargó (aquí no existe): queda el ícono */
  await expect(page.locator('#fIcono')).toBeVisible();
  await expect(page.locator('#fLineas li')).toHaveText(['2 ×Vaso <b>8 oz</b> x50 und', '1 ×Plato 23 cm']);
  await expect(page.locator('#fNovedades li span')).toHaveText(['Recibimos su pedido', 'La tienda confirmó su pedido y lo está alistando']);
  await expect(page.locator('#fNovedades li time').first()).toHaveText(/8:05/);
  expect(v.problemas.filter((p) => !p.includes('/tienda/img/pedido/'))).toEqual([]);
});

test('con menos movimiento no hay video: queda el ícono', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await conPedido(page);
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#fIcono')).toBeVisible();
  await expect(page.locator('#fVideo')).toBeHidden();
  await expect(page.locator('#fVideo')).not.toHaveAttribute('src', /mp4/);
});

test('cada estado tiene su escena', async ({ page }) => {
  await conPedido(page, { ...PEDIDO, estado: 'EN_CAMINO', titulo: 'Va en camino' });
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#fVideo')).toHaveAttribute('src', '/tienda/img/pedido/en-camino.mp4');
});

test('«Mis pedidos» muestra arriba el pedido en curso y al tocarlo abre su seguimiento', async ({ page }) => {
  await conPedido(page);
  await page.route('**/tienda/mi-cuenta/api/pedidos', (r) => r.fulfill({ json: { ok: true, pedidos: [] } }));
  await abrirTienda(page, { ruta: '/tienda/#cuenta=' + encodeURIComponent('/tienda/mi-cuenta/pedidos/') });
  const m = page.frameLocator('iframe.vc-marco');
  const enCurso = m.locator('.en-curso');
  await expect(enCurso).toContainText('Preparándose');
  await expect(enCurso).toContainText('PE-ABCDE');
  await enCurso.click();
  await expect(page.locator('iframe.vc-marco')).toHaveCount(0);
  await expect(page.locator('#final')).toBeVisible();
  await expect(page.locator('#fTitulo')).toHaveText('Pedido confirmado');
});
