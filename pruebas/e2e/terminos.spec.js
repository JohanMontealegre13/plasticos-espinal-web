/* Términos, cambios, retracto y quién vende (Ley 1480 de 2011): el pie de cada página dice quién vende con los
   datos de tienda/catalogo.json, la página de términos tiene sus nueve secciones y el formulario de entrega
   avisa que pedir es aceptarlos. */
import { test, expect } from '@playwright/test';
import { abrirTienda, llenarDatos, sitioDe, vigilar } from './ayudas.js';

const PRODUCTO = 'Agregar Contenedor icopor J1 x25 und a la canasta';
const ANA = { nombre: 'Ana Prueba', documento: 'NIT 900.000.000-1', direccion: 'Calle 7 #5-35', telefono: '318 355 5246', correo: 'hola@ejemplo.co' };
const LINEA_ANA = 'Vende: Ana Prueba · NIT 900.000.000-1 · Calle 7 #5-35 · 318 355 5246 · hola@ejemplo.co';
/** Lo que falta de llenar hoy (nombre, documento, correo), pero con otra dirección y otro teléfono: ninguna prueba depende de los valores reales de catalogo.json. */
const A_MEDIAS = { nombre: '', documento: '', direccion: 'Carrera 9 #1-2, Barrio Prueba', telefono: '300 000 0000', correo: '' };
/** El texto de respaldo que trae la página de términos (el mismo de la política de datos) */
const RESPALDO_DIRECCION = 'Calle 7 #5-35, Centro, El Espinal, Tolima';

/** Pone en tienda/catalogo.json el `vendedor` de la prueba (o lo quita con `null`): para abrirTienda({ sitio }) o sitioDe. */
const conVendedor = (/** @type {object | null} */ vendedor) => (/** @type {any} */ sitio) => {
  if (vendedor === null) delete sitio.vendedor; else sitio.vendedor = vendedor;
};
/** Para las páginas que no son la tienda (términos, política de datos). */
const vendedorDe = (/** @type {import('@playwright/test').Page} */ page, /** @type {object | null} */ vendedor) => sitioDe(page, conVendedor(vendedor));

test('el pie dice quién vende con los datos de catalogo.json', async ({ page }) => {
  await abrirTienda(page, { sitio: conVendedor(ANA) });
  await expect(page.locator('.pie [data-vendedor-linea]')).toHaveText(LINEA_ANA);
  await page.locator('.pie').getByRole('link', { name: 'Términos, cambios y retracto' }).click();
  await expect(page.locator('[data-vendedor="nombre"]')).toHaveText('Ana Prueba');
});

test('sin el nombre del vendedor el pie no muestra una línea a medias', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { sitio: conVendedor(A_MEDIAS) });   /* sin nombre no hay «Vende: …», aunque haya dirección y teléfono */
  await expect(page.locator('.pie [data-vendedor-linea]')).toBeHidden();
  await expect(page.locator('.pie [data-vendedor-linea]')).toHaveText('');
  await expect(page.locator('.pie').getByRole('link', { name: 'Términos, cambios y retracto' })).toBeVisible();
  v.sinProblemas();
});

test('la política de datos también dice quién vende y lleva el enlace a los términos', async ({ page }) => {
  const v = vigilar(page);
  await vendedorDe(page, ANA);
  await page.goto('/tienda/privacidad/');
  await expect(page.locator('.pie [data-vendedor-linea]')).toHaveText(LINEA_ANA);
  await page.locator('.pie').getByRole('link', { name: 'Términos, cambios y retracto' }).click();
  await expect(page).toHaveURL(/\/tienda\/terminos\/$/);
  v.sinProblemas();
});

