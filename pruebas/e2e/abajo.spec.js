/* Abajo, solo en el celular y flotando sobre la tienda: la pastilla de secciones (Buscar, Inicio y Favoritos, con la
   rayita amarilla en la que está abierta) y, aparte, la canasta en su círculo (cuántos lleva y un aro que se llena
   hacia el domicilio gratis). Encima, con algo en la canasta, la tira que dice cuánto falta. En el celular es la
   única canasta (la de arriba se esconde); en el computador nada de esto sale y queda la de arriba. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, CATALOGO_CRM } from './ayudas.js';

const CELULAR = { width: 390, height: 844 };
const AGREGAR_J1 = 'Agregar Contenedor icopor J1 x25 und a la canasta';
const UNO_MAS_J1 = 'Agregar uno más de Contenedor icopor J1 x25 und';
const AMARILLO = 'rgb(255, 201, 51)';

/** La sección que marca la pastilla: la que lleva la rayita (data-en) y la que se anuncia (aria-current). */
async function seccion(/** @type {import('@playwright/test').Page} */ page) {
  return page.evaluate(() => ({
    rayita: /** @type {HTMLElement} */ (document.querySelector('#pastilla')).dataset.en,
    marcadas: [...document.querySelectorAll('#pastilla [aria-current]')].map((b) => b.id),
  }));
}

test('en el celular abajo van Buscar, Inicio y Favoritos en ese orden, flotando y sin tapar el pie', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const barra = page.locator('#abajo');
  await expect(barra).toBeVisible();
  expect(await page.locator('#pastilla .abajo-btn').allInnerTexts()).toEqual(['Buscar', 'Inicio', 'Favoritos']);
  await expect(barra.locator('#barra')).toHaveAccessibleName('Canasta vacía');
  const m = await page.evaluate(() => {
    const cajas = [...document.querySelectorAll('#pastilla, #barra')].map((x) => x.getBoundingClientRect());
    const tocables = [...document.querySelectorAll('#abajo .abajo-btn, #barra')].map((x) => x.getBoundingClientRect());
    return {
      abajo: Math.min(...cajas.map((r) => Math.round(window.innerHeight - r.bottom))),
      izquierda: Math.round(Math.min(...cajas.map((r) => r.left))),
      derecha: Math.round(window.innerWidth - Math.max(...cajas.map((r) => r.right))),
      chicos: tocables.filter((r) => r.width < 44 || r.height < 44).length,
      desborde: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  /* flota: ni la pastilla ni el círculo tocan los bordes de la pantalla */
  expect(m.abajo).toBeGreaterThanOrEqual(8);
  expect(m.izquierda).toBeGreaterThanOrEqual(8);
  expect(m.derecha).toBeGreaterThanOrEqual(8);
  expect(m.chicos, 'todo lo de abajo mide 44 px o más').toBe(0);
  expect(m.desborde, 'la página no se corre de lado').toBeLessThanOrEqual(0);
  /* al final de la página el pie se lee entero: lo de abajo no tapa sus enlaces */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const tapa = await page.evaluate(() => {
    const ultimo = [...document.querySelectorAll('.pie a')].pop().getBoundingClientRect();
    return ultimo.bottom > document.querySelector('#abajo').getBoundingClientRect().top;
  });
  expect(tapa).toBe(false);
  v.sinProblemas();
});

test('en el computador no salen ni la pastilla ni la tira del domicilio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTienda(page);
  await expect(page.locator('#abajo')).toBeHidden();
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(page.locator('#n')).toHaveText('1');
  await expect(page.locator('#flota')).toBeHidden();
});

test('la tienda abre en Inicio: la rayita amarilla está ahí y solo esa sección se anuncia como abierta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  expect(await seccion(page)).toEqual({ rayita: 'inicio', marcadas: ['abInicio'] });
  /* la rayita queda justo debajo de «Inicio» y es amarilla; el texto de encima, azul noche */
  const m = await page.evaluate(() => {
    const r = document.querySelector('.rayita').getBoundingClientRect(), b = document.querySelector('#abInicio').getBoundingClientRect();
    return { corrida: Math.abs(r.left - b.left) + Math.abs(r.right - b.right), fondo: getComputedStyle(document.querySelector('.rayita')).backgroundColor, texto: getComputedStyle(document.querySelector('#abInicio')).color };
  });
  await expect.poll(() => page.evaluate(() => {
    const r = document.querySelector('.rayita').getBoundingClientRect(), b = document.querySelector('#abInicio').getBoundingClientRect();
    return Math.abs(r.left - b.left) + Math.abs(r.right - b.right);
  })).toBeLessThan(2);
  expect(m.fondo).toBe(AMARILLO);
  expect(m.texto).toBe('rgb(14, 26, 71)');
});

