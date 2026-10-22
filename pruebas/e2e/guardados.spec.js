/* Favoritos (el corazón), «vistos hace poco» y «pedir lo de la última vez».
   Todo se guarda solo en este celular (localStorage) y nada de eso puede llenar la canasta
   con algo que ya no está o se agotó, ni romper la página. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

/** Deja un valor guardado ANTES de que cargue la página (solo la primera vez: un reload no lo pisa). */
async function sembrar(/** @type {import('@playwright/test').Page} */ page, /** @type {Record<string, unknown>} */ claves) {
  await page.addInitScript((c) => {
    for (const [k, v] of Object.entries(c)) {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }, claves);
}
const guardado = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ clave) =>
  page.evaluate((k) => localStorage.getItem(k), clave);

/* ---------- lo pedido en la tarea ---------- */

test('un favorito queda después de recargar', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.reload();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
});
test('un favorito que salió del catálogo no aparece', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pe-favoritos-v1', '[777]'));
  await abrirTienda(page);
  await expect(page.locator('#favoritos')).toBeHidden();
});
test('lo de la última vez suma lo disponible y avisa lo que no', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pe-ultimo-v1', JSON.stringify([{ id: 141, cantidad: 2 }, { id: 398, cantidad: 1 }])));
  await abrirTienda(page);
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#items li')).toHaveCount(1);
  await expect(page.locator('#noEstan')).toHaveText('No están hoy: Plato 23 cm hondo Darnel x20 und');
});
test('sin nada guardado no se ven favoritos, vistos ni «última vez»', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('#favoritos')).toBeHidden();
  await expect(page.locator('#vistos')).toBeHidden();
  await expect(page.locator('#ultimaVez')).toBeHidden();
});

/* ---------- el corazón ---------- */

test('el corazón de la ficha y el de la tarjeta son el mismo favorito', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  const tarjeta = page.locator('#grilla li', { hasText: 'Contenedor icopor' });
  await expect(tarjeta.getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
  await tarjeta.locator('.nombre').click();   /* el nombre abre la ficha */
  const enFicha = page.locator('#ficha').getByRole('button', { name: 'Guardar en favoritos' });
  await expect(enFicha).toHaveAttribute('aria-pressed', 'false');
  await enFicha.click();
  await expect(page.locator('#ficha').getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fichaCerrar').click();
  await expect(tarjeta.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  /* y se quita desde la tarjeta: la ficha, al abrirla otra vez, ya lo sabe */
  await tarjeta.getByRole('button', { name: 'Quitar de favoritos' }).click();
  await expect(page.locator('#favoritos')).toBeHidden();
  await tarjeta.locator('.nombre').click();
  await expect(page.locator('#ficha').getByRole('button', { name: 'Guardar en favoritos' })).toHaveAttribute('aria-pressed', 'false');
  v.sinProblemas();
});

test('tocar el corazón de una tarjeta no abre la ficha ni cuenta como visto', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page).not.toHaveURL(/#p=/);
  await expect(page.locator('#vistos')).toBeHidden();
});

test('el corazón mide 44 px o más, en la tarjeta y en la ficha', async ({ page }) => {
  await abrirTienda(page);
  const tarjeta = await page.locator('#grilla li').first().locator('.fav').boundingBox();
  expect(tarjeta.width).toBeGreaterThanOrEqual(44);
  expect(tarjeta.height).toBeGreaterThanOrEqual(44);
  await page.locator('#grilla li').first().locator('.nombre').click();
  const ficha = await page.locator('#fichaFav').boundingBox();
  expect(ficha.width).toBeGreaterThanOrEqual(44);
  expect(ficha.height).toBeGreaterThanOrEqual(44);
});

test('las secciones de favoritos y vistos tienen su título y no repiten el botón de agregar', async ({ page }) => {
  await sembrar(page, { 'pe-favoritos-v1': [141, 131], 'pe-vistos-v1': [141] });
  await abrirTienda(page);
  await expect(page.getByRole('heading', { name: 'Sus favoritos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lo que vio hace poco' })).toBeVisible();
  await expect(page.locator('#favoritos li')).toHaveCount(2);
  /* 141 está en la vitrina, en favoritos y en vistos: el botón de agregar es uno solo */
  await expect(page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' })).toHaveCount(1);
  await expect(page.locator('#favoritos').getByRole('button', { name: /Agregar|Agotado/ })).toHaveCount(0);
});

test('la página no se ensancha aunque haya muchos favoritos', async ({ page }) => {
  await sembrar(page, { 'pe-favoritos-v1': [141, 131, 191, 210, 228, 305, 398, 520] });
  await abrirTienda(page);
  await expect(page.locator('#favoritos li')).toHaveCount(8);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test('guardar un favorito no mueve la vitrina que se está mirando', async ({ page }) => {
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('vitrina').offsetTop - 60));
  const antes = await page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top));
  await page.locator('#grilla li').first().getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await expect.poll(() => page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(antes);
});

test('abrir y cerrar la primera ficha no mueve la vitrina, aunque «vistos» aparezca arriba', async ({ page }) => {
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('vitrina').offsetTop - 60));
  const antes = await page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top));
  await page.locator('#grilla li').first().locator('.nombre').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#vistos li')).toHaveCount(1);
  await expect.poll(() => page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(antes);
});