test('los términos traen las nueve secciones, el retracto de 5 días hábiles y el enlace a la Superintendencia', async ({ page }) => {
  const v = vigilar(page);
  await page.goto('/tienda/terminos/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    '1. Quién vende', '2. Precios', '3. Domicilio', '4. Tiempos', '5. Pagos', '6. Cambios y garantía',
    '7. Derecho de retracto', '8. Reversión del pago', '9. Peticiones, quejas y reclamos',
  ]);
  await expect(page.locator('main')).toContainText('5 días hábiles');
  await expect(page.locator('main')).not.toContainText(/Chicoral/i);
  const sic = page.getByRole('link', { name: /sic\.gov\.co/ });
  await expect(sic).toHaveAttribute('href', 'https://www.sic.gov.co');
  await expect(sic).toHaveAttribute('rel', /noopener/);
  v.sinProblemas();
});

test('los términos pintan los datos del vendedor, cada uno con su etiqueta', async ({ page }) => {
  await vendedorDe(page, ANA);
  await page.goto('/tienda/terminos/');
  await expect(page.locator('[data-vendedor="nombre"]')).toHaveText('Ana Prueba');
  await expect(page.locator('[data-vendedor="documento"]')).toHaveText('Documento: NIT 900.000.000-1');
  await expect(page.locator('[data-vendedor="direccion"]').first()).toHaveText('Dirección: Calle 7 #5-35');
  await expect(page.locator('[data-vendedor="telefono"]')).toHaveText('Teléfono y WhatsApp: 318 355 5246');
  await expect(page.locator('[data-vendedor="correo"]').first()).toHaveText('Correo: hola@ejemplo.co');
});

test('un dato que falta se esconde con su etiqueta: nunca queda «Documento:» sin nada', async ({ page }) => {
  const v = vigilar(page);
  await vendedorDe(page, A_MEDIAS);                      /* nombre, documento y correo vacíos */
  await page.goto('/tienda/terminos/');
  await expect(page.locator('[data-vendedor="direccion"]').first()).toHaveText('Dirección: Carrera 9 #1-2, Barrio Prueba');
  await expect(page.locator('[data-vendedor="telefono"]')).toHaveText('Teléfono y WhatsApp: 300 000 0000');
  for (const campo of ['nombre', 'documento', 'correo']) {
    for (const nodo of await page.locator(`[data-vendedor="${campo}"]`).all()) await expect(nodo).toBeHidden();
  }
  await expect(page.locator('main')).not.toContainText(/Documento:|Correo:|Por correo:/);
  v.sinProblemas();
});

test('la dirección de respaldo se reemplaza con la de catalogo.json, no se duplica', async ({ page }) => {
  await vendedorDe(page, A_MEDIAS);
  await page.goto('/tienda/terminos/');
  await expect(page.locator('[data-vendedor="direccion"]').first()).toHaveText('Dirección: Carrera 9 #1-2, Barrio Prueba');
  await expect(page.locator('main')).not.toContainText(RESPALDO_DIRECCION);
  await expect(page.locator('main')).not.toContainText('318 355 5246');
  /* en cada lugar sale una sola vez: sección 1 y mostrador de la sección 9 */
  expect((await page.locator('main').innerText()).split('Carrera 9 #1-2, Barrio Prueba').length - 1).toBe(2);
});

test('si catalogo.json no carga, los términos se leen igual y no hay errores de JavaScript', async ({ page }) => {
  /** @type {string[]} */
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.route('**/tienda/catalogo.json', (r) => r.fulfill({ status: 500, body: 'no' }));
  await page.goto('/tienda/terminos/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
  await expect(page.locator('.pie [data-vendedor-linea]')).toBeHidden();
  await page.waitForLoadState('networkidle');
  expect(errores).toEqual([]);
  /* la sección 1 nunca queda vacía: la dirección y el WhatsApp de la tienda se ven con el texto de respaldo */
  const seccion1 = page.locator('ul.vende');
  await expect(seccion1).toBeVisible();
  await expect(seccion1).toContainText(`Dirección: ${RESPALDO_DIRECCION}`);
  await expect(seccion1.getByRole('link', { name: '318 355 5246' })).toHaveAttribute('href', 'https://wa.me/573183555246');
  await expect(page.locator('main')).toContainText(`En el mostrador: ${RESPALDO_DIRECCION}`);
});

test('sin JavaScript la sección 1 sigue diciendo dónde queda la tienda y cómo escribirle', async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexto.newPage();
  await page.goto('/tienda/terminos/');
  const seccion1 = page.locator('ul.vende');
  await expect(seccion1).toBeVisible();
  await expect(seccion1).toContainText(`Dirección: ${RESPALDO_DIRECCION}`);
  await expect(seccion1.getByRole('link', { name: '318 355 5246' })).toBeVisible();
  /* lo que no se sabe hoy no aparece como etiqueta suelta */
  await expect(page.locator('main')).not.toContainText(/Documento:|Correo:|Por correo:/);
  await contexto.close();
});

