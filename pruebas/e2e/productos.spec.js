/* Catálogo PÚBLICO (/productos/ y las pestañas del inicio), sin precios: decisión de Johan del 9-nov-2026
   (art. 26 de la Ley 1480). Cada producto se pide por WhatsApp. El CRM no corre aquí: /api/catalogo se
   simula con el catálogo de prueba pasado por el mismo filtro de functions/api/catalogo.js. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { vigilar } from './ayudas.js';

const CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
/* Dos marcas en Contenedores (para el filtro de marca) y una ficha con descripción y detalles */
const MARCAS = { 141: 'Wau', 131: 'Darnel', 305: 'Wau' };
for (const p of CRM.productos) {
  if (MARCAS[p.id]) p.detalles = [{ nombre: 'Marca', valor: MARCAS[p.id] }, { nombre: 'Medida', valor: 'Mediana' }];
  if (p.id === 141) p.descripcion = 'Para comida caliente o fría. Aguanta el microondas.';
}
/* Lo mismo que hace functions/api/catalogo.js (su filtro lo prueba unit/catalogo-publico.test.mjs):
   aquí basta con quitar lo que nunca sale al público */
const PUBLICO = {
  ok: true,
  categorias: CRM.categorias,
  productos: CRM.productos.map((/** @type {any} */ { precio, ...p }) => p),   // eslint-disable-line no-unused-vars
  generado: new Date().toISOString(),
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ catalogo?: any, estado?: number }} [op]
 */
async function simularCatalogo(page, op = {}) {
  await page.route('**/api/catalogo', (r) => (op.estado
    ? r.fulfill({ status: op.estado, json: { ok: false, error: 'No pudimos traer los productos.' } })
    : r.fulfill({ json: op.catalogo || PUBLICO })));
  await page.route('**/api/foto/**', (r) => r.fulfill({ status: 404 }));
}

/** Sin desborde lateral: nada se sale de la pantalla */
async function sinDesborde(/** @type {import('@playwright/test').Page} */ page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(ancho, 'la página se desborda de lado').toBeLessThanOrEqual(0);
}

test('el catálogo no muestra precios y cada tarjeta se pide por WhatsApp con su código', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/');
  await expect(page.locator('#catRejilla > li')).toHaveCount(8);
  await expect(page.locator('#catTitulo')).toHaveText('Todos los productos');
  await expect(page.locator('#catConteo')).toHaveText('8 productos');
  await expect(page.locator('#catRejilla')).not.toContainText('$');
  const pedir = page.locator('#catRejilla .tarjeta-prod').filter({ hasText: 'Contenedor icopor J1' }).locator('.tarjeta-prod__pedir');
  const href = decodeURIComponent(String(await pedir.getAttribute('href')));
  expect(href).toMatch(/^https:\/\/wa\.me\/573183555246\?text=/);
  expect(href).toContain('Contenedor icopor J1 x25 und (código 141)');
  /* sin foto propia: la de referencia, con su sello (nunca una escena de IA) */
  await expect(page.locator('#catRejilla .tarjeta-prod__foto.es-referencia').first()).toBeVisible();
  await expect(page.locator('#catRejilla .sello-ref').first()).toHaveText('Foto de referencia');
  /* el agotado va de último y dice «Preguntar» */
  await expect(page.locator('#catRejilla > li').last()).toContainText('Agotado');
  await expect(page.locator('#catRejilla > li').last().locator('.tarjeta-prod__pedir')).toContainText('Preguntar');
  await sinDesborde(page);
  v.sinProblemas();
});

test('pestañas de categoría, marca, «solo lo que hay» y orden filtran sin recargar', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/');
  await page.locator('#catPestanas').getByRole('button', { name: /Contenedores/ }).click();
  await expect(page).toHaveURL(/\/productos\/\?categoria=contenedores$/);
  await expect(page.locator('#catTitulo')).toHaveText('Contenedores');
  await expect(page.locator('#catRejilla > li')).toHaveCount(3);
  await expect(page.locator('#catPestanas [aria-pressed="true"]')).toContainText('Contenedores');
  /* Marca: hay dos para escoger */
  await expect(page.locator('#bloqueMarcas')).toBeVisible();
  await page.locator('#listaMarcas').getByText('Darnel').click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(1);
  await expect(page.locator('#catRejilla')).toContainText('Tenedor plástico');
  await page.locator('#listaMarcas').getByText('Darnel').click();
  /* «Vasos y platos» trae un agotado: aparece «Solo lo que hay» */
  await page.locator('#catPestanas').getByRole('button', { name: /Vasos y platos/ }).click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(3);
  await page.locator('#soloHay').check();
  await expect(page.locator('#catRejilla > li')).toHaveCount(2);
  await expect(page.locator('#catRejilla')).not.toContainText('Agotado');
  /* atrás vuelve a la categoría anterior */
  await page.goBack();
  await expect(page.locator('#catTitulo')).toHaveText('Contenedores');
  await page.locator('#catPestanas').getByRole('button', { name: /Todos/ }).click();
  await page.locator('#catOrden').selectOption('nombre');
  const nombres = await page.locator('#catRejilla .tarjeta-prod__nombre').allTextContents();
  const disponibles = nombres.slice(0, 7);
  expect(disponibles).toEqual([...disponibles].sort((a, b) => a.localeCompare(b, 'es')));
  v.sinProblemas();
});

