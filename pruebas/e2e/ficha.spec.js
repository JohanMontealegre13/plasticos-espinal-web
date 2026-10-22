/* Ficha de cada producto: se abre con un toque, tiene su propia dirección (#p=ID) para compartir,
   sugiere productos de la misma categoría y el botón «atrás» del celular la cierra sin salir de la tienda. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const CATALOGO_CRM = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));

test('tocar el nombre abre la ficha y «atrás» la cierra sin salir', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla').getByText('Contenedor icopor J1 x25 und').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page).toHaveURL(/#p=141$/);
  await page.goBack();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).toHaveURL(/\/tienda\/$/);
});
test('el enlace #p= abre la ficha con «También le sirve» de su categoría', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await expect(page.locator('#fichaNombre')).toHaveText('Contenedor icopor J1 x25 und');
  await expect(page.locator('#parecidos li')).toHaveCount(2);   /* 131 y 305, misma categoría */
});
test('un enlace a un producto que ya no está avisa y deja la tienda normal', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=999' });
  await expect(page.locator('#avisoFicha')).toHaveText('Ese producto ya no está en la tienda.');
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).not.toHaveURL(/#p=/);
  v.sinProblemas();
});
test('agregar desde la ficha suma en la canasta', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.locator('#ficha').getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await expect(page.locator('#n')).toHaveText('1');
});
test('compartir sin navigator.share abre WhatsApp con el enlace', async ({ page }) => {
  await page.addInitScript(() => { delete Navigator.prototype.share; });
  await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  const popup = page.waitForEvent('popup');
  await page.locator('#compartir').click();
  const wa = await popup;
  await wa.waitForURL(/wa\.me/);
  expect(wa.url()).toContain(encodeURIComponent('/tienda/#p=141'));
});

/* ---------- Lo que se agregó además de lo pedido en la tarea ---------- */

test('tocar la foto también abre la ficha, con el precio y que está disponible', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).locator('.foto').click();
  await expect(page.locator('#fichaNombre')).toHaveText('Contenedor icopor J1 x25 und');
  await expect(page.locator('#fichaPrecio')).toHaveText('$9.800');
  await expect(page.locator('#fichaDisp')).toHaveText('Disponible');
  await expect(page.locator('#fichaCodigo')).toHaveText('Código 141');
  await expect(page).toHaveURL(/#p=141$/);
});

test('el nombre de la tarjeta sigue siendo solo el nombre del producto', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('#grilla li h3').first()).toHaveText('Contenedor icopor J1 x25 und');
  await expect(page.locator('#grilla li h3 button').first()).toBeVisible();
});

test('con la ficha cerrada no hay botones repetidos en la página', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' })).toHaveCount(1);
});

test('entrando por el enlace, ✕ cierra la ficha y la tienda queda donde está', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await expect(page.locator('#ficha')).toBeVisible();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).not.toHaveURL(/#p=/);
  expect(new URL(page.url()).pathname).toBe('/tienda/');
  await expect(page.locator('#grilla li').first()).toBeVisible();
  v.sinProblemas();
});

test('entrando por el enlace, Escape cierra la ficha sin sacar de la tienda', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await expect(page.locator('#ficha')).toBeVisible();
  const entradas = await page.evaluate(() => history.length);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).not.toHaveURL(/#p=/);
  expect(await page.evaluate(() => history.length), 'no deja una entrada de más en el historial').toBe(entradas);
  expect(new URL(page.url()).pathname).toBe('/tienda/');
  await expect(page.locator('#grilla li').first()).toBeVisible();
  v.sinProblemas();
});

test('abierta con un toque, Escape y ✕ vuelven a la tienda sin dejar la dirección de la ficha', async ({ page }) => {
  await abrirTienda(page);
  const nombre = page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).locator('h3 button');
  await nombre.click();
  await expect(page.locator('#ficha')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).toHaveURL(/\/tienda\/$/);
  await nombre.click();
  await expect(page.locator('#ficha')).toBeVisible();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).toHaveURL(/\/tienda\/$/);
});

test('al cerrar la ficha el foco vuelve al nombre que la abrió', async ({ page }) => {
  await abrirTienda(page);
  const nombre = page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).locator('h3 button');
  await nombre.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ficha')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(nombre).toBeFocused();
});

test('tocar fuera de la ficha la cierra', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li h3 button').first().click();
  await expect(page.locator('#ficha')).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).toHaveURL(/\/tienda\/$/);
});

test('un producto sugerido abre su propia ficha sin apilar historial: un solo cierre vuelve a la tienda', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).locator('h3 button').click();
  await expect(page).toHaveURL(/#p=141$/);
  const entradas = await page.evaluate(() => history.length);
  await page.locator('#parecidos').getByRole('button', { name: /Tenedor plástico/ }).click();
  await expect(page.locator('#fichaNombre')).toHaveText('Tenedor plástico x100 und');
  await expect(page).toHaveURL(/#p=131$/);
  expect(await page.evaluate(() => history.length), 'saltar a un parecido no apila historial').toBe(entradas);
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).toHaveURL(/\/tienda\/$/);
});