test('si catalogo.json no trae «vendedor», no se rompe nada', async ({ page }) => {
  const v = vigilar(page);
  await vendedorDe(page, null);
  await page.goto('/tienda/terminos/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.pie [data-vendedor-linea]')).toBeHidden();
  await expect(page.locator('ul.vende')).toContainText(`Dirección: ${RESPALDO_DIRECCION}`);
  v.sinProblemas();
});

test('«Seguir al pago» avisa que pedir es aceptar los términos, y el enlace se abre aparte sin perder el pedido', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await page.getByRole('button', { name: PRODUCTO }).click();
  await page.locator('.btn-canasta').click();
  await page.locator('#seguir').click();
  await expect(page.locator('#datos')).toBeVisible();
  await llenarDatos(page);
  const nota = page.locator('.cierre');
  await expect(nota).toContainText('Al pedir acepta los términos de la tienda.');
  await expect(page.locator('#enviar')).toHaveText('Seguir al pago');
  const enlace = nota.getByRole('link', { name: 'términos de la tienda' });
  await expect(enlace).toHaveAttribute('href', '/tienda/terminos/');
  const [aparte] = await Promise.all([page.waitForEvent('popup'), enlace.click()]);
  await expect(aparte).toHaveURL(/\/tienda\/terminos\/$/);
  await aparte.close();
  /* La canasta y lo escrito siguen donde estaban */
  await expect(page.locator('#datos')).toBeVisible();
  await expect(page.locator('#d-nombre')).toHaveValue('Ana Prueba');
  v.sinProblemas();
});

test('los términos caben en la pantalla (sin barra de lado) y todo lo que se toca mide 44 px o más', async ({ page }) => {
  /* Sin catalogo.json: así se ven también el WhatsApp de respaldo de la sección 1 y todos los enlaces de las listas */
  await page.route('**/tienda/catalogo.json', (r) => r.fulfill({ status: 500, body: 'no' }));
  await page.goto('/tienda/terminos/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
  const ancho = await page.evaluate(() => ({ total: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));
  expect(ancho.total).toBeLessThanOrEqual(ancho.visible);
  /* los enlaces sueltos (pie, listas de datos y vías de reclamo, volver): la caja del <a> es la que se toca, no la del renglón */
  const tocables = page.locator('.pie a, .vende a, .vias a, .volver-tienda');
  expect(await tocables.count()).toBeGreaterThanOrEqual(8);
  for (const enlace of await tocables.all()) {
    const caja = await enlace.boundingBox();
    expect(caja && caja.height, await enlace.innerText()).toBeGreaterThanOrEqual(44);
  }
});

test('la línea larga de quién vende cabe en el pie del celular', async ({ page }) => {
  await abrirTienda(page, { sitio: conVendedor({ ...ANA, nombre: 'Comercializadora de Plásticos y Desechables Espinal S.A.S.', direccion: 'Calle 7 #5-35, Centro, El Espinal, Tolima', correo: 'reclamos.servicio.al.cliente.tienda.en.linea@plasticosespinal.com' }) });
  await expect(page.locator('.pie [data-vendedor-linea]')).toBeVisible();
  const ancho = await page.evaluate(() => ({ total: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));
  expect(ancho.total).toBeLessThanOrEqual(ancho.visible);
});
