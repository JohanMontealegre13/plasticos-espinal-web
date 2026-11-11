/* Pantalla del QR Bre-B. En el computador se escanea el código con el celular; en el celular el código está en
   la misma pantalla y no se puede escanear, así que allá manda la llave: se copia y se pega en la app del banco,
   y el QR queda abajo para guardarlo. El valor también se copia, sin puntos, para pegarlo tal cual. */
import { test, expect } from '@playwright/test';
import { abrirTienda, llenarDatos, vigilar, abrirCanasta } from './ayudas.js';

const PRODUCTO = 'Agregar Contenedor icopor J1 x25 und a la canasta';
const PEDIDO = { codigo: 'PE-ABCDE', secreto: 's', estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', medio: '', total: 13800 };
const LLAVE = '0030658363';

/** Hasta la pantalla del QR con un pedido de $13.800; el CRM se simula. */
async function hastaElQr(/** @type {import('@playwright/test').Page} */ page, /** @type {any} */ op = {}) {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', (r) => r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } }));
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/*', (r) => r.fulfill({ json: { ok: true, ...PEDIDO } }));
  await abrirTienda(page, { sitio: (s) => { s.pago = { qr: '/tienda/img/qr-breb-bancolombia.png', llave: LLAVE }; }, ...op });
  await page.locator('#grilla').getByRole('button', { name: PRODUCTO }).click();
  await abrirCanasta(page);
  await page.locator('#seguir').click();
  await llenarDatos(page);
  await page.locator('#enviar').click();
  await page.locator('.medio[data-medio="qr"]').click();
  await expect(page.locator('#pqr')).toBeVisible();
  await expect(page.locator('#qrTotal')).toHaveText('$13.800');
}

test('cada equipo ve los pasos que puede hacer: escanear en el computador, la llave en el celular', async ({ page }, info) => {
  const v = vigilar(page);
  await hastaElQr(page);
  await expect(page.locator('#qrLlaveNum')).toHaveText(LLAVE);
  await expect(page.locator('#copiarLlave')).toBeVisible();
  await expect(page.locator('#qrImg')).toBeVisible();
  /* El recuadro no aplasta el código aunque la pantalla pase de alto: se baja con el dedo */
  await page.waitForFunction(() => /** @type {HTMLImageElement} */ (document.getElementById('qrImg')).complete);
  const caja = await page.locator('#qrCaja').boundingBox();
  const imagen = await page.locator('#qrImg').boundingBox();
  expect(caja && imagen && caja.height >= imagen.height).toBe(true);
  const llave = await page.locator('#qrLlave').boundingBox();
  const qr = await page.locator('#qrCaja').boundingBox();
  if (info.project.name === 'celular') {
    await expect(page.locator('#pqr')).toHaveClass(/celular/);
    await expect(page.locator('#pasosCelu')).toBeVisible();
    await expect(page.locator('#pasosCompu')).toBeHidden();
    await expect(page.locator('#guardarQr')).toBeVisible();
    await expect(page.locator('#guardarQr')).toHaveAttribute('href', '/tienda/img/qr-breb-bancolombia.png');
    await expect(page.locator('#guardarQr')).toHaveAttribute('download', /\.png$/);
    /* La llave va antes que el código: es lo que se usa en el celular */
    expect(llave && qr && llave.y < qr.y).toBe(true);
  } else {
    /* En el computador manda el código */
    expect(llave && qr && qr.y < llave.y).toBe(true);
    await expect(page.locator('#pqr')).not.toHaveClass(/celular/);
    await expect(page.locator('#pasosCompu')).toBeVisible();
    await expect(page.locator('#pasosCelu')).toBeHidden();
    await expect(page.locator('#guardarQr')).toBeHidden();
  }
  v.sinProblemas();
});

test('copiar la llave y el valor los deja en el portapapeles, el valor sin puntos', async ({ page, context }) => {
  const v = vigilar(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await hastaElQr(page);
  await page.locator('#copiarLlave').click();
  await expect(page.locator('#copiarLlave')).toHaveText('¡Copiado!');
  await expect(page.locator('#copiado')).toHaveText(`Llave copiada: ${LLAVE}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LLAVE);
  await page.locator('#copiarValor').click();
  await expect(page.locator('#copiado')).toHaveText('Valor copiado: 13800');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('13800');
  /* El botón vuelve a su texto */
  await expect(page.locator('#copiarLlave')).toHaveText('Copiar llave', { timeout: 4000 });
  v.sinProblemas();
});

test('si el navegador no deja copiar, dice cómo copiarla a mano', async ({ page }) => {
  const v = vigilar(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } });
    document.execCommand = () => false;
  });
  await hastaElQr(page);
  await page.locator('#copiarLlave').click();
  await expect(page.locator('#copiado')).toHaveText(`No se pudo copiar. Mantenga el dedo sobre ${LLAVE} para copiarlo.`);
  await expect(page.locator('#copiarLlave')).toHaveText('Copiar llave');
  v.sinProblemas();
});

test('sin llave en catalogo.json, el celular sigue con el código y los pasos de siempre', async ({ page }) => {
  const v = vigilar(page);
  await hastaElQr(page, { sitio: (/** @type {any} */ s) => { s.pago = { qr: '/tienda/img/qr-breb-bancolombia.png' }; } });
  await expect(page.locator('#qrLlave')).toBeHidden();
  await expect(page.locator('#pasosCompu')).toBeVisible();
  await expect(page.locator('#pasosCelu')).toBeHidden();
  await expect(page.locator('#guardarQr')).toBeHidden();
  v.sinProblemas();
});

test('la llave dice a nombre de quién le sale al cliente en su banco; sin titular no se inventa', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', (r) => r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } }));
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/*', (r) => r.fulfill({ json: { ok: true, ...PEDIDO } }));
  await abrirTienda(page, { sitio: (s) => { s.pago = { qr: '/tienda/img/qr-breb-bancolombia.png', llave: LLAVE, titular: 'Plásticos Espinal' }; } });
  await page.locator('#grilla').getByRole('button', { name: PRODUCTO }).click();
  await abrirCanasta(page);
  await page.locator('#seguir').click();
  await llenarDatos(page);
  await page.locator('#enviar').click();
  await page.locator('.medio[data-medio="qr"]').click();
  await expect(page.locator('#qrTitular')).toHaveText('Le sale a nombre de Plásticos Espinal');
});

test('sin titular la línea no sale', async ({ page }) => {
  await hastaElQr(page);
  await expect(page.locator('#qrTitular')).toBeHidden();
});

test('la franja del pedido se ve unos segundos al volver a la tienda y se va', async ({ page }) => {
  await page.clock.install();
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/*', (r) => r.fulfill({ json: { ok: true, ...PEDIDO } }));
  await page.addInitScript((p) => { localStorage.setItem('pe-pedido-v1', JSON.stringify(p)); }, PEDIDO);
  await abrirTienda(page);
  await expect(page.locator('#avisoPedido')).toBeVisible();
  await expect(page.locator('#avisoTexto')).toHaveText('PE-ABCDE · Pedido por confirmar');
  await page.clock.runFor(11000);
  await expect(page.locator('#avisoPedido')).toBeHidden();
});
