/* La portada de la tienda (pedido del dueño, 11-nov-2026): arriba solo el buscador y la cuenta (en el celular sin
   logo), «Lo más pedido» con 4 productos que cambian cada 5 s, debajo todo el catálogo con las categorías como
   filtros, y en el pie el logo a color y «Tienda en línea». Un enlace con #c=… abre la tienda ya filtrada. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, CATALOGO_CRM } from './ayudas.js';

const CELULAR = { width: 390, height: 844 };
const nombres = (/** @type {import('@playwright/test').Page} */ page) => page.locator('#rotan li h3').allTextContents();

/** El catálogo de prueba con los 8 productos disponibles y «más pedidos» (dos vueltas de 4). */
function conOchoMasPedidos() {
  const c = structuredClone(CATALOGO_CRM);
  for (const p of c.productos) { p.destacado = true; p.disponible = true; }
  return c;
}

test('lo más pedido muestra 4 y cada 5 s los siguientes; con «Pausar» se queda quieto', async ({ page }) => {
  const v = vigilar(page);
  await page.clock.install({ time: new Date('2026-11-12T10:00:00-05:00') });
  await abrirTienda(page, { catalogo: conOchoMasPedidos() });
  await expect(page.locator('#masPedidoTit')).toHaveText('Lo más pedido');
  await expect(page.locator('#rotan li')).toHaveCount(4);
  await expect(page.locator('.rota-punto')).toHaveCount(2);
  const primera = await nombres(page);
  await page.clock.runFor(5100);
  await expect.poll(() => nombres(page)).not.toEqual(primera);
  const segunda = await nombres(page);
  expect(segunda.filter((n) => primera.includes(n))).toEqual([]);   /* los otros 4, sin repetir */
  await expect(page.locator('.rota-punto').nth(1)).toHaveAttribute('aria-current', 'true');
  await page.locator('#rotaPausa').click();
  await expect(page.locator('#rotaPausa')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0);
  await page.clock.runFor(15000);
  expect(await nombres(page)).toEqual(segunda);
  /* los puntos dejan pasar a mano aunque esté en pausa */
  await page.locator('.rota-punto').first().click();
  await expect.poll(() => nombres(page)).toEqual(primera);
  v.sinProblemas();
});

test('con el mouse encima no cambia; al salir sigue', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T10:00:00-05:00') });
  await abrirTienda(page, { catalogo: conOchoMasPedidos() });
  const primera = await nombres(page);
  await page.locator('#rotan li').first().hover();
  await page.clock.runFor(11000);
  expect(await nombres(page)).toEqual(primera);
  await page.mouse.move(0, 0);
  await page.clock.runFor(5100);
  await expect.poll(() => nombres(page)).not.toEqual(primera);
});

test('con «menos movimiento» no cambia solo ni sale «Pausar»', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-11-12T10:00:00-05:00') });
  await abrirTienda(page, { catalogo: conOchoMasPedidos() });
  const primera = await nombres(page);
  await page.clock.runFor(16000);
  expect(await nombres(page)).toEqual(primera);
  await expect(page.locator('#rotaPausa')).toBeHidden();
  await expect(page.locator('.rota-punto')).toHaveCount(2);
});

test('con pocos más pedidos no rota ni salen los puntos; lo agotado no entra', async ({ page }) => {
  await abrirTienda(page);   /* el catálogo de prueba trae 3 más pedidos */
  await expect(page.locator('#rotan li')).toHaveCount(3);
  await expect(page.locator('#rotaCtrl')).toBeHidden();
  const c = structuredClone(CATALOGO_CRM);
  c.productos.find((/** @type {any} */ p) => p.id === 141).disponible = false;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abrirTienda(page, { catalogo: c });
  await expect(page.locator('#rotan li')).toHaveCount(2);
  await expect(page.locator('#rotan')).not.toContainText('Contenedor icopor J1');
});