test('guardar el primer favorito desde la ficha y volver con «atrás» tampoco mueve la vitrina', async ({ page }) => {
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('vitrina').offsetTop - 60));
  const antes = await page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top));
  await page.locator('#grilla li').first().locator('.nombre').click();
  await page.locator('#ficha').getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.goBack();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await expect.poll(() => page.locator('#vitrina').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(antes);
});

/* ---------- vistos hace poco ---------- */

test('lo que se abre en la ficha queda en «vistos», lo último primero, y sigue ahí al recargar', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('#vistos')).toBeHidden();
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).locator('.nombre').click();
  await page.locator('#fichaCerrar').click();
  await page.locator('#grilla li', { hasText: 'Tenedor plástico' }).locator('.nombre').click();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#vistos li')).toHaveCount(2);
  await expect(page.locator('#vistos li').first()).toContainText('Tenedor plástico');
  /* volver a abrir uno lo pone de primero, sin repetirlo */
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).locator('.nombre').click();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#vistos li')).toHaveCount(2);
  await expect(page.locator('#vistos li').first()).toContainText('Contenedor icopor');
  await page.reload();
  await expect(page.locator('#vistos li')).toHaveCount(2);
  await expect(page.locator('#vistos li').first()).toContainText('Contenedor icopor');
});

test('entrar por un enlace #p= también cuenta como visto', async ({ page }) => {
  await abrirTienda(page, { ruta: '/tienda/#p=131' });
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#vistos li')).toHaveCount(1);
  await expect(page.locator('#vistos li')).toContainText('Tenedor plástico');
});

test('«vistos» guarda 12 como máximo', async ({ page }) => {
  await sembrar(page, { 'pe-vistos-v1': [131, 191, 210, 228, 305, 398, 520, 901, 902, 903, 904, 905] });   /* los 901 en adelante ya no existen */
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).locator('.nombre').click();
  const guardados = JSON.parse(await guardado(page, 'pe-vistos-v1'));
  expect(guardados).toHaveLength(12);
  expect(guardados[0]).toBe(141);
  expect(guardados).not.toContain(905);
});

test('un visto que salió del catálogo no aparece', async ({ page }) => {
  await sembrar(page, { 'pe-vistos-v1': [777, 131] });
  await abrirTienda(page);
  await expect(page.locator('#vistos li')).toHaveCount(1);
  await expect(page.locator('#vistos li')).toContainText('Tenedor plástico');
});

test('al cerrar la ficha que se abrió desde «vistos», el foco vuelve a esa tarjeta', async ({ page }) => {
  await sembrar(page, { 'pe-vistos-v1': [131, 141] });
  await abrirTienda(page);
  await page.locator('#vistos li', { hasText: 'Contenedor icopor' }).getByRole('button').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#fichaNombre')).toHaveText('Contenedor icopor J1 x25 und');
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#vistos [data-ficha="141"]')).toBeFocused();
});

/* ---------- favoritos y vistos agotados ---------- */

test('un favorito agotado se ve con su sello, abre su ficha y no se puede agregar', async ({ page }) => {
  await sembrar(page, { 'pe-favoritos-v1': [398], 'pe-vistos-v1': [398] });
  await abrirTienda(page);
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await expect(page.locator('#favoritos li')).toContainText('Plato 23 cm hondo Darnel x20 und');
  await expect(page.locator('#favoritos li').getByText('Agotado')).toBeVisible();
  await expect(page.locator('#vistos li').getByText('Agotado')).toBeVisible();
  await page.locator('#favoritos li').getByRole('button').click();
  await expect(page.locator('#fichaDisp')).toHaveText('Agotado');
  await expect(page.locator('#ficha').getByRole('button', { name: /^Agregar/ })).toHaveCount(0);
  await expect(page.locator('#n')).toBeHidden();
});

/* ---------- mientras se busca ---------- */

