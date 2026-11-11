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

/* Un catálogo con 9 platos (medidas, colores y dos marcas) para los filtros plegables y la rejilla del inicio */
const MEDIDAS = ['26 cm', '12 cm', '15,5 cm', '18 cm', '6 cm', '20 cm', '23 cm', '9 cm', '30 cm'];
const PLATOS = {
  ...PUBLICO,
  categorias: [...PUBLICO.categorias, { id: 'c99', nombre: 'Platos' }],
  productos: [...PUBLICO.productos, ...MEDIDAS.map((m, i) => ({
    id: 900 + i, nombre: `Plato ${m} ${i % 2 ? 'Negro' : 'Blanco'}`, categoria: 'c99', disponible: true, destacado: false,
    foto: '', fotos: [], contenido: { cantidad: 20, unidad: 'und', se_mide: false },
    detalles: [{ nombre: 'Marca', valor: i < 3 ? 'Darnel' : 'Wau' }, { nombre: 'Medida', valor: m }, { nombre: 'Color', valor: i % 2 ? 'Negro' : 'Blanco' }],
  }))],
};

/** En celular y tableta los filtros van plegados detrás de «Filtros»: se abren si hace falta */
async function abrirFiltros(/** @type {import('@playwright/test').Page} */ page) {
  const boton = page.locator('#verFiltros');
  if (await boton.isVisible() && (await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
}

/** Sin desborde lateral: nada se sale de la pantalla */
async function sinDesborde(/** @type {import('@playwright/test').Page} */ page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(ancho, 'la página se desborda de lado').toBeLessThanOrEqual(0);
}

test('el catálogo no muestra precios ni WhatsApp en cada tarjeta: la tarjeta abre la ficha, que sí lo tiene', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/');
  await expect(page.locator('#catRejilla > li')).toHaveCount(8);
  await expect(page.locator('#catTitulo')).toHaveText('Todos los productos');
  await expect(page.locator('#catConteo')).toHaveText('8 productos');
  await expect(page.locator('#catRejilla')).not.toContainText('$');
  /* Johan, 10-nov-2026: un solo «Pedir por WhatsApp», el de la ficha; la tarjeta solo invita a verla */
  await expect(page.locator('#catRejilla a[href^="https://wa.me/"]')).toHaveCount(0);
  const tarjeta = page.locator('#catRejilla .tarjeta-prod').filter({ hasText: 'Contenedor icopor J1' });
  await expect(tarjeta.locator('.tarjeta-prod__ver')).toHaveText('Ver detalles');
  /* sin foto propia: la de referencia, con su sello (nunca una escena de IA) */
  await expect(page.locator('#catRejilla .tarjeta-prod__foto.es-referencia').first()).toBeVisible();
  await expect(page.locator('#catRejilla .sello-ref').first()).toHaveText('Foto de referencia');
  /* el agotado va de último */
  await expect(page.locator('#catRejilla > li').last()).toContainText('Agotado');
  /* tocar la tarjeta (no solo el nombre) abre la ficha: se pide en la tienda (el mismo producto) y
     WhatsApp queda para dudas, con el nombre y el código (Johan, 11-nov-2026) */
  await tarjeta.click();
  await expect(page).toHaveURL(/\/productos\/\?p=141$/);
  await expect(page.locator('#fichaPedir')).toHaveAttribute('href', 'https://tienda.plasticosespinal.com/#p=141');
  await expect(page.locator('#fichaPedirTexto')).toHaveText('Pedir en la tienda');
  const href = decodeURIComponent(String(await page.locator('#fichaPreguntar').getAttribute('href')));
  expect(href).toMatch(/^https:\/\/wa\.me\/573183555246\?text=/);
  expect(href).toContain('Contenedor icopor J1 x25 und (código 141)');
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
  /* Marca: hay dos para escoger; Medida no sale (todas iguales) */
  await abrirFiltros(page);
  await expect(page.locator('#bloque-marca')).toBeVisible();
  await expect(page.locator('#bloque-medida')).toHaveCount(0);
  await page.locator('#lista-marca').getByText('Darnel').click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(1);
  await expect(page.locator('#catRejilla')).toContainText('Tenedor plástico');
  await page.locator('#lista-marca').getByText('Darnel').click();
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

test('el buscador va en la cabecera: desde la ficha de un producto se sigue buscando y «atrás» vuelve a ella', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page);
  await page.goto('/productos/?p=141');
  await expect(page.locator('#ficha')).toBeVisible();
  /* Está en la cabecera, a la vista, y no ensancha la página */
  await expect(page.locator('.cabecera #catBuscar')).toBeVisible();
  await sinDesborde(page);
  /* Con la casilla vacía nadie sale del producto que está mirando */
  await page.locator('#catBuscar').fill('  ');
  await page.waitForTimeout(300);
  await expect(page.locator('#ficha')).toBeVisible();
  await page.locator('#catBuscar').fill('vasos');
  await expect(page.locator('#listado')).toBeVisible();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#catTitulo')).toHaveText('Resultados para «vasos»');
  await expect(page).toHaveURL(/\?q=vasos$/);
  expect(await page.locator('#catRejilla > li').count()).toBeGreaterThan(0);
  /* «Atrás» devuelve a la ficha, con la casilla limpia */
  await page.goBack();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page).toHaveURL(/\?p=141$/);
  await expect(page.locator('#catBuscar')).toHaveValue('');
  v.sinProblemas();
});