test('sin ventas que contar no dice «más pedido»: «Recomendados» con los que tienen foto, o nada', async ({ page }) => {
  const c = structuredClone(CATALOGO_CRM);
  for (const p of c.productos) p.destacado = false;
  c.productos.find((/** @type {any} */ p) => p.id === 191).foto = 'servilleta.jpg';
  await abrirTienda(page, { catalogo: c });
  await expect(page.locator('#masPedidoTit')).toHaveText('Recomendados');
  await expect(page.locator('#rotan li h3')).toHaveText(['Servilleta 25x25 x300 und']);
  await expect(page.locator('#rotan .sello')).toHaveCount(0);
  const sinFotos = structuredClone(c);
  delete sinFotos.productos.find((/** @type {any} */ p) => p.id === 191).foto;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abrirTienda(page, { catalogo: sinFotos });
  await expect(page.locator('#masPedido')).toBeHidden();
});

test('las categorías son filtros: «Todos» y una por categoría, debajo de lo más pedido', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await expect(page.locator('#cats .cat')).toHaveText(['Todos', 'Contenedores', 'Vasos y platos', 'Aseo']);
  await expect(page.locator('#cats .cat').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await page.locator('#cats .cat', { hasText: 'Aseo' }).click();
  await expect(page.locator('#tituloVitrina')).toHaveText('Aseo');
  await expect(page.locator('#grilla li')).toHaveCount(2);
  expect((await page.locator('#grilla li h3').allTextContents()).sort()).toEqual(['Detergente en polvo 1 kg', 'Servilleta 25x25 x300 und']);
  await expect(page.locator('#rotan li')).toHaveCount(3);   /* lo más pedido no se filtra */
  await page.locator('#cats .cat', { hasText: 'Todos' }).click();
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  /* la fila de categorías de antes (con fotos, arriba) ya no está */
  await expect(page.locator('#cats img')).toHaveCount(0);
  const orden = await page.evaluate(() => {
    const y = (/** @type {string} */ s) => /** @type {Element} */ (document.querySelector(s)).getBoundingClientRect().top;
    return y('#masPedido') < y('#cats') && y('#cats') < y('#grilla');
  });
  expect(orden).toBe(true);
  v.sinProblemas();
});

test('un enlace con #c= abre la tienda con esa categoría puesta, por nombre o por su comienzo', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#c=vasos' });
  await expect(page.locator('#tituloVitrina')).toHaveText('Vasos y platos');
  await expect(page.locator('#cats .cat', { hasText: 'Vasos y platos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#grilla li')).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  /* y con la tienda abierta, otro enlace cambia el filtro */
  await page.evaluate(() => { location.hash = '#c=Contenedores'; });
  await expect(page.locator('#tituloVitrina')).toHaveText('Contenedores');
});

test('un #c= que no existe abre la tienda con todo', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#c=mangueras' });
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  await expect(page.locator('#grilla li')).toHaveCount(8);
  v.sinProblemas();
});

test('celular: arriba solo el buscador y la cuenta, en una fila; el logo y «Tienda en línea» van en el pie', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.locator('.cab .logo')).toBeHidden();
  const fila = await page.evaluate(() => {
    const b = /** @type {Element} */ (document.querySelector('.cab .buscar')).getBoundingClientRect();
    const c = /** @type {Element} */ (document.querySelector('.cab .btn-cuenta')).getBoundingClientRect();
    return Math.abs((b.top + b.bottom) / 2 - (c.top + c.bottom) / 2);
  });
  expect(fila).toBeLessThan(4);
  await expect(page.getByText('TIENDA', { exact: true })).toHaveCount(0);
  const pie = page.locator('footer.pie');
  await expect(pie.locator('.pie-tienda')).toHaveText('Tienda en línea');
  await expect(pie.locator('.pie-logo img')).toHaveAttribute('src', '/tienda/img/logo-color.svg');
  await expect(pie.getByRole('link', { name: 'Todos los productos' })).toHaveAttribute('href', '#vitrina');
});

test('computador: el logo sigue arriba, sin «Tienda en línea» al lado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTienda(page);
  await expect(page.locator('.cab .logo img')).toBeVisible();
  await expect(page.locator('.cab .logo')).toHaveText('');
});
