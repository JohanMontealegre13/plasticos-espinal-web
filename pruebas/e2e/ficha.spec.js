/* Ficha de cada producto: se abre con un toque, tiene su propia dirección (#p=ID) para compartir,
   sugiere productos de la misma categoría y el botón «atrás» del celular la cierra sin salir de la tienda. */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, abrirCanasta } from './ayudas.js';

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
test('el aviso del enlace viejo es una región viva que está desde el comienzo: el lector de pantalla lo anuncia', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  const aviso = page.locator('#avisoFicha');
  await expect(aviso).toHaveAttribute('role', 'status');
  expect(await aviso.evaluate((e) => /** @type {HTMLElement} */ (e).hidden), 'vacía pero no escondida: ya está en el árbol de accesibilidad').toBe(false);
  await expect(aviso).toBeHidden();                                    /* vacía no ocupa lugar en la pantalla */
  await aviso.evaluate((e) => { e.dataset.prueba = 'el-mismo'; });
  await page.evaluate(() => { location.hash = '#p=999999'; });         /* un enlace viejo con la tienda ya abierta */
  await expect(aviso).toHaveText('Ese producto ya no está en la tienda.');
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveAttribute('data-prueba', 'el-mismo');      /* el texto cambió en el mismo nodo */
  expect(await aviso.evaluate((e) => /** @type {HTMLElement} */ (e).hidden)).toBe(false);
  await page.locator('#grilla').getByText('Contenedor icopor J1 x25 und').click();   /* abrir otra ficha lo borra */
  await expect(aviso).toHaveText('');
  await expect(aviso).toBeHidden();
  v.sinProblemas();
});
test('en un navegador sin <dialog> la ficha cerrada no se pinta al final de la página', async ({ page }) => {
  await abrirTienda(page);
  /* Allá <dialog> es una etiqueta desconocida, sin estilo propio: se imita con otra etiqueta que lleve la clase */
  const sinDialog = await page.evaluate(() => {
    const x = document.createElement('section');
    x.className = 'ficha';
    document.body.appendChild(x);
    const fuera = getComputedStyle(x).display;
    x.setAttribute('open', '');
    return { cerrada: fuera, abierta: getComputedStyle(x).display };
  });
  expect(sinDialog).toEqual({ cerrada: 'none', abierta: 'block' });
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
    /** @type {any} */ (window).__compartido = [];
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: (/** @type {any} */ datos) => { /** @type {any} */ (window).__compartido.push(datos); return Promise.resolve(); } });
  });
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.locator('#compartir').click();
  const enviado = await page.evaluate(() => /** @type {any} */ (window).__compartido);
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

/* ---- Pie fijo de la ficha: el botón y cuándo llega, siempre a la vista; y la confianza junto a lo que se compra ---- */
test('el pie de la ficha trae el botón y cuándo llega; a lo agotado no le promete llegada', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=141', hora: '2026-10-22T10:00:00-05:00' });
  const pie = page.locator('#ficha .ficha-pie');
  await expect(pie.locator('#fichaLlegaTexto')).toHaveText('Llega hoy antes de las 11:00 a. m.');
  await expect(pie.locator('#fichaLimite')).toBeHidden();   /* faltan más de 3 horas para que deje de llegar hoy */
  await pie.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await expect(pie.getByRole('textbox', { name: 'Cantidad de Contenedor icopor J1 x25 und' })).toHaveValue('1');
  await page.evaluate(() => { location.hash = '#p=398'; });   /* Plato 23 cm: agotado */
  await expect(page.locator('#fichaNombre')).toHaveText('Plato 23 cm hondo Darnel x20 und');
  await expect(page.locator('#fichaLlega')).toBeHidden();
  await expect(pie.getByRole('button', { name: 'Agotado' })).toBeDisabled();
  v.sinProblemas();
});