test('los filtros se pliegan como lista: marca, medida y color, con «Ver más» y «Quitar filtros»', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page, { catalogo: PLATOS });
  await page.goto('/productos/?categoria=platos');
  await expect(page.locator('#catRejilla > li')).toHaveCount(9);
  await abrirFiltros(page);
  /* Marca abierta de entrada; Medida y Color plegados (solo el título) */
  const titulo = (/** @type {string} */ nombre) => page.locator('#catFiltros').getByRole('button', { name: new RegExp('^' + nombre) });
  await expect(titulo('Marca')).toHaveAttribute('aria-expanded', 'true');
  await expect(titulo('Medida')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#lista-medida')).toBeHidden();
  await expect(titulo('Color')).toBeVisible();
  /* Marca se pliega y se vuelve a abrir */
  await titulo('Marca').click();
  await expect(titulo('Marca')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#lista-marca')).toBeHidden();
  await titulo('Marca').click();
  await expect(page.locator('#lista-marca')).toBeVisible();
  /* Medida: de menor a mayor, 6 a la vista y «Ver 3 más» */
  await titulo('Medida').click();
  const medidas = page.locator('#lista-medida li:visible span');
  await expect(medidas).toHaveText(['6 cm', '9 cm', '12 cm', '15,5 cm', '18 cm', '20 cm']);
  await page.locator('#bloque-medida').getByRole('button', { name: 'Ver 3 más' }).click();
  await expect(medidas).toHaveCount(9);
  await expect(page.locator('#bloque-medida').getByRole('button', { name: 'Ver menos' })).toBeFocused();
  /* Entre filtros se cumplen todos: Negro y Wau */
  await titulo('Color').click();
  await page.locator('#lista-color').getByText('Negro').click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(4);
  await expect(titulo('Color')).toContainText('1 marcado');
  await expect(page.locator('#lista-marca label').filter({ hasText: 'Wau' }).locator('.casilla__n')).toHaveText('3');
  await page.locator('#lista-marca').getByText('Wau').click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(3);
  /* Quitar filtros deja todo como al entrar */
  await page.locator('#quitarFiltros').click();
  await expect(page.locator('#catRejilla > li')).toHaveCount(9);
  await expect(page.locator('#quitarFiltros')).toBeHidden();
  await expect(titulo('Medida')).toHaveAttribute('aria-expanded', 'true');   /* lo abierto sigue abierto */
  await sinDesborde(page);
  v.sinProblemas();
});