test('mientras hay una búsqueda, favoritos y vistos se esconden; espacios solos no cuentan', async ({ page }) => {
  await sembrar(page, { 'pe-favoritos-v1': [141], 'pe-vistos-v1': [131] });
  await abrirTienda(page);
  await expect(page.locator('#favoritos')).toBeVisible();
  await expect(page.locator('#vistos')).toBeVisible();
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#favoritos')).toBeHidden();
  await expect(page.locator('#vistos')).toBeHidden();
  await page.locator('#q').fill('   ');
  await expect(page.locator('#favoritos')).toBeVisible();
  await expect(page.locator('#vistos')).toBeVisible();
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#favoritos')).toBeHidden();
  await page.locator('#q').fill('');
  await expect(page.locator('#favoritos')).toBeVisible();
  await expect(page.locator('#vistos')).toBeVisible();
});

test('guardar un favorito mientras se busca no lo muestra hasta que se limpie la búsqueda', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#q').fill('contenedor');
  await page.locator('#grilla li').getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos')).toBeHidden();
  await page.locator('#q').fill('');
  await expect(page.locator('#favoritos li')).toHaveCount(1);
});

/* ---------- pedir lo de la última vez ---------- */

test('lo de la última vez se SUMA a lo que ya hay en la canasta', async ({ page }) => {
  await sembrar(page, { 'pe-ultimo-v1': [{ id: 141, cantidad: 2 }, { id: 131, cantidad: 1 }] });
  await abrirTienda(page);
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#items li')).toHaveCount(2);
  await expect(page.locator('#items').getByLabel('Cantidad de Contenedor icopor J1 x25 und')).toHaveValue('3');
  await expect(page.locator('#items').getByLabel('Cantidad de Tenedor plástico x100 und')).toHaveValue('1');
  await expect(page.locator('#noEstan')).toBeHidden();
  /* la vitrina también se enteró */
  await page.locator('#cerrar').click();
  await expect(page.locator('#n')).toHaveText('4');
});

test('el aviso de lo que no está se quita al abrir la canasta otra vez', async ({ page }) => {
  await sembrar(page, { 'pe-ultimo-v1': [{ id: 141, cantidad: 1 }, { id: 398, cantidad: 1 }, { id: 777, cantidad: 3 }] });
  await abrirTienda(page);
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#noEstan')).toHaveText('No están hoy: Plato 23 cm hondo Darnel x20 und, Código 777');
  await page.locator('#cerrar').click();
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#noEstan')).toBeHidden();
});

test('el aviso de lo que no está sale solo en la canasta, no en los datos de entrega', async ({ page }) => {
  await sembrar(page, { 'pe-ultimo-v1': [{ id: 141, cantidad: 1 }, { id: 398, cantidad: 1 }] });
  await abrirTienda(page);
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#noEstan')).toBeVisible();
  await page.locator('#seguir').click();
  await expect(page.locator('#datos')).toBeVisible();
  await expect(page.locator('#noEstan')).toBeHidden();
  await page.locator('#volver').click();
  await expect(page.locator('#noEstan')).toBeVisible();
});

test('si nada de lo de la última vez está hoy, el botón no sale y la canasta no se toca', async ({ page }) => {
  await sembrar(page, { 'pe-ultimo-v1': [{ id: 398, cantidad: 1 }, { id: 777, cantidad: 2 }] });
  await abrirTienda(page);
  await expect(page.locator('#ultimaVez')).toBeHidden();
  await expect(page.locator('#n')).toBeHidden();
});

test('lo de la última vez respeta el tope de 999 por línea', async ({ page }) => {
  await sembrar(page, { 'pe-ultimo-v1': [{ id: 141, cantidad: 900 }], 'pe-canasta-v1': { 141: 500 } });
  await abrirTienda(page);
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#items').getByLabel('Cantidad de Contenedor icopor J1 x25 und')).toHaveValue('999');
});

/* ---------- el pedido enviado se recuerda ---------- */

/** Llena la canasta con el contenedor y llega hasta el botón «Seguir al pago» con los datos listos. */
async function hastaElEnvio(/** @type {import('@playwright/test').Page} */ page) {
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.getByRole('button', { name: 'Agregar uno más de Contenedor icopor J1 x25 und' }).click();
  await page.locator('.btn-canasta').click();
  await page.locator('#seguir').click();
  await page.locator('#d-nombre').fill('Restaurante La Plaza');
  await page.locator('#d-doc').fill('1105678901');
  await page.locator('#d-cel').fill('3183555246');
  await page.locator('#d-barrio').fill('El Centro');
  await page.locator('#d-dir').fill('Calle 7 número 5-35 local 2');
  await page.locator('#d-acepto').check();
}