test('faltando pocas horas, el pie dice hasta qué hora pedir para que llegue hoy', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', hora: '2026-10-22T16:00:00-05:00' });
  await expect(page.locator('#fichaLlegaTexto')).toHaveText('Llega hoy antes de las 5:00 p. m.');
  await expect(page.locator('#fichaLimite')).toHaveText('Pidiendo antes de las 5:30 p. m., llega hoy');
});

test('de noche el pie dice que llega mañana y no pone límite', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', hora: '2026-10-22T20:00:00-05:00' });
  await expect(page.locator('#fichaLlegaTexto')).toHaveText('Llega mañana antes de las 9:00 a. m.');
  await expect(page.locator('#fichaLimite')).toBeHidden();
});

test('sin horario el pie queda solo con el botón', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', sitio: (sitio) => { delete sitio.horario; } });
  await expect(page.locator('#fichaLlega')).toBeHidden();
  await expect(page.locator('#ficha .ficha-pie').getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' })).toBeVisible();
});

test('en el celular el botón de la ficha sigue a la vista aunque se baje hasta «También le sirve»', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await abrirTienda(page, { ruta: '/tienda/#p=141', hora: '2026-10-22T10:00:00-05:00' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.locator('#ficha .ficha-cuerpo').evaluate((c) => { c.scrollTop = c.scrollHeight; });
  await expect(page.locator('#parecidosCaja')).toBeInViewport();
  const m = await page.evaluate(() => {
    const b = document.querySelector('#fichaControl button').getBoundingClientRect();
    return { dentro: b.top >= 0 && b.bottom <= window.innerHeight, alto: b.height };
  });
  expect(m.dentro).toBe(true);
  expect(m.alto).toBeGreaterThanOrEqual(44);
});

test('la ficha y la canasta dicen cómo se paga y dónde están los cambios y el retracto', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  const confianza = page.locator('#ficha .confianza');
  await expect(confianza.locator('li')).toHaveText(['Paga al recibir o con Bre-B', 'Lo lleva el equipo de la tienda', 'Cambios y retracto']);
  await expect(confianza.getByRole('link', { name: 'Cambios y retracto' })).toHaveJSProperty('href', new URL('/tienda/terminos/', page.url()).href);
  await page.locator('#ficha .ficha-pie').getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('#fichaCerrar').click();
  await abrirCanasta(page);
  await expect(page.locator('#resumen .confianza-linea')).toHaveText('Paga al recibir o con Bre-B · Cambios y retracto');
  await expect(page.locator('#resumen .confianza-linea').getByRole('link', { name: 'Cambios y retracto' })).toHaveJSProperty('href', new URL('/tienda/terminos/', page.url()).href);
});

test('«Preguntar por WhatsApp» abre el chat con el nombre y el código del producto', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  const wa = page.locator('#preguntarWa');
  await expect(wa).toBeVisible();
  await expect(wa).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Hola, tengo una pregunta sobre Contenedor icopor J1 x25 und (código 141).'));
  await expect(wa).toHaveAttribute('target', '_blank');
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));   /* medir con la ficha ya quieta */
  expect((await wa.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('sin número de WhatsApp en catalogo.json no sale «Preguntar por WhatsApp»', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', sitio: (sitio) => { delete sitio.whatsapp; } });
  await expect(page.locator('#fichaNombre')).toHaveText('Contenedor icopor J1 x25 und');
  await expect(page.locator('#preguntarWa')).toBeHidden();
});

/* ---- Ficha como pantalla propia: galería con miniaturas, visor, características y descripción ---- */
const conDetalles = () => {
  const c = structuredClone(CATALOGO_CRM);
  const j1 = c.productos.find((/** @type {any} */ p) => p.id === 141);
  j1.fotos = ['uno.jpg', 'dos.jpg', 'tres.jpg'];
  j1.foto = 'uno.jpg';
  j1.descripcion = 'Con tapa de bisagra.\nAguanta comida caliente.';
  j1.detalles = [{ nombre: 'Marca', valor: 'Ejemplo' }, { nombre: 'Contenido', valor: 'x25 und' }, { nombre: '', valor: 'sin nombre' }, { nombre: 'Viene en', valor: 'caja x20 paq = 500 und' }];
  return c;
};

test('la ficha trae las características y la descripción del CRM; lo vacío o dañado no sale', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { ruta: '/tienda/#p=141', catalogo: conDetalles() });
  await expect(page.locator('#fichaCaract dt')).toHaveText(['Marca', 'Contenido', 'Viene en']);
  await expect(page.locator('#fichaCaract dd')).toHaveText(['Ejemplo', 'x25 und', 'caja x20 paq = 500 und']);
  await expect(page.locator('#fichaDesc')).toHaveText('Con tapa de bisagra.\nAguanta comida caliente.');
  await page.evaluate(() => { location.hash = '#p=131'; });   /* el tenedor no trae nada de eso */
  await expect(page.locator('#fichaNombre')).toHaveText('Tenedor plástico x100 und');
  await expect(page.locator('#fichaDetalle')).toBeHidden();
  v.sinProblemas();
});