test('en computador los filtros van en la columna, al lado de los productos, sin el botón «Filtros»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await simularCatalogo(page, { catalogo: PLATOS });
  await page.goto('/productos/?categoria=platos');
  await expect(page.locator('#catFiltros')).toBeVisible();
  await expect(page.locator('#verFiltros')).toBeHidden();
  const columna = await page.locator('#catFiltros').boundingBox();
  const rejilla = await page.locator('#catRejilla').boundingBox();
  expect(columna && rejilla && columna.x + columna.width <= rejilla.x, 'la columna va a la izquierda de la rejilla').toBe(true);
});

test('en una pantalla mediana los filtros van plegados y los productos salen de una', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize({ width: 945, height: 900 });   /* la ventana de Chrome de Johan */
  await simularCatalogo(page, { catalogo: PLATOS });
  await page.goto('/productos/');
  await expect(page.locator('#catRejilla > li').first()).toBeVisible();
  await expect(page.locator('#catFiltros')).toBeHidden();
  const arriba = await page.locator('#catRejilla > li').first().evaluate((li) => li.getBoundingClientRect().top);
  expect(arriba, 'la primera tarjeta queda en la primera pantalla').toBeLessThan(900);
  await page.locator('#verFiltros').click();
  await expect(page.locator('#verFiltros')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#bloque-marca')).toBeVisible();
  await page.locator('#lista-marca').getByText('Darnel').click();
  await expect(page.locator('#filtrosN')).toHaveText('1');
  await page.locator('#verFiltros').click();
  await expect(page.locator('#catFiltros')).toBeHidden();
  await sinDesborde(page);
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

/* Regresión (Johan, 10-nov-2026): el CRM parte una categoría en varias («Aluminio» con 1 y «Papel Aluminio»
   con 4). La pestaña «Aluminio 1» escondía los otros cuatro: ahora la que cabe en otra se la lleva. */
const PARTIDAS = {
  ...PUBLICO,
  categorias: [...PUBLICO.categorias,
    { id: 'c12', nombre: 'Aluminio' }, { id: 'c31', nombre: 'Papel Aluminio' },
    { id: 'c3b', nombre: 'Bolsas' }, { id: 'c26', nombre: 'Bolsas Manija' }, { id: 'c27', nombre: 'Bolsas de Papel' },
    { id: 'c98', nombre: 'Platos' }],
  productos: [...PUBLICO.productos,
    ...['100', '7', '16', '40', '300'].map((m, i) => ({ id: 960 + i, nombre: `Aluminio *${m} Mts x1 und`, categoria: i ? 'c31' : 'c12', disponible: true, destacado: false, foto: '', fotos: [] })),
    ...['c3b', 'c26', 'c26', 'c27'].map((c, i) => ({ id: 970 + i, nombre: `Bolsa ${i + 2}K ${c === 'c27' ? 'Papel' : 'Manija'} x100 und`, categoria: c, disponible: true, destacado: false, foto: '', fotos: [] })),
    { id: 980, nombre: 'Plato 26 cm Wau x20 und', categoria: 'c98', disponible: true, destacado: false, foto: '', fotos: [] }],
};

test('una categoría partida en el CRM sale entera: «Aluminio» trae también los de «Papel Aluminio»', async ({ page }) => {
  const v = vigilar(page);
  await simularCatalogo(page, { catalogo: PARTIDAS });
  await page.goto('/productos/');
  const banda = page.locator('#catPestanas');
  /* Una sola pestaña por familia, con todos sus productos; las partes no salen sueltas */
  await expect(banda.locator('.pestana-cat').filter({ hasText: /^Aluminio/ })).toHaveText(/Aluminio\s*5/);
  await expect(banda.locator('.pestana-cat').filter({ hasText: /^Bolsas/ })).toHaveText(/Bolsas\s*4/);
  await expect(banda.locator('.pestana-cat').filter({ hasText: /Papel|Manija/ })).toHaveCount(0);
  /* «Vasos y platos» junta dos cosas: sigue siendo suya, no se la lleva «Platos» */
  await expect(banda.locator('.pestana-cat').filter({ hasText: /^Vasos y platos/ })).toHaveText(/Vasos y platos\s*3/);
  await expect(banda.locator('.pestana-cat').filter({ hasText: /^Platos/ })).toHaveText(/Platos\s*1/);
  await banda.locator('.pestana-cat').filter({ hasText: /^Aluminio/ }).click();
  await expect(page.locator('#catTitulo')).toHaveText('Aluminio');
  await expect(page.locator('#catConteo')).toHaveText('5 productos');
  await expect(page.locator('#catRejilla > li')).toHaveCount(5);
  await expect(page).toHaveURL(/\?categoria=aluminio$/);
  /* La búsqueda y la pestaña dicen lo mismo */
  await page.goto('/productos/?q=aluminio');
  await expect(page.locator('#catConteo')).toHaveText('5 productos');
  /* Un enlace viejo a una parte abre la familia entera */
  await page.goto('/productos/?categoria=papel-aluminio');
  await expect(page.locator('#catTitulo')).toHaveText('Aluminio');
  await expect(page.locator('#catRejilla > li')).toHaveCount(5);
  /* La ficha nombra la familia y su «volver» lleva a ella */
  await page.goto('/productos/?p=962');
  await expect(page.locator('#fichaCat')).toHaveText('Aluminio');
  await expect(page.locator('#fichaParecidos > li')).toHaveCount(4);
  await expect(page.locator('#fichaVolver')).toHaveAttribute('href', '/productos/?categoria=aluminio');
  v.sinProblemas();
});

test('la ficha: nombre, código, pestañas, pedir en la tienda, parecidos y volver', async ({ page }) => {
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
  await expect(page.locator('#fichaPedir')).toHaveAttribute('href', 'https://tienda.plasticosespinal.com/#p=141');
  expect(decodeURIComponent(String(await page.locator('#fichaPreguntar').getAttribute('href')))).toContain('(código 141)');
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
  await expect(page.locator('#fichaPedirTexto')).toHaveText('Ver en la tienda');
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
  const chicos = await page.locator('.pestana-cat, #catOrden, .catalogo__buscar-ir, .casilla').evaluateAll(
    (els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44)
      .map((e) => `${e.className || e.id}: ${Math.round(e.getBoundingClientRect().height)}px`));
  expect(chicos).toEqual([]);
});

/* ---------------- La foto en uso va de primera (Johan, 10-nov-2026) ---------------- */

/* Nombres como los del CRM (32 letras y números). De cada producto: la principal (el producto con su
   medida), la segunda (la foto en uso, hecha con IA) y la tabla de medidas */
const F = (/** @type {string} */ letra) => letra.repeat(32) + '.jpg';
const URL_FOTO = (/** @type {string} */ letra) => '/api/foto/' + F(letra);
const PUNTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const base = { categoria: 'c98', disponible: true, destacado: false };
const CON_FOTOS = {
  ...PUBLICO,
  categorias: [...PUBLICO.categorias, { id: 'c98', nombre: 'Platos' }],
  productos: [
    ...PUBLICO.productos,
    { ...base, id: 901, nombre: 'Plato 26 cm Wau x20 und', foto: F('a'), fotos: [F('a'), F('b'), F('c')] },
    { ...base, id: 902, nombre: 'Plato 23 cm Wau x20 und', foto: F('d'), fotos: [F('d')] },
    /* 118: su segunda foto es otra cara del paquete, no una escena */
    { ...base, id: 118, nombre: 'Plato 18 cm Wau x20 und', foto: F('e'), fotos: [F('e'), F('f')] },
    { ...base, id: 903, nombre: 'Plato 15,5 cm Wau x20 und', foto: '', fotos: [] },
  ],
};

/** @param {import('@playwright/test').Page} page */
async function simularConFotos(page) {
  await simularCatalogo(page, { catalogo: CON_FOTOS });
  await page.route('**/api/foto/**', (r) => r.fulfill({ contentType: 'image/png', body: PUNTO }));
}

test('la tarjeta de un producto muestra su foto en uso; sin ella, la principal; sin fotos, la de referencia', async ({ page }) => {
  const v = vigilar(page);
  await simularConFotos(page);
  await page.goto('/productos/?categoria=platos');
  const fotoDe = (/** @type {string} */ nombre) => page.locator('#catRejilla .tarjeta-prod').filter({ hasText: nombre }).locator('.tarjeta-prod__foto');
  await expect(fotoDe('Plato 26 cm').locator('img')).toHaveAttribute('src', URL_FOTO('b'));
  await expect(fotoDe('Plato 23 cm').locator('img')).toHaveAttribute('src', URL_FOTO('d'));
  /* la segunda de este código no es una escena: sigue la principal */
  await expect(fotoDe('Plato 18 cm').locator('img')).toHaveAttribute('src', URL_FOTO('e'));
  await expect(fotoDe('Plato 15,5 cm')).toHaveClass(/es-referencia/);
  await expect(fotoDe('Plato 15,5 cm').locator('.sello-ref')).toHaveText('Foto de referencia');
  /* una foto propia nunca lleva el sello de referencia */
  await expect(fotoDe('Plato 26 cm').locator('.sello-ref')).toHaveCount(0);
  /* y llena el recuadro: sin marco blanco alrededor */
  const hueco = await fotoDe('Plato 26 cm').evaluate((a) => {
    const c = a.getBoundingClientRect(), i = /** @type {HTMLImageElement} */ (a.querySelector('img')).getBoundingClientRect();
    return { ancho: c.width - i.width, alto: c.height - i.height, relleno: getComputedStyle(/** @type {HTMLImageElement} */ (a.querySelector('img'))).padding };
  });
  expect(hueco.relleno).toBe('0px');
  expect(hueco.ancho, 'la foto llega a los dos lados').toBeLessThanOrEqual(1);
  expect(hueco.alto, 'la foto llega arriba y abajo (menos la raya de abajo)').toBeLessThanOrEqual(2);
  await sinDesborde(page);
  v.sinProblemas();
});

test('la ficha abre con la foto en uso, la principal queda de segunda y cada miniatura cambia la grande', async ({ page }) => {
  const v = vigilar(page);
  await simularConFotos(page);
  await page.goto('/productos/?p=901');
  const grande = page.locator('#fichaFoto'), minis = page.locator('#fichaMinis .ficha-pub__mini');
  await expect(grande).toHaveAttribute('src', URL_FOTO('b'));
  await expect(grande).toHaveAttribute('alt', 'Plato 26 cm Wau x20 und, en uso');
  await expect(page.locator('#fichaRef')).toBeHidden();
  await expect(minis).toHaveCount(3);
  for (const [i, letra] of ['b', 'a', 'c'].entries()) await expect(minis.nth(i).locator('img')).toHaveAttribute('src', URL_FOTO(letra));
  await expect(minis.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await minis.nth(1).click();
  await expect(grande).toHaveAttribute('src', URL_FOTO('a'));
  await expect(grande).toHaveAttribute('alt', 'Plato 26 cm Wau x20 und');
  await expect(minis.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(minis.nth(0)).toHaveAttribute('aria-pressed', 'false');
  expect(await grande.evaluate((i) => getComputedStyle(i).padding)).toBe('0px');
  /* los parecidos también salen con su foto en uso */
  await expect(page.locator('#fichaParecidos .tarjeta-prod').filter({ hasText: 'Plato 23 cm' }).locator('img')).toHaveAttribute('src', URL_FOTO('d'));
  /* con una sola foto no hay miniaturas, y el código sin escena abre con su principal */
  await page.goto('/productos/?p=902');
  await expect(grande).toHaveAttribute('src', URL_FOTO('d'));
  await expect(grande).toHaveAttribute('alt', 'Plato 23 cm Wau x20 und');
  await expect(page.locator('#fichaMinis')).toBeHidden();
  await page.goto('/productos/?p=118');
  await expect(grande).toHaveAttribute('src', URL_FOTO('e'));
  await expect(grande).toHaveAttribute('alt', 'Plato 18 cm Wau x20 und');
  await expect(minis).toHaveCount(2);
  await sinDesborde(page);
  v.sinProblemas();
});

/* ---------------- Inicio ---------------- */

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