test('el buscador encuentra con plurales y tildes, y lo que no hay ofrece WhatsApp', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/');
  await page.locator('#catBuscar').fill('CONTENEDORES');
  await expect(page.locator('#catRejilla > li')).toHaveCount(1);
  await expect(page).toHaveURL(/\?q=CONTENEDORES$/);
  await expect(page.locator('#catTitulo')).toHaveText('Resultados para «CONTENEDORES»');
  await page.locator('#catBuscar').fill('manguera');
  await expect(page.locator('#catVacio')).toBeVisible();
  expect(decodeURIComponent(String(await page.locator('#catVacioWa').getAttribute('href')))).toContain('Busco: manguera');
  v.sinProblemas();
});

test('el enlace del inicio con una categoría que el CRM llama distinto cae en la categoría parecida', async ({ page }) => {
  await simularCatalogo(page);
  await page.goto('/productos/?categoria=vasos');
  await expect(page.locator('#catTitulo')).toHaveText('Vasos y platos');
  await page.goto('/productos/?categoria=pitillos');
  /* sin categoría «Pitillos»: se busca por el nombre */
  await expect(page.locator('#catTitulo')).toHaveText('Resultados para «pitillos»');
  await expect(page.locator('#catRejilla')).toContainText('Pitillo flexible');
});

test('la ficha: nombre, código, pestañas, pedir por WhatsApp, parecidos y volver', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/?categoria=contenedores');
  await page.locator('#catRejilla').getByRole('link', { name: 'Contenedor icopor J1 x25 und', exact: true }).click();
  await expect(page).toHaveURL(/\/productos\/\?p=141$/);
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#listado')).toBeHidden();
  await expect(page.locator('#fichaTitulo')).toHaveText('Contenedor icopor J1 x25 und');
  await expect(page.locator('#fichaTitulo')).toBeFocused();
  await expect(page.locator('#fichaCodigo')).toHaveText('Código 141');
  await expect(page.locator('#fichaDisp')).toHaveText('Disponible hoy');
  await expect(page.locator('#fichaRef')).toBeVisible();
  expect(decodeURIComponent(String(await page.locator('#fichaPedir').getAttribute('href')))).toContain('(código 141)');
  await expect(page).toHaveTitle('Contenedor icopor J1 x25 und — Plásticos Espinal');
  /* Pestañas: descripción abierta; flecha → características */
  await expect(page.locator('#tabDesc')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#fichaDesc')).toHaveText(/microondas/);
  await page.locator('#tabDesc').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tabCaract')).toBeFocused();
  await expect(page.locator('#panelCaract')).toBeVisible();
  await expect(page.locator('#fichaCaract')).toContainText('Wau');
  await expect(page.locator('#fichaCaract')).toContainText('25 und');
  await page.keyboard.press('End');
  await expect(page.locator('#panelEnvio')).toBeVisible();
  /* Parecidos de la misma categoría */
  await expect(page.locator('#fichaParecidos > li')).toHaveCount(2);
  /* El único $ de la ficha es el de «domicilio gratis desde…» (texto fijo de la página), nunca un precio */
  for (const zona of ['#fichaTitulo', '#fichaCodigo', '#fichaDisp', '#fichaPedir', '#fichaParecidos', '#panelDesc', '#panelCaract']) {
    await expect(page.locator(zona)).not.toContainText('$');
  }
  /* Atrás vuelve a la lista de la categoría */
  await page.goBack();
  await expect(page.locator('#listado')).toBeVisible();
  await expect(page.locator('#catTitulo')).toHaveText('Contenedores');
  await page.goForward();
  await expect(page.locator('#fichaTitulo')).toHaveText('Contenedor icopor J1 x25 und');
  await page.locator('#fichaVolver').click();
  await expect(page).toHaveURL(/\?categoria=contenedores$/);
  await sinDesborde(page);
  v.sinProblemas();
});

