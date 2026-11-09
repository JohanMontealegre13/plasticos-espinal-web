/* Barra fija de abajo (solo en el celular): Inicio, Categorías, Favoritos y Pedidos y, aparte y en
   amarillo, la Canasta, como la de las apps de compras. En el celular es la única canasta (la de arriba se
   esconde); en el computador la barra no sale y queda la de arriba. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

const CELULAR = { width: 390, height: 844 };
const AGREGAR_J1 = 'Agregar Contenedor icopor J1 x25 und a la canasta';

test('en el celular la barra de abajo trae los cinco accesos, pegada al borde y sin tapar el pie', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const barra = page.locator('#abajo');
  await expect(barra).toBeVisible();
  for (const nombre of ['Inicio', 'Categorías', 'Favoritos', 'Pedidos']) {
    await expect(barra.getByText(nombre, { exact: true })).toBeVisible();
  }
  await expect(barra.locator('#barra')).toHaveAccessibleName('Canasta vacía');
  const m = await page.evaluate(() => {
    const b = document.querySelector('#abajo').getBoundingClientRect();
    const tocables = [...document.querySelectorAll('#abajo .abajo-btn, #abajo .abajo-canasta')].filter((x) => !(/** @type {HTMLElement} */ (x).hidden)).map((x) => x.getBoundingClientRect());
    return { abajo: Math.round(window.innerHeight - b.bottom), ancho: Math.round(b.width), chicos: tocables.filter((r) => r.width < 44 || r.height < 44).length };
  });
  expect(m.abajo).toBe(0);
  expect(m.ancho).toBe(CELULAR.width);
  expect(m.chicos, 'todo lo de la barra mide 44 px o más').toBe(0);
  /* al final de la página el pie se lee entero: la barra no tapa sus enlaces */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const tapa = await page.evaluate(() => {
    const ultimo = [...document.querySelectorAll('.pie a')].pop().getBoundingClientRect();
    return ultimo.bottom > document.querySelector('#abajo').getBoundingClientRect().top;
  });
  expect(tapa).toBe(false);
  v.sinProblemas();
});

test('en el computador la barra de abajo no sale', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTienda(page);
  await expect(page.locator('#abajo')).toBeHidden();
});

test('la canasta de la barra cuenta los productos, dice el total y abre la canasta', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  const canasta = page.locator('#barra');
  await expect(page.locator('#barraN')).toBeHidden();
  await expect(page.locator('#barraT')).toHaveText('Canasta');
  await page.getByRole('button', { name: AGREGAR_J1 }).click();
  await page.getByRole('button', { name: 'Agregar uno más de Contenedor icopor J1 x25 und' }).click();
  await expect(page.locator('#barraN')).toHaveText('2');
  await expect(page.locator('#barraT')).toHaveText('$23.600');   /* 2 × $9.800 + $4.000 de domicilio */
  await expect(canasta).toHaveAccessibleName('Canasta: 2 productos, $23.600');
  await canasta.click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#panelTitulo')).toHaveText('Su canasta');
});

test('Inicio borra la búsqueda y vuelve arriba', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#q').fill('vaso');
  await expect(page.locator('#tituloVitrina')).toHaveText('Resultados para «vaso»');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.locator('#abInicio').click();
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#tituloVitrina')).toHaveText('Lo más pedido');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('Categorías lleva a las fotos de las categorías, a la vista bajo la cabecera', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('#abCategorias').click();
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('#cats').getBoundingClientRect();
    return c.top >= document.querySelector('.cab').getBoundingClientRect().bottom - 1 && c.bottom <= window.innerHeight;
  })).toBe(true);
});

test('Favoritos sin ninguno guardado dice cómo se guardan; con uno, lleva a la fila', async ({ page }) => {
  const v = vigilar(page);
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#abFavoritos').click();
  await expect(page.locator('#avisoFicha')).toHaveText('Todavía no tiene favoritos: toque el corazón de un producto y aquí lo encuentra.');
  await page.locator('#grilla [data-fav="210"]').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('#abFavoritos').click();
  await expect(page.locator('#favoritos')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const f = document.querySelector('#favoritos').getBoundingClientRect();
    return f.top >= 0 && f.top < window.innerHeight / 2;
  })).toBe(true);
  v.sinProblemas();
});

test('Favoritos estando en una búsqueda deja la búsqueda para mostrar la fila', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await page.locator('#grilla [data-fav="210"]').click();
  await page.locator('#q').fill('detergente');
  await expect(page.locator('#favoritos')).toBeHidden();   /* buscando, la fila se esconde */
  await page.locator('#abFavoritos').click();
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#favoritos')).toBeVisible();
});

test('Pedidos abre «Mis pedidos» del portal', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.locator('#abajo').getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/tienda/mi-cuenta/pedidos/');
});

test('en el celular la canasta es una sola: la de abajo, amarilla y aparte de los accesos', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await abrirTienda(page);
  await expect(page.locator('.cab .btn-canasta')).toBeHidden();
  const m = await page.evaluate(() => {
    const canasta = document.querySelector('#barra'), grupo = document.querySelector('.abajo-grupo');
    const pedidos = [...grupo.querySelectorAll('.abajo-btn')].pop().getBoundingClientRect(), c = canasta.getBoundingClientRect();
    return { fuera: !grupo.contains(canasta), fondo: getComputedStyle(canasta).backgroundColor, separada: c.left - pedidos.right, derecha: Math.round(window.innerWidth - c.right) };
  });
  expect(m.fuera, 'la canasta no va con los accesos').toBe(true);
  expect(m.fondo).toBe('rgb(255, 201, 51)');                 /* el amarillo de la marca */
  expect(m.separada).toBeGreaterThanOrEqual(4);
  expect(m.derecha).toBeLessThanOrEqual(12);                  /* pegada a la derecha, a la mano del pulgar */
  /* la cuenta de arriba sigue: queda a la derecha del logo */
  await expect(page.locator('.cab .btn-cuenta')).toBeVisible();
});

test('en el computador sigue la canasta de arriba', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTienda(page);
  await expect(page.locator('.cab .btn-canasta')).toBeVisible();
  await page.locator('.cab .btn-canasta').click();
  await expect(page.locator('#panel')).toBeVisible();
});