test('al enviar un pedido con éxito se guarda lo de la última vez y el botón sale', async ({ page }) => {
  const v = vigilar(page);
  await page.route(/\/tienda\/mi-cuenta\/api\/tienda\/pedido(\/.*)?$/, (r) => r.fulfill({
    json: { ok: true, codigo: 'PW-0001', secreto: 's', total: 23600, estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar' },
  }));
  await abrirTienda(page);
  await hastaElEnvio(page);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(JSON.parse(await guardado(page, 'pe-ultimo-v1'))).toEqual([{ id: 141, cantidad: 2 }]);
  expect(JSON.parse(await guardado(page, 'pe-canasta-v1'))).toEqual({});
  await page.locator('#cerrar').click();
  await expect(page.locator('#ultimaVez')).toBeVisible();
  /* y con un toque vuelve a armar esa canasta */
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#items').getByLabel('Cantidad de Contenedor icopor J1 x25 und')).toHaveValue('2');
  v.sinProblemas();
});

test('si el pedido no se pudo enviar no se guarda como «última vez» y la canasta sigue', async ({ page }) => {
  await page.route(/\/tienda\/mi-cuenta\/api\/tienda\/pedido(\/.*)?$/, (r) => r.fulfill({ status: 500, json: { ok: false, error: 'No pudimos' } }));
  await abrirTienda(page);
  await hastaElEnvio(page);
  await page.locator('#enviar').click();
  await expect(page.locator('#errores')).toHaveText('No pudimos');
  expect(await guardado(page, 'pe-ultimo-v1')).toBeNull();
  expect(JSON.parse(await guardado(page, 'pe-canasta-v1'))).toEqual({ 141: 2 });
  await expect(page.locator('#ultimaVez')).toBeHidden();
});

/* ---------- sin almacenamiento o con datos dañados ---------- */

test('con datos dañados la tienda abre normal, sin errores ni secciones', async ({ page }) => {
  const v = vigilar(page);
  await sembrar(page, { 'pe-favoritos-v1': '{roto', 'pe-vistos-v1': '{"a":1}', 'pe-ultimo-v1': '5' });
  await abrirTienda(page);
  await expect(page.locator('#favoritos')).toBeHidden();
  await expect(page.locator('#vistos')).toBeHidden();
  await expect(page.locator('#ultimaVez')).toBeHidden();
  /* y se puede seguir guardando encima de lo dañado */
  await page.locator('#grilla li').first().getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  v.sinProblemas();
});

test('con listas que traen basura, se usa solo lo que sirve', async ({ page }) => {
  const v = vigilar(page);
  await sembrar(page, {
    'pe-favoritos-v1': [null, 'x', 141, 141, { id: 131 }, -4, 2.5, '131', 131],
    'pe-vistos-v1': [[], 131, true],
    'pe-ultimo-v1': [null, 7, { id: 141 }, { id: 'a', cantidad: 1 }, { id: 131, cantidad: 2 }],
  });
  await abrirTienda(page);
  await expect(page.locator('#favoritos li')).toHaveCount(2);   /* 141 y 131, cada uno una vez */
  await expect(page.locator('#vistos li')).toHaveCount(1);
  await page.locator('#ultimaVez').click();
  await expect(page.locator('#items li')).toHaveCount(1);
  await expect(page.locator('#items').getByLabel('Cantidad de Tenedor plástico x100 und')).toHaveValue('2');
  await expect(page.locator('#noEstan')).toBeHidden();
  v.sinProblemas();
});

test('sin localStorage (bloqueado) la tienda sigue y los corazones valen mientras la página esté abierta', async ({ page }) => {
  const v = vigilar(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
  });
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).locator('.nombre').click();
  await page.locator('#fichaCerrar').click();
  await expect(page.locator('#vistos li')).toHaveCount(1);
  await expect(page.locator('#ultimaVez')).toBeHidden();
  v.sinProblemas();
});

test('si guardar falla (almacenamiento lleno) los corazones valen mientras la página esté abierta', async ({ page }) => {
  const v = vigilar(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('lleno', 'QuotaExceededError'); };
  });
  await abrirTienda(page);
  await page.locator('#grilla li', { hasText: 'Contenedor icopor' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await page.locator('#grilla li', { hasText: 'Tenedor plástico' }).getByRole('button', { name: 'Guardar en favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(2);
  await page.locator('#grilla li', { hasText: 'Tenedor plástico' }).getByRole('button', { name: 'Quitar de favoritos' }).click();
  await expect(page.locator('#favoritos li')).toHaveCount(1);
  v.sinProblemas();
});
