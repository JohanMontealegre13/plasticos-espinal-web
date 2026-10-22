/* Buscador de la tienda: entiende plurales, sinónimos y errores de dedo; ordena la vitrina;
   y si no hay nada, ofrece pedirlo por WhatsApp con lo que la persona escribió. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));

test('buscar «icopor» encuentra el contenedor', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await page.locator('#q').fill('icopor');
  await expect(page.locator('#grilla li')).toHaveCount(1);
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «icopor»');
  v.sinProblemas();
});

test('sin resultados ofrece pedirlo por WhatsApp con lo que buscó', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#pedirloWa')).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Hola, busco: manguera'));
});

test('el enlace de WhatsApp solo se ve cuando se busca y no hay nada', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('#pedirloWa')).toBeHidden();        /* portada: sin consulta */
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await expect(page.locator('#pedirloWa')).toBeVisible();
  await expect(page.locator('#pedirloWa')).toHaveText('¿No lo encuentra? Pídalo por WhatsApp');
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#grilla li')).toHaveCount(1);
  await expect(page.locator('#pedirloWa')).toBeHidden();        /* con resultados */
  await page.locator('#q').fill('');
  await expect(page.locator('#pedirloWa')).toBeHidden();        /* sin consulta otra vez */
});

test('el enlace de WhatsApp lleva lo escrito tal cual, sin espacios sobrantes, y abre aparte', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('  Manguera 1/2" negra  ');
  const a = page.locator('#pedirloWa');
  await expect(a).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Hola, busco: Manguera 1/2" negra'));
  await expect(a).toHaveAttribute('target', '_blank');
  await expect(a).toHaveAttribute('rel', /noopener/);
});

test('el número del enlace sale de catalogo.json y no del código', async ({ page }) => {
  await page.route('**/tienda/catalogo.json', async (r) => {
    const sitio = await (await r.fetch()).json();
    await r.fulfill({ json: { ...sitio, whatsapp: '573001112233' } });
  });
  await abrirTienda(page);
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#pedirloWa')).toHaveAttribute('href', 'https://wa.me/573001112233?text=' + encodeURIComponent('Hola, busco: manguera'));
});

test('buscar entiende plurales, sinónimos y un error de dedo', async ({ page }) => {
  await abrirTienda(page);
  const nombres = page.locator('#grilla li h3');
  await page.locator('#q').fill('contenedores');
  await expect(nombres).toHaveText(['Contenedor icopor J1 x25 und']);
  await page.locator('#q').fill('portacomidas');
  await expect(nombres).toHaveText(['Contenedor icopor J1 x25 und']);
  await page.locator('#q').fill('servileta');
  await expect(nombres).toHaveText(['Servilleta 25x25 x300 und']);
  await page.locator('#q').fill('PITILLOS');
  await expect(nombres).toHaveText(['Pitillo flexible x100 und']);
});

test('buscar un código muestra primero ese producto', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('141');
  await expect(page.locator('#grilla li h3')).toHaveText(['Contenedor icopor J1 x25 und']);
});

test('ordenar por menor precio', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  await page.locator('#orden').selectOption('menor');
  await expect(page.locator('#grilla li h3').first()).toHaveText('Pitillo flexible x100 und');
});

test('el orden: menor, mayor, nombre y «Más pedidos», con el agotado siempre al final', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  const nombres = page.locator('#grilla li h3');
  await expect(page.locator('#orden option')).toHaveText(['Más pedidos', 'Menor precio', 'Mayor precio', 'Nombre A-Z']);
  await expect(page.locator('#orden')).toHaveValue('pedidos');
  await expect(nombres.first()).toHaveText('Contenedor icopor J1 x25 und');       /* destacado primero */
  await page.locator('#orden').selectOption('mayor');
  await expect(nombres.first()).toHaveText('Bolsa kraft #6 x100 und');
  await expect(nombres.last()).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await page.locator('#orden').selectOption('nombre');
  await expect(nombres.first()).toHaveText('Bolsa kraft #6 x100 und');
  await expect(nombres.nth(1)).toHaveText('Contenedor icopor J1 x25 und');
  await expect(nombres.last()).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await page.locator('#orden').selectOption('menor');
  await expect(nombres.last()).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await page.locator('#orden').selectOption('pedidos');
  await expect(nombres.first()).toHaveText('Contenedor icopor J1 x25 und');
});

