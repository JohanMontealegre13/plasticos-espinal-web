/* Página pública: carga limpia con la CSP real de _headers, anclas y la 404. */
import { test, expect } from '@playwright/test';
import { vigilar } from './ayudas.js';

test('el inicio carga sin errores de JS, de CSP ni recursos rotos', async ({ page }) => {
  const v = vigilar(page);
  const r = await page.goto('/');
  expect(r?.status()).toBe(200);
  await expect(page.locator('h1')).toBeVisible();
  /* El script embebido corrió (si la CSP lo bloquea, la clase js no aparece) */
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  /* El JS externo corrió: pone el año en el pie */
  await expect(page.locator('#anio')).toHaveText(String(new Date().getFullYear()));
  /* La hoja de estilos cargó: la fuente de los títulos es Archivo Black */
  expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Archivo');
  await page.evaluate(() => document.fonts.ready);
  v.sinProblemas();
});

test('la portada dice qué vendemos y para quién, sin competir por precio, y el título no tapa lo de la foto', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  /* La frase de Johan (10-nov-2026): nada de «precio de bodega» en toda la página */
  await expect(page.locator('h1')).toHaveText('Empaques plásticos, desechables y biodegradables para su negocio y hogar');
  /* El precio mayorista se ofrece como un hecho (su banner), pero no es el lema de nada */
  expect(await page.content()).not.toMatch(/precio de (bodega|distribuidora)/i);
  const m = await page.evaluate(() => {
    const caja = (/** @type {string} */ s) => /** @type {Element} */ (document.querySelector(s)).getBoundingClientRect();
    const foto = caja('.portada__foto'), h1 = caja('.portada h1'), marco = caja('.portada__marco'), resto = caja('.portada__resto');
    return { ancho: innerWidth, finTitulo: (h1.bottom - foto.top) / foto.height, sobra: marco.bottom - resto.bottom,
      etiqueta: caja('.portada__etiqueta').height };
  });
  /* La etiqueta va en un solo renglón: si se parte, empuja el título sobre los productos */
  expect(m.etiqueta).toBeLessThan(40);
  if (m.ancho < 600) expect(m.finTitulo, 'el título baja hasta los productos de la foto').toBeLessThan(0.54);
  if (m.ancho >= 1100) expect(m.sobra, 'el botón se sale de la foto').toBeGreaterThanOrEqual(0);
});

test('el punto de la etiqueta es verde y late como «en línea»; con «menos movimiento» queda quieto', async ({ page }) => {
  await page.goto('/');
  const punto = () => page.locator('.portada__etiqueta').evaluate((e) => {
    const a = getComputedStyle(e, '::before'), b = getComputedStyle(e, '::after');
    return { color: a.backgroundColor, onda: b.animationName, repite: b.animationIterationCount };
  });
  expect(await punto()).toEqual({ color: 'rgb(22, 163, 74)', onda: 'en-linea', repite: 'infinite' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await punto()).onda).toBe('none');
});