test('«También le sirve» pone primero lo que hay y lo destacado, y deja al final lo agotado', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=228' });   /* Vasos y platos: 210 (hay, destacado), 398 (agotado) */
  const nombres = page.locator('#parecidos li .nm');
  await expect(nombres).toHaveText(['Vaso 7 oz blanco Wau x50 und', 'Plato 23 cm hondo Darnel x20 und']);
  await expect(page.locator('#parecidos li').nth(1)).toContainText('Agotado');
  await page.locator('#fichaCerrar').click();
  await page.goto('/tienda/#p=398');
  await expect(page.locator('#fichaNombre')).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await expect(nombres).toHaveText(['Vaso 7 oz blanco Wau x50 und', 'Pitillo flexible x100 und']);
});

test('la ficha de un producto agotado lo dice y no deja agregarlo', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=398' });
  await expect(page.locator('#fichaDisp')).toHaveText('Agotado');
  await expect(page.locator('#ficha').getByRole('button', { name: 'Agotado' })).toBeDisabled();
});

test('«También le sirve» muestra como máximo seis y se esconde si no hay otro de la categoría', async ({ page }) => {
  const productos = [];
  for (let i = 1; i <= 9; i++) productos.push({ id: 700 + i, nombre: `Cuchara ${i} x50 und`, categoria: 'c1', precio: 3000 + i, disponible: true, destacado: false, foto: '', fotos: [] });
  productos.push({ id: 800, nombre: 'Escoba', categoria: 'c3', precio: 8000, disponible: true, destacado: true, foto: '', fotos: [] });
  await abrirTienda(page, { catalogo: { ...CATALOGO_CRM, productos }, ruta: '/tienda/#p=701' });
  await expect(page.locator('#parecidos li')).toHaveCount(6);
  await page.locator('#fichaCerrar').click();
  await page.goto('/tienda/#p=800');
  await expect(page.locator('#fichaNombre')).toHaveText('Escoba');
  await expect(page.locator('#parecidos li')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'También le sirve' })).toBeHidden();
});

test('el − n + de la ficha y el de la tarjeta se mueven juntos', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).locator('h3 button').click();
  const ficha = page.locator('#ficha');
  await ficha.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await ficha.getByRole('button', { name: 'Agregar uno más de Contenedor icopor J1 x25 und' }).click();
  await expect(ficha.getByLabel('Cantidad de Contenedor icopor J1 x25 und')).toHaveValue('2');
  await expect(page.locator('#n')).toHaveText('2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).getByLabel('Cantidad de Contenedor icopor J1 x25 und')).toHaveValue('2');
});

test('compartir con navigator.share manda el nombre, el precio y el enlace', async ({ page }) => {
  await page.addInitScript(() => {
    window.__compartido = [];
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: (datos) => { window.__compartido.push(datos); return Promise.resolve(); } });
  });
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.locator('#compartir').click();
  const enviado = await page.evaluate(() => window.__compartido);
  expect(enviado).toEqual([{
    title: 'Contenedor icopor J1 x25 und',
    text: 'Contenedor icopor J1 x25 und · $9.800',
    url: new URL('/tienda/#p=141', page.url()).href,
  }]);
});

test('si la persona cancela el menú de compartir no pasa nada: ni error ni WhatsApp', async ({ page }) => {
  const v = vigilar(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: () => Promise.reject(new DOMException('cancelado', 'AbortError')) });
  });
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  let abrio = false;
  page.on('popup', () => { abrio = true; });
  await page.locator('#compartir').click();
  await page.waitForTimeout(300);
  expect(abrio).toBe(false);
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#avisoFicha')).toBeHidden();
  v.sinProblemas();
});

test('#cuenta= sigue abriendo Mi cuenta y la ficha no se mete', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#cuenta=' + encodeURIComponent('/tienda/mi-cuenta/pedidos/') });
  await expect(page.locator('.ventana-cuenta')).toBeVisible();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#avisoFicha')).toBeHidden();
  expect(new URL(page.url()).hash).toContain('#cuenta=');
});

test('una dirección #p= que no es un producto avisa y se limpia', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=constructor' });
  await expect(page.locator('#avisoFicha')).toHaveText('Ese producto ya no está en la tienda.');
  await expect(page).not.toHaveURL(/#p=/);
  v.sinProblemas();
});

test('en el celular la ficha cabe en la pantalla, sin barra de lado, y ✕ se alcanza con el dedo', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));   /* sin la animación de entrada en curso */
  const medidas = await page.evaluate(() => {
    const hoja = document.querySelector('#ficha .ficha-hoja').getBoundingClientRect();
    const x = document.querySelector('#fichaCerrar').getBoundingClientRect();
    return {
      paginaAncha: document.documentElement.scrollWidth > window.innerWidth,
      hojaSale: hoja.left < -0.5 || hoja.right > window.innerWidth + 0.5 || hoja.bottom > window.innerHeight + 0.5,
      /* ninguna parte de la ficha se monta sobre otra: el nombre queda debajo de la foto */
      nombreSobreLaFoto: document.querySelector('#fichaNombre').getBoundingClientRect().top < document.querySelector('#fichaFotos').getBoundingClientRect().bottom - 1
        && document.querySelector('#fichaNombre').getBoundingClientRect().left < document.querySelector('#fichaFotos').getBoundingClientRect().right - 1,
      xAncho: x.width, xAlto: x.height,
    };
  });
  expect(medidas.paginaAncha).toBe(false);
  expect(medidas.hojaSale).toBe(false);
  expect(medidas.nombreSobreLaFoto).toBe(false);
  expect(medidas.xAncho).toBeGreaterThanOrEqual(44);
  expect(medidas.xAlto).toBeGreaterThanOrEqual(44);
});