test('el orden también cuenta en la portada y dentro de una categoría', async ({ page }) => {
  await abrirTienda(page);                                   /* portada: solo lo más pedido */
  await page.locator('#orden').selectOption('menor');
  await expect(page.locator('#grilla li h3')).toHaveText(['Vaso 7 oz blanco Wau x50 und', 'Tenedor plástico x100 und', 'Contenedor icopor J1 x25 und']);
  await page.locator('#orden').selectOption('nombre');
  await expect(page.locator('#grilla li h3').first()).toHaveText('Contenedor icopor J1 x25 und');
  await page.locator('.cat[data-cat="c1"]').click();         /* una categoría: contenedores, tenedores y bolsas */
  await expect(page.locator('#grilla li h3')).toHaveText(['Bolsa kraft #6 x100 und', 'Contenedor icopor J1 x25 und', 'Tenedor plástico x100 und']);
  await page.locator('#orden').selectOption('mayor');
  await expect(page.locator('#grilla li h3')).toHaveText(['Bolsa kraft #6 x100 und', 'Contenedor icopor J1 x25 und', 'Tenedor plástico x100 und']);
  await page.locator('#orden').selectOption('menor');
  await expect(page.locator('#grilla li h3')).toHaveText(['Tenedor plástico x100 und', 'Contenedor icopor J1 x25 und', 'Bolsa kraft #6 x100 und']);
});

test('al buscar con «Más pedidos» manda la relevancia; con otro orden, el orden elegido', async ({ page }) => {
  /* El producto de código 7 y «Vaso 7 oz» casan con «7»; por nombre «Vaso 7 oz» iría primero */
  const catalogo = {
    ...CATALOGO_CRM,
    productos: [...CATALOGO_CRM.productos,
      { id: 7, nombre: 'Vaso térmico 12 oz', categoria: 'c2', precio: 15000, disponible: true, destacado: false, foto: '', fotos: [] }],
  };
  await abrirTienda(page, { catalogo });
  const nombres = page.locator('#grilla li h3');
  await page.locator('#q').fill('7');
  await expect(nombres).toHaveText(['Vaso térmico 12 oz', 'Vaso 7 oz blanco Wau x50 und']);   /* el código exacto va primero */
  await page.locator('#orden').selectOption('nombre');
  await expect(nombres).toHaveText(['Vaso 7 oz blanco Wau x50 und', 'Vaso térmico 12 oz']);
  await page.locator('#orden').selectOption('mayor');
  await expect(nombres).toHaveText(['Vaso térmico 12 oz', 'Vaso 7 oz blanco Wau x50 und']);
  await page.locator('#orden').selectOption('menor');
  await expect(nombres).toHaveText(['Vaso 7 oz blanco Wau x50 und', 'Vaso térmico 12 oz']);
  await page.locator('#orden').selectOption('pedidos');
  await expect(nombres).toHaveText(['Vaso térmico 12 oz', 'Vaso 7 oz blanco Wau x50 und']);
});

test('solo relleno se busca como cualquier palabra: «con», camino a «contenedor», no muestra toda la tienda', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('con');
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «con»');
  await expect(page.locator('#grilla li h3')).toHaveText(['Contenedor icopor J1 x25 und']);
  await page.locator('#q').fill('de la');
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await expect(page.locator('#pedirloWa')).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Hola, busco: de la'));
});

test('solo espacios es no buscar nada', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('   ');
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#pedirloWa')).toBeHidden();
  await expect(page.locator('#limpiar')).toBeHidden();
});

test('una medida que no existe no muestra la de al lado: ofrece pedirla', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('25x35');                     /* solo hay servilletas de 25x25 */
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await expect(page.locator('#pedirloWa')).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Hola, busco: 25x35'));
  await page.locator('#q').fill('25x25');
  await expect(page.locator('#grilla li h3')).toHaveText(['Servilleta 25x25 x300 und']);
});

test('si buscar.js no carga, la tienda sigue con la búsqueda simple de antes', async ({ page }) => {
  await page.route('**/tienda/buscar.js*', (r) => r.fulfill({ status: 404, body: '' }));
  await abrirTienda(page);
  await expect(page.locator('#estado')).toHaveText('');
  await page.locator('#q').fill('icopor');
  await expect(page.locator('#grilla li h3')).toHaveText(['Contenedor icopor J1 x25 und']);
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await expect(page.locator('#pedirloWa')).toBeVisible();
  await page.locator('#orden').selectOption('menor');        /* sin orden, pero sin romperse */
  await page.locator('#q').fill('');
  await expect(page.locator('#grilla li')).toHaveCount(8);   /* sin búsqueda: todos */
});

test('«Ver todo» limpia la búsqueda y conserva el orden elegido', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#orden').selectOption('mayor');
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await page.locator('#limpiar').click();
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#orden')).toHaveValue('mayor');
  await expect(page.locator('#grilla li h3').first()).toHaveText('Bolsa kraft #6 x100 und');
});

test('el selector de orden y el enlace de WhatsApp se tocan con el dedo (44 px)', async ({ page }) => {
  await abrirTienda(page);
  const alto = async (/** @type {string} */ sel) => (await page.locator(sel).boundingBox())?.height ?? 0;
  expect(await alto('#orden')).toBeGreaterThanOrEqual(44);
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#pedirloWa')).toBeVisible();
  expect(await alto('#pedirloWa')).toBeGreaterThanOrEqual(44);
});

test('la vitrina no se desborda de lado con el selector en celular y escritorio', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('manguera');
  await expect(page.locator('#pedirloWa')).toBeVisible();
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ven: window.innerWidth }));
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ven);
});