test('Regresión (e7352f9): al recargar con un #ancla la página abre arriba y sin ancla', async ({ page }) => {
  await page.goto('/#contacto');
  await page.waitForLoadState('load');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('solo tres botones de WhatsApp (cabecera, portada y contacto), al número del negocio con mensaje', async ({ page }) => {
  await page.goto('/');
  /* Johan, 10-nov-2026: «le estamos vendiendo demasiado». Ni burbuja, ni WhatsApp en el pie, sectores o banners */
  const enlaces = page.locator('a[href^="https://wa.me/"]');
  await expect(enlaces).toHaveCount(3);
  await expect(page.locator('.cabecera a[href^="https://wa.me/"]')).toHaveCount(1);
  await expect(page.locator('#inicio a[href^="https://wa.me/"]')).toHaveCount(1);
  await expect(page.locator('#contacto a[href^="https://wa.me/"]')).toHaveCount(1);
  for (const href of await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
    expect(href).toMatch(/^https:\/\/wa\.me\/573183555246\?text=/);
  }
  /* Los sectores enseñan lo que se lleva cada negocio: van al catálogo, no a WhatsApp */
  const sectores = await page.locator('#sectores a.sector').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(sectores).toHaveLength(6);
  for (const h of sectores) expect(h).toMatch(/^\/productos\/(\?(categoria|q)=[a-z-]+)?$/);
});

/* Las marcas de la cinta, en su orden (confirmadas por Johan, 10-nov-2026) */
const MARCAS = ['Darnel', 'El Sol', 'Ajover', 'Prodía', 'Wau', 'Acme León', 'Frutaroma', 'Carvajal', 'Casa Best', 'House', 'Surtiplast', 'Darnel BIO', 'Vacán', 'Prodalum'];

test('la cinta de marcas muestra el logo de cada marca con sus colores, se puede pausar y vuelve a correr', async ({ page }) => {
  const v = vigilar(page);
  await page.goto('/');
  const cinta = page.locator('[data-marcas]');
  await cinta.scrollIntoViewIfNeeded();
  /* La primera lista se lee; las copias de la vuelta no. Todas con logo: ninguna con solo el nombre */
  expect(await cinta.getByRole('img').evaluateAll((is) => is.map((i) => i.getAttribute('alt')))).toEqual(MARCAS);
  const leida = cinta.locator('.marcas__lista:not([aria-hidden])');
  await expect(leida.locator('li')).toHaveCount(MARCAS.length);
  await expect(leida.locator('li:not(:has(img))')).toHaveCount(0);
  /* El Sol y Wau llevan la tarjeta del color de su propio fondo */
  await expect(leida.locator('li.marca--sol')).toHaveCSS('background-color', 'rgb(254, 236, 4)');
  await expect(leida.locator('li.marca--wau')).toHaveCSS('background-color', 'rgb(102, 44, 144)');
  await expect(cinta.locator('.marcas__lista[aria-hidden="true"]')).toHaveCount(3);
  for (const img of await cinta.locator('img').all()) expect(await img.evaluate((i) => /** @type {HTMLImageElement} */ (i).naturalWidth)).toBeGreaterThan(0);
  /* Corre sola y el botón la detiene y la vuelve a mover */
  const pista = cinta.locator('.marcas__pista');
  await expect.poll(() => pista.evaluate((e) => getComputedStyle(e).animationName)).toBe('marcas-rodar');
  const pausa = cinta.getByRole('button', { name: 'Pausar las marcas' });
  await pausa.click();
  await expect(pista).toHaveCSS('animation-play-state', 'paused');
  await cinta.getByRole('button', { name: 'Seguir moviendo las marcas' }).click();
  await page.mouse.move(0, 0);
  await expect(pista).toHaveCSS('animation-play-state', 'running');
  expect((await pausa.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  v.sinProblemas();
});

test('con «menos movimiento» la cinta de marcas no corre: cada marca una vez y sin botón de pausa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const cinta = page.locator('[data-marcas]');
  await expect(cinta.locator('#marcasPausa')).toBeHidden();
  await expect(cinta.locator('.marcas__lista[aria-hidden="true"]').first()).toBeHidden();
  await expect(cinta.locator('img:visible')).toHaveCount(MARCAS.length);
  /* Ninguna queda cortada por los lados: bajan a otro renglón */
  const lados = await cinta.locator('.marcas__lista:not([aria-hidden]) li').evaluateAll((ls) => ls.map((l) => { const r = l.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }));
  expect(lados).toHaveLength(MARCAS.length);
  expect(lados.every(Boolean)).toBe(true);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});

test('el menú lleva a secciones que existen', async ({ page }) => {
  await page.goto('/');
  for (const href of await page.locator('.menu a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
    await expect(page.locator(String(href))).toHaveCount(1);
  }
});

test('Regresión (5275792): la 404 en una subcarpeta carga sus estilos e imágenes', async ({ page }) => {
  const v = vigilar(page);
  const r = await page.goto('/una/carpeta/que-no-existe');
  expect(r?.status()).toBe(404);
  await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible();
  expect(await page.locator('body').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Archivo');
  v.sinProblemas();
});

test('en celular el inicio no tiene desplazamiento horizontal', async ({ page }) => {
  await page.goto('/');
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});

/* ---------- Inicio nuevo (patrones de tienda grande, 9-nov-2026) ---------- */

test('el carrusel de categorías: flechas y puntos mueven la fila y la pausa se puede quitar y poner', async ({ page }) => {
  const v = vigilar(page);
  await page.goto('/');
  const carrusel = page.locator('[data-carrusel]');
  const pista = carrusel.locator('.carrusel__pista');
  await carrusel.scrollIntoViewIfNeeded();
  await expect(carrusel).toHaveAttribute('aria-roledescription', 'carrusel');
  await expect(pista.locator('> li')).toHaveCount(10);
  const anterior = carrusel.getByRole('button', { name: 'Anteriores' });
  const siguientes = carrusel.getByRole('button', { name: 'Siguientes' });
  await expect(anterior).toBeDisabled();
  await siguientes.click();
  await expect.poll(() => pista.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  await expect(carrusel.locator('.carrusel__punto[aria-current="true"]')).toHaveAttribute('aria-label', /^Ir al grupo 2 de/);
  await carrusel.getByRole('button', { name: /^Ir al grupo 1 de/ }).click();
  await expect.poll(() => pista.evaluate((e) => e.scrollLeft)).toBe(0);
  /* Tocar el carrusel apaga el avance solo; la pausa lo vuelve a prender */
  await expect(carrusel.getByRole('button', { name: 'Seguir moviendo el carrusel' })).toBeVisible();
  await carrusel.getByRole('button', { name: 'Seguir moviendo el carrusel' }).click();
  await expect(carrusel.getByRole('button', { name: 'Pausar el carrusel' })).toBeVisible();
  v.sinProblemas();
});

test('el carrusel avanza solo cada 5 s mientras nadie lo toca', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const pista = page.locator('.carrusel__pista');
  await pista.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.clock.runFor(5200);
  await expect.poll(() => pista.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
});

test('con «menos movimiento» el carrusel no avanza solo y nada queda escondido', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/revela-listo/);
  await expect(page.locator('.carrusel__pausa')).toHaveCount(0);
  await page.clock.runFor(11000);
  expect(await page.locator('.carrusel__pista').evaluate((e) => e.scrollLeft)).toBe(0);
  for (const op of await page.locator('[data-revela]').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity))) expect(op).toBe('1');
  await ctx.close();
});

test('sin JS todo el contenido se ve (aparecer al bajar no esconde nada por su cuenta)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  for (const op of await page.locator('[data-revela]').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity))) expect(op).toBe('1');
  /* La fila de categorías se puede deslizar igual */
  expect(await page.locator('.carrusel__pista').evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
  await ctx.close();
});

test('al bajar, cada bloque aparece y queda visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/revela-listo/);
  const bloques = page.locator('[data-revela]');
  const n = await bloques.count();
  for (let i = 0; i < n; i++) {
    await bloques.nth(i).scrollIntoViewIfNeeded();
    await expect(bloques.nth(i)).toHaveClass(/visto/);
  }
  await expect.poll(() => page.locator('[data-revela]:not(.visto)').count()).toBe(0);
});

test('simetría: el mosaico de negocios y las tarjetas de categoría no dejan filas cojas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });   /* se mide quieto, sin la animación de aparecer */
  await page.goto('/');
  await page.locator('.mosaico').scrollIntoViewIfNeeded();
  const cajas = await page.locator('.mosaico > li').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ izq: Math.round(r.left), arriba: Math.round(r.top), abajo: Math.round(r.bottom) })));
  expect(cajas).toHaveLength(6);
  /* Todas las columnas empiezan y terminan a la misma altura */
  const columnas = new Map();
  for (const c of cajas) columnas.set(c.izq, [...(columnas.get(c.izq) || []), c]);
  const arriba = new Set([...columnas.values()].map((cs) => Math.min(...cs.map((c) => c.arriba))));
  const abajo = new Set([...columnas.values()].map((cs) => Math.max(...cs.map((c) => c.abajo))));
  expect(arriba.size).toBe(1);
  expect(abajo.size).toBe(1);
  /* Las tarjetas de categoría que se ven miden lo mismo de alto */
  const altos = await page.locator('.cat').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(altos).size).toBe(1);
});