test('ficha de un producto sin descripción ni detalles: abre «Domicilio y pago» y dice si está agotado', async ({ page }) => {
  await simularCatalogo(page);
  await page.goto('/productos/?p=398');
  await expect(page.locator('#fichaTitulo')).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await expect(page.locator('#tabDesc')).toBeHidden();
  await expect(page.locator('#tabCaract')).toBeHidden();
  await expect(page.locator('#tabEnvio')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#fichaDisp')).toContainText('Agotado');
  await expect(page.locator('#fichaPedirTexto')).toHaveText('Preguntar por WhatsApp');
});

test('si el catálogo no carga, la página lo dice y ofrece WhatsApp con lo que buscaba', async ({ page }) => {
  await simularCatalogo(page, { estado: 503 });
  await page.goto('/productos/?categoria=vasos');
  await expect(page.locator('#catFalla')).toBeVisible();
  await expect(page.locator('#catEstado')).toBeHidden();
  expect(decodeURIComponent(String(await page.locator('#catFallaWa').getAttribute('href')))).toContain('Quiero cotizar vasos');
});

test('los botones del catálogo miden al menos 44 px para el dedo', async ({ page }) => {
  await simularCatalogo(page);
  await page.goto('/productos/?categoria=contenedores');
  await expect(page.locator('#catRejilla > li')).toHaveCount(3);
  const chicos = await page.locator('.pestana-cat, .tarjeta-prod__pedir, #catOrden, .catalogo__buscar-ir, .casilla').evaluateAll(
    (els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44)
      .map((e) => `${e.className || e.id}: ${Math.round(e.getBoundingClientRect().height)}px`));
  expect(chicos).toEqual([]);
});

/* ---------------- Inicio ---------------- */

test('el inicio muestra los productos de la bodega en pestañas por categoría', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/');
  const bloque = page.locator('#destacados');
  await expect(bloque).toBeVisible();
  const tabs = bloque.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  /* la de más productos va primero (Contenedores: 3) */
  await expect(tabs.first()).toHaveText('Contenedores');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(bloque.locator('[role="tabpanel"]:visible .tarjeta-prod')).toHaveCount(3);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  const todos = bloque.locator('[role="tabpanel"]:visible .pestanas__todos');
  await expect(todos).toHaveAttribute('href', /\/productos\/\?categoria=/);
  await expect(bloque).not.toContainText('$');
  await sinDesborde(page);
  v.sinProblemas();
});

test('sin catálogo el inicio se ve completo, sin la sección de pestañas', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page, { estado: 503 });
  await page.goto('/');
  await expect(page.locator('#catalogo .cat').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#destacados')).toBeHidden();
  v.sinProblemas();
});

test('las tarjetas de categoría del inicio llevan al catálogo', async ({ page }) => {
  await simularCatalogo(page);
  await page.goto('/');
  const hrefs = await page.locator('#catalogo a.cat').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(10);
  for (const h of hrefs) expect(h).toMatch(/^\/productos\/\?categoria=[a-z]+$/);
});

/* ---------------- Pie y políticas ---------------- */

test('el pie trae enlaces rápidos, políticas y contacto, y las políticas cargan limpias', async ({ page }) => {
  const v = vigilar(page);
  await page.goto('/');
  const pie = page.locator('footer.pie');
  for (const nombre of ['Productos', 'Preguntas frecuentes', 'Contacto']) await expect(pie.getByRole('link', { name: nombre, exact: true })).toBeVisible();
  await expect(pie.locator('a[href="/privacidad/"]')).toHaveCount(1);
  await expect(pie.locator('a[href="/terminos/"]')).toHaveCount(1);
  await expect(pie.locator('a[href*="tienda"]')).toHaveCount(0);
  for (const ruta of ['/terminos/', '/privacidad/']) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.legal__indice a').first()).toBeVisible();
    await sinDesborde(page);
  }
  await page.goto('/terminos/#domicilio');
  await expect(page.locator('#domicilio')).toBeInViewport();
  v.sinProblemas();
});

test('la foto de referencia sale del nombre del producto por palabra completa («contenedor» no es «tenedor»)', async ({ page }) => {
  await simularCatalogo(page);
  await page.goto('/productos/');
  const fotoDe = (/** @type {string} */ nombre) => page.locator('#catRejilla .tarjeta-prod').filter({ hasText: nombre }).locator('.tarjeta-prod__foto img');
  await expect(fotoDe('Contenedor icopor J1')).toHaveAttribute('src', '/img/productos/contenedores.webp');
  await expect(fotoDe('Tenedor plástico')).toHaveAttribute('src', '/img/productos/cubiertos.webp');
  await expect(fotoDe('Pitillo flexible')).toHaveAttribute('src', '/img/productos/pitillos.webp');
  await expect(fotoDe('Bolsa kraft')).toHaveAttribute('src', '/img/productos/bolsas.webp');
  /* aseo no tiene foto genérica: la de la bodega, no la de servilletas */
  await expect(fotoDe('Detergente')).toHaveAttribute('src', '/img/productos/bodega.webp');
});
