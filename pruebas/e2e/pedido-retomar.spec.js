/* Retomar y cancelar un pedido de la tienda (pedido del dueño, 11-nov-2026).
   Si se sale de la pantalla del QR sin tocar «PAGO CONFIRMADO», el pedido queda «Por confirmar» sin pago:
   la franja se queda para volver, «Mis pedidos» lo abre desde cualquier equipo de la cuenta y se puede
   cancelar hasta que salga a repartir (eso lo decide el CRM con `puede_cancelar`). */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const PEDIDO = { codigo: 'PE-ABCDE', estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', medio: 'qr', pago_avisado: false,
  total: 13800, puede_cancelar: true, final: false, lineas: [], novedades: [] };

/** El CRM simulado: GET del pedido (con o sin secreto) y su cancelación. Devuelve lo que se pidió. */
async function crm(/** @type {import('@playwright/test').Page} */ page, /** @type {any} */ pedido = PEDIDO) {
  /** @type {string[]} */
  const llamadas = [];
  let actual = { ...pedido };
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/**', (r) => {
    const url = new URL(r.request().url()).pathname;
    llamadas.push(r.request().method() + ' ' + url.replace('/tienda/mi-cuenta/api/tienda/pedido/', ''));
    if (url.endsWith('/cancelar')) {
      actual = { ...actual, estado: 'NO_ENTREGADO', titulo: 'Pedido cancelado', detalle: 'Usted canceló este pedido.',
        cancelado: true, final: true, puede_cancelar: false };
    }
    r.fulfill({ json: { ok: true, ...actual } });
  });
  return llamadas;
}

test('con el pago a medias la franja se queda y al tocarla vuelve a escoger cómo pagar', async ({ page }) => {
  const v = vigilar(page);
  await page.clock.install();
  await crm(page);
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify({ ...p, secreto: 's' })); }, PEDIDO);
  await abrirTienda(page);
  await expect(page.locator('#avisoTexto')).toHaveText('PE-ABCDE · Falta terminar el pago');
  await page.clock.runFor(15000);
  await expect(page.locator('#avisoPedido')).toBeVisible();
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pago [data-cancelar]')).toBeVisible();
  await page.locator('.medio[data-medio="qr"]').click();
  await expect(page.locator('#pqr')).toBeVisible();
  v.sinProblemas();
});

test('un enlace #pedido=PE-… abre el pedido aunque este navegador no lo tenga guardado', async ({ page }) => {
  const llamadas = await crm(page);
  await abrirTienda(page, { ruta: '/tienda/#pedido=PE-ABCDE' });
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pCodigo')).toHaveText('PE-ABCDE');
  expect(llamadas).toContain('GET PE-ABCDE');
});

test('cancelar pregunta antes y deja el pedido cancelado', async ({ page }) => {
  const llamadas = await crm(page, { ...PEDIDO, medio: 'efectivo' });
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify({ ...p, secreto: 's' })); }, { ...PEDIDO, medio: 'efectivo' });
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#final')).toBeVisible();
  const boton = page.locator('#cancelarFinal');
  await expect(boton).toBeVisible();
  /* si dice que no, no pasa nada */
  page.once('dialog', (d) => d.dismiss());
  await boton.click();
  expect(llamadas.filter((l) => l.endsWith('/cancelar'))).toHaveLength(0);
  page.once('dialog', (d) => { expect(d.message()).toContain('PE-ABCDE'); d.accept(); });
  await boton.click();
  await expect(page.locator('#fTitulo')).toHaveText('Pedido cancelado');
  await expect(boton).toBeHidden();
  expect(llamadas).toContain('POST PE-ABCDE/cancelar');
});

test('ya en camino no se ofrece cancelar', async ({ page }) => {
  const enCamino = { ...PEDIDO, medio: 'efectivo', estado: 'EN_CAMINO', titulo: 'Va en camino', puede_cancelar: false };
  await crm(page, enCamino);
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify({ ...p, secreto: 's' })); }, enCamino);
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#final')).toBeVisible();
  await expect(page.locator('#cancelarFinal')).toBeHidden();
});

test('si el CRM no dice que se puede cancelar, el botón no sale', async ({ page }) => {
  const viejo = { ...PEDIDO };
  delete viejo.puede_cancelar;
  await crm(page, viejo);
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify({ ...p, secreto: 's' })); }, viejo);
  await abrirTienda(page);
  await page.locator('#avisoPedido').click();
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pago [data-cancelar]')).toBeHidden();
});