test('tarjetas de categoría: «Ver productos» cabe en un renglón, también en celular, y cada foto carga', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.carrusel').scrollIntoViewIfNeeded();
  const botones = await page.locator('.cat__boton').evaluateAll((els) => els.map((e) => ({
    alto: Math.round(e.getBoundingClientRect().height), minimo: parseFloat(getComputedStyle(e).minHeight),
  })));
  expect(botones.length).toBeGreaterThan(0);
  /* Partido en dos renglones mide más que su alto mínimo */
  for (const b of botones) expect(b.alto).toBeLessThanOrEqual(b.minimo + 4);
  /* Las escenas con productos de verdad (Higgsfield, 10-nov-2026) están puestas y existen */
  for (const nombre of ['cat-portacomidas', 'cat-bolsas-papel', 'cat-aluminio', 'sec-reposteria', 'sec-salsas', 'sec-heladeria']) {
    const img = page.locator(`img[src*="img/escenas/${nombre}-"]`);
    await expect(img).toHaveCount(1);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((/** @type {HTMLImageElement} */ e) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
});

/* ---------- Ronda de color y detalles (10-nov-2026) ---------- */

test('contacto explica cómo se pide en tres pasos numerados, sin sumar botones', async ({ page }) => {
  await page.goto('/');
  const pasos = page.locator('#contacto .pasos li');
  await expect(pasos).toHaveCount(3);
  await expect(pasos.nth(0)).toContainText('Busque en el catálogo');
  await expect(pasos.nth(1)).toContainText('Escríbanos por WhatsApp');
  await expect(pasos.nth(2)).toContainText('Reciba su pedido');
  /* El número lo pone el CSS, en un círculo amarillo con letra azul noche */
  const numeros = await pasos.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e, '::before'); return { n: s.content, fondo: s.backgroundColor, letra: s.color }; }));
  expect(numeros.map((n) => n.fondo)).toEqual(Array(3).fill('rgb(255, 201, 51)'));
  expect(numeros.map((n) => n.letra)).toEqual(Array(3).fill('rgb(14, 26, 71)'));
  /* Los pasos no traen enlaces ni botones: el único WhatsApp de la sección sigue siendo el de abajo */
  await expect(page.locator('#contacto .pasos a')).toHaveCount(0);
});