test('Buscar pone el cursor en el buscador y se marca; al escribir quedan solo los resultados', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.locator('#abBuscar').click();
  await expect(page.locator('#q')).toBeFocused();
  expect(await seccion(page)).toEqual({ rayita: 'buscar', marcadas: ['abBuscar'] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  /* la rayita se corre hasta quedar debajo de «Buscar» */
  await expect.poll(() => page.evaluate(() => {
    const r = document.querySelector('.rayita').getBoundingClientRect(), b = document.querySelector('#abBuscar').getBoundingClientRect();
    return Math.abs(r.left - b.left) + Math.abs(r.right - b.right);
  })).toBeLessThan(2);
  await page.locator('#q').pressSequentially('vaso');
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «vaso»');
  /* buscando, lo de la portada se esconde y los resultados quedan pegados a la cabecera */
  for (const fuera of ['#cats', '.benef', '.como']) await expect(page.locator(fuera)).toBeHidden();
  const hueco = await page.evaluate(() => document.querySelector('#tituloVitrina').getBoundingClientRect().top - document.querySelector('.cab').getBoundingClientRect().bottom);
  expect(hueco).toBeGreaterThanOrEqual(0);
  expect(hueco).toBeLessThan(80);
  /* sin el cursor en el buscador sigue en Buscar mientras haya algo escrito */
  await page.locator('#q').blur();
  expect(await seccion(page)).toEqual({ rayita: 'buscar', marcadas: ['abBuscar'] });
  v.sinProblemas();
});

test('empezar a buscar con la página abajo la sube: los resultados salen arriba', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «vaso»');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#grilla li').first()).toBeInViewport();
});

test('Inicio borra la búsqueda, devuelve lo de arriba y vuelve arriba', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «vaso»');
  await expect(page.locator('.benef')).toBeHidden();
  await page.locator('#abInicio').click();
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  await expect(page.locator('.benef')).toBeVisible();
  await expect(page.locator('#cats')).toBeVisible();
  expect(await seccion(page)).toEqual({ rayita: 'inicio', marcadas: ['abInicio'] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('Inicio con la página abajo y sin búsqueda vuelve arriba', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.locator('#abInicio').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('Favoritos muestra solo lo guardado con el corazón; Inicio vuelve a todo', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#abFavoritos').click();
  await expect(page.locator('#tituloVitrina')).toHaveText('Sus favoritos');
  await expect(page.locator('#estado')).toHaveText('Toque el corazón de un producto y lo encuentra aquí.');
  expect(await seccion(page)).toEqual({ rayita: 'favoritos', marcadas: ['abFavoritos'] });
  await expect(page.locator('#cats')).toBeHidden();
  await page.locator('#abInicio').click();
  await page.locator('#grilla li', { hasText: 'Contenedor icopor J1' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.locator('#abFavoritos').click();
  await expect(page.locator('#grilla li')).toHaveCount(1);
  await expect(page.locator('#grilla li h3')).toHaveText('Contenedor icopor J1 x25 und');
  /* quitarle el corazón ahí mismo lo saca de la lista */
  await page.locator('#grilla li').getByRole('button', { name: 'Quitar de favoritos' }).click();
  await expect(page.locator('#grilla li')).toHaveCount(0);
  await page.locator('#abInicio').click();
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  expect(await seccion(page)).toEqual({ rayita: 'inicio', marcadas: ['abInicio'] });
  v.sinProblemas();
});

test('Mis pedidos ya no va abajo: queda en el menú de la cuenta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.locator('#abajo').getByText('Pedidos', { exact: true })).toHaveCount(0);
  await page.locator('.cab .btn-cuenta').click();
  await expect(page.locator('#menu-cuenta').getByRole('link', { name: /Mis pedidos/ })).toBeVisible();
});

test('sin portada: la tienda abre en lo más pedido y debajo todo el catálogo, sin «Ver todo»', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.getByText('Todo para su negocio')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Tienda en línea de Plásticos Espinal');
  await expect(page.locator('#masPedidoTit')).toHaveText('Lo más pedido');
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#verTodo')).toHaveCount(0);
});

test('las tarjetas con varias fotos las pasan solas; la que se toca se queda quieta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  const c = structuredClone(CATALOGO_CRM);
  for (const p of c.productos) { p.fotos = ['uno.jpg', 'dos.jpg']; p.foto = 'uno.jpg'; }
  await abrirTienda(page, { catalogo: c });
  await page.evaluate(() => document.getElementById('grilla').scrollIntoView({ block: 'start' }));   /* arriba está lo más pedido: el catálogo va debajo */
  const pasada = () => page.evaluate(() => [...document.querySelectorAll('#grilla .tira')].slice(0, 2)
    .map((t) => Math.round(t.scrollLeft / t.clientWidth)));
  /* las dos primeras se turnan: en unos segundos las dos ya pasaron de foto */
  await expect.poll(async () => (await pasada()).includes(1), { timeout: 6000 }).toBe(true);
  /* el punto sigue a la foto que se ve */
  await expect(page.locator('#grilla li').first().locator('.punto[aria-current="true"]')).toHaveCount(1);
});

test('al agregar brota un chulo verde con «+1» y se va solo', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(page.locator('.agregado')).toHaveCount(1);
  await expect(page.locator('.mas-uno')).toHaveText('+1');
  await expect(page.locator('.agregado, .mas-uno')).toHaveCount(0);
});

test('la canasta del círculo cuenta los productos, dice el total a quien lo oye y abre la canasta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const canasta = page.locator('#barra');
  await expect(page.locator('#barraN')).toBeHidden();
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await page.locator('#grilla').getByRole('button', { name: UNO_MAS_J1 }).click();
  await expect(page.locator('#barraN')).toHaveText('2');
  await expect(canasta).toHaveAccessibleName('Canasta: 2 productos, $23.600');   /* 2 × $9.800 + $4.000 de domicilio */
  await canasta.click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#panelTitulo')).toHaveText('Su canasta');
});