test('con varias fotos la ficha dice cuál va, trae miniaturas y una miniatura lleva a su foto', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', catalogo: conDetalles() });
  const minis = page.locator('#fichaMinis .galeria-mini');
  await expect(minis).toHaveCount(3);
  await expect(page.locator('#fichaFotos .foto-n')).toHaveText('1 / 3');
  await expect(minis.nth(0)).toHaveAttribute('aria-current', 'true');
  await minis.nth(2).click();
  await expect(page.locator('#fichaFotos .foto-n')).toHaveText('3 / 3');
  await expect(minis.nth(2)).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  expect((await minis.nth(0).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('con una sola foto no hay miniaturas ni «1 / 1», pero sí se puede ampliar', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await expect(page.locator('#fichaMinis')).toBeHidden();
  await expect(page.locator('#fichaFotos .foto-n')).toBeHidden();
  await page.locator('#fichaAmpliar').click();
  await expect(page.locator('#visor')).toBeVisible();
  await expect(page.locator('#visorAnt')).toBeHidden();
  await expect(page.locator('#visorN')).toHaveText('');
});

test('ampliar abre el visor en la foto que se veía; las flechas pasan; Escape lo cierra y la ficha sigue', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', catalogo: conDetalles() });
  await page.locator('#fichaMinis .galeria-mini').nth(1).click();
  await expect(page.locator('#fichaFotos .foto-n')).toHaveText('2 / 3');
  await page.locator('#fichaAmpliar').click();
  await expect(page.locator('#visor')).toBeVisible();
  await expect(page.locator('#visorTira img')).toHaveCount(3);
  await expect(page.locator('#visorN')).toHaveText('2 de 3');
  await expect(page.locator('#visorCerrar')).toBeFocused();
  await page.locator('#visorSig').click();
  await expect(page.locator('#visorN')).toHaveText('3 de 3');
  await expect(page.locator('#visorSig')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#visor')).toBeHidden();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#fichaAmpliar')).toBeFocused();
  await page.keyboard.press('Escape');                          /* el segundo Escape ya cierra la ficha */
  await expect(page.locator('#ficha')).toBeHidden();
});

test('tocar la foto grande también la amplía', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=141', catalogo: conDetalles() });
  await page.locator('#fichaFotos .tira img').first().click();
  await expect(page.locator('#visor')).toBeVisible();
  await page.locator('#visorCerrar').click();
  await expect(page.locator('#visor')).toBeHidden();
});

test('en el celular la ficha es una pantalla propia: ocupa toda la pantalla y la foto va de lado a lado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirTienda(page, { ruta: '/tienda/#p=141' });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const m = await page.evaluate(() => {
    const h = document.querySelector('#ficha .ficha-hoja').getBoundingClientRect();
    const f = document.querySelector('#fichaFotos').getBoundingClientRect();
    return { arriba: Math.round(h.top), abajo: Math.round(window.innerHeight - h.bottom), ancho: Math.round(h.width), fotoAncho: Math.round(f.width) };
  });
  expect(m).toEqual({ arriba: 0, abajo: 0, ancho: 390, fotoAncho: 390 });
});