test('la cinta de la marca abre la cabecera igual que abre el pie, y cada tarjeta de confianza lleva el filo de su ícono', async ({ page }) => {
  await page.goto('/');
  const cinta = (/** @type {string} */ sel) => page.locator(sel).evaluate((e) => { const s = getComputedStyle(e, '::before'); return { alto: s.height, fondo: s.backgroundImage }; });
  const arriba = await cinta('.cabecera'), abajo = await cinta('.pie');
  expect(arriba.alto).toBe('4px');
  expect(arriba.fondo).toContain('repeating-linear-gradient');
  expect(arriba.fondo).toBe(abajo.fondo);
  /* La cinta no tapa el logo ni empuja la página a los lados */
  const logo = await page.locator('.cabecera .logo').boundingBox(), cab = await page.locator('.cabecera').boundingBox();
  expect(logo && cab && logo.y >= cab.y + 4).toBe(true);
  /* Filos: amarillo, verde, azul y rojo oscuro (el rojo de la cinta no sale de la cinta) */
  const filos = await page.locator('.confianza > li').evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor));
  expect(filos).toEqual(['rgb(255, 201, 51)', 'rgb(15, 122, 67)', 'rgb(30, 73, 184)', 'rgb(196, 43, 28)']);
});

test('la bajada de los productos no promete lo que la ficha no trae', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#destacados .titulo-bajada')).toHaveText('Toque uno para ver sus fotos, su medida y en qué viene.');
});