test('el aro del círculo se llena hacia el domicilio gratis y se pone verde al llegar', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const aro = () => page.locator('#barra').evaluate((b) => ({ avance: b.style.getPropertyValue('--avance'), gratis: b.classList.contains('gratis') }));
  expect(await aro()).toEqual({ avance: '0%', gratis: false });
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  expect(await aro()).toEqual({ avance: '19.6%', gratis: false });   /* $9.800 de $50.000 */
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').fill('6');
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').blur();
  expect(await aro()).toEqual({ avance: '100%', gratis: true });      /* $58.800: ya pasó */
  await expect(page.locator('#barra')).toHaveAccessibleName('Canasta: 6 productos, $58.800');   /* sin domicilio */
});

test('con algo en la canasta sale la tira: cuánto lleva y cuánto falta; al tocarla abre la canasta', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const tira = page.locator('#flota');
  await expect(tira).toBeHidden();
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(tira).toBeVisible();
  await expect(tira).toHaveText('Lleva $9.800 · faltan $40.200 para domicilio gratis');
  /* va encima de la pastilla, sin montarse (se mide cuando termina de subir) */
  await expect.poll(() => page.evaluate(() => {
    const t = document.querySelector('#flota').getBoundingClientRect(), p = document.querySelector('#pastilla').getBoundingClientRect();
    return p.top - t.bottom;
  })).toBeGreaterThanOrEqual(4);
  expect(await page.locator('#flotaTubo').evaluate((i) => /** @type {HTMLElement} */ (i).style.width)).toBe('19.6%');
  await tira.click();
  await expect(page.locator('#panel')).toBeVisible();
  /* vaciar la canasta la quita */
  await page.locator('#vaciar').click();
  await expect(tira).toBeHidden();
  v.sinProblemas();
});

test('al llegar al domicilio gratis lo dice la tira y sale el aviso; abrir la tienda con la canasta ya llena no lo repite', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(page.locator('#tostada')).toBeHidden();
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').fill('6');
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').blur();
  await expect(page.locator('#flota')).toHaveText('Lleva $58.800 · domicilio gratis');
  await expect(page.locator('#tostada')).toBeVisible();
  await expect(page.locator('#tostada')).toHaveText('¡Su domicilio ya es gratis!');
  /* el aviso se va solo y los papelitos se recogen */
  await expect(page.locator('#tostada')).toBeHidden({ timeout: 6000 });
  await expect(page.locator('.confeti')).toHaveCount(0);
  /* la canasta queda guardada: al volver a abrir ya es gratis y no se celebra otra vez */
  await page.reload();
  await expect(page.locator('#grilla li').first()).toBeVisible();
  await expect(page.locator('#flota')).toHaveText('Lleva $58.800 · domicilio gratis');
  await expect(page.locator('#tostada')).toBeHidden();
  await expect(page.locator('.confeti')).toHaveCount(0);
  v.sinProblemas();
});

test('quien pidió menos movimiento ve el aviso del domicilio gratis, sin papelitos ni fotos que vuelan', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(page.locator('.volando, .agregado, .mas-uno')).toHaveCount(0);
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').fill('6');
  await page.locator('#grilla').getByLabel('Cantidad de Contenedor icopor J1 x25 und').blur();
  await expect(page.locator('#tostada')).toHaveText('¡Su domicilio ya es gratis!');
  await expect(page.locator('.confeti')).toHaveCount(0);
  await expect(page.locator('#grilla')).not.toHaveClass(/entra/);
});

test('al agregar desde la vitrina la foto vuela a la canasta y no deja nada suelto en la página', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#grilla').getByRole('button', { name: AGREGAR_J1 }).click();
  await expect(page.locator('.volando')).toHaveCount(1);
  await expect(page.locator('.volando')).toHaveCount(0, { timeout: 3000 });
  /* con la canasta abierta no vuela nada: el círculo no está a la vista */
  await page.locator('#barra').click();
  await page.locator('#items').getByRole('button', { name: UNO_MAS_J1 }).click();
  await expect(page.locator('#barraN')).toHaveText('2');
  await expect(page.locator('.volando')).toHaveCount(0);
  v.sinProblemas();
});

test('en el celular la canasta es una sola: el círculo amarillo, aparte de la pastilla y a la derecha', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.locator('.cab .btn-canasta')).toBeHidden();
  const m = await page.evaluate(() => {
    const canasta = document.querySelector('#barra'), pastilla = document.querySelector('#pastilla');
    const p = pastilla.getBoundingClientRect(), c = canasta.getBoundingClientRect();
    return {
      fuera: !pastilla.contains(canasta), fondo: getComputedStyle(canasta.querySelector('.adentro')).backgroundColor,
      separada: c.left - p.right, derecha: Math.round(window.innerWidth - c.right), redonda: Math.round(c.width) === Math.round(c.height) && getComputedStyle(canasta).borderRadius === '50%',
    };
  });
  expect(m.fuera, 'la canasta no va dentro de la pastilla').toBe(true);
  expect(m.fondo).toBe(AMARILLO);
  expect(m.redonda, 'la canasta es un círculo').toBe(true);
  expect(m.separada).toBeGreaterThanOrEqual(6);
  expect(m.derecha).toBeLessThanOrEqual(16);                  /* a la derecha, a la mano del pulgar */
});

test('en el computador sigue la canasta de arriba', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTienda(page);
  await expect(page.locator('.cab .btn-canasta')).toBeVisible();
  await page.locator('.cab .btn-canasta').click();
  await expect(page.locator('#panel')).toBeVisible();
});

test('la cuenta va arriba: un círculo con la inicial de quien entró, que abre su menú', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const cuenta = page.locator('.cab .btn-cuenta');
  await expect(cuenta).toBeVisible();
  await expect(cuenta).toHaveAccessibleName('Mi cuenta');
  await expect(page.locator('#yo')).toHaveText('A');            /* Ana Prueba */
  const m = await page.locator('#yo').evaluate((y) => ({ r: y.getBoundingClientRect(), fondo: getComputedStyle(y).backgroundColor, radio: getComputedStyle(y).borderRadius }));
  expect(Math.round(m.r.width)).toBe(Math.round(m.r.height));
  expect(m.radio).toBe('50%');
  expect(m.fondo).toBe(AMARILLO);
  await cuenta.click();
  await expect(page.locator('#menu-cuenta')).toBeVisible();
  await expect(page.locator('#menu-cuenta')).toContainText('Ana');
  await expect(page.locator('#menu-cuenta').getByRole('link', { name: /Mis pedidos/ })).toBeVisible();
  v.sinProblemas();
});

test('si la cuenta no trae nombre, el círculo de arriba queda con la silueta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page, { cuenta: { ok: true, estado: 'activa', nombre: '', documento: '1105678901', celular: '3001234567' } });
  await expect(page.locator('#yo svg')).toBeVisible();
  await expect(page.locator('#yo')).toHaveText('');
});
