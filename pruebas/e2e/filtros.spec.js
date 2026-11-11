/* Filtros en cascada del catálogo (pedido del dueño, 11-nov-2026): categoría, tipo, marca, medida y color.
   Cada uno ofrece solo lo que queda con los de antes, con cuántos hay; cambiar uno suelta los que siguen. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, CATALOGO_CRM } from './ayudas.js';

/** El catálogo de prueba con tipo y detalles: en «Vasos y platos» hay dos vasos (Wau y Darnel) y un plato */
function conDetalles() {
  const c = structuredClone(CATALOGO_CRM);
  /** @type {Record<number, [string, string, string, string]>} */
  const datos = {
    210: ['Vaso', 'Wau', '7 oz', 'blanco'],
    228: ['Vaso', 'Darnel', '9 oz', 'transparente'],
    398: ['Plato', 'Darnel', '23 cm', 'blanco'],
  };
  for (const p of c.productos) {
    const d = datos[p.id];
    if (!d) continue;
    p.tipo = d[0];
    p.detalles = [{ nombre: 'Marca', valor: d[1] }, { nombre: 'Medida', valor: d[2] }, { nombre: 'Color', valor: d[3] }];
  }
  return c;
}

const nombres = async (/** @type {import('@playwright/test').Page} */ page) => (await page.locator('#grilla li h3').allTextContents()).map((t) => t.trim()).sort();

test('cada filtro sale solo cuando hay de dónde escoger y va afinando lo que se ve', async ({ page }) => {
  const v = vigilar(page);
  const catalogo = conDetalles();
  const ids = catalogo.productos.filter((/** @type {any} */ p) => [210, 228, 398].includes(p.id)).map((/** @type {any} */ p) => p.nombre);
  expect(ids).toHaveLength(3);
  await abrirTienda(page, { catalogo });
  /* sin categoría: Tipo, Marca, Medida y Color ya ofrecen lo de todo el catálogo */
  await expect(page.locator('#cats .nivel .nivel-tit')).toHaveText(['Categoría', 'Tipo', 'Marca', 'Medida', 'Color']);
  await page.locator('#f-cat').selectOption('c2');
  await expect(page.locator('#f-tipo option')).toHaveText(['Todos', 'Plato (1)', 'Vaso (2)']);
  await page.locator('#f-tipo').selectOption({ label: 'Vaso (2)' });
  await expect(page.locator('#grilla li')).toHaveCount(2);
  await expect(page.locator('#f-tipo')).toBeFocused();
  await expect(page.locator('#f-marca option')).toHaveText(['Todas', 'Darnel (1)', 'Wau (1)']);
  await page.locator('#f-marca').selectOption({ label: 'Wau (1)' });
  await expect(page.locator('#grilla li')).toHaveCount(1);
  /* con un solo producto, medida y color ya no tienen de dónde escoger: no salen */
  await expect(page.locator('#f-medida')).toHaveCount(0);
  await expect(page.locator('#f-color')).toHaveCount(0);
  await expect(page.locator('#limpiarTexto')).toHaveText('Vasos y platos · Vaso · Wau');
  await expect(page.locator('#conteo')).toHaveText('1 producto');
  v.sinProblemas();
});

test('cambiar un filtro de arriba suelta los de abajo', async ({ page }) => {
  await abrirTienda(page, { catalogo: conDetalles() });
  await page.locator('#f-cat').selectOption('c2');
  await page.locator('#f-tipo').selectOption({ label: 'Vaso (2)' });
  await page.locator('#f-marca').selectOption({ label: 'Darnel (1)' });
  await page.locator('#f-cat').selectOption('c1');
  await expect(page.locator('#f-tipo')).toHaveCount(0);
  await expect(page.locator('#f-marca')).toHaveCount(0);
  await expect(page.locator('#grilla li')).toHaveCount(3);
});

test('el ✕ del filtro puesto quita todos los filtros', async ({ page }) => {
  await abrirTienda(page, { catalogo: conDetalles() });
  await page.locator('#f-cat').selectOption('c2');
  await page.locator('#f-tipo').selectOption({ label: 'Vaso (2)' });
  await page.locator('#limpiar').click();
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#f-cat')).toHaveValue('');
  await expect(page.locator('#f-tipo')).toHaveValue('');
  await expect(page.locator('#tituloVitrina')).toHaveText('Todos los productos');
});

test('el color sin tilde ni mayúscula es el mismo filtro; las medidas van por su número', async ({ page }) => {
  const c = conDetalles();
  const vaso = c.productos.find((/** @type {any} */ p) => p.id === 228);
  vaso.detalles[2].valor = 'Blanco';
  vaso.detalles[1].valor = '16 oz';
  await abrirTienda(page, { catalogo: c });
  await page.locator('#f-cat').selectOption('c2');
  /* «blanco» y «Blanco» son uno solo: con un solo color no hay de dónde escoger y el filtro no sale */
  await expect(page.locator('#f-color')).toHaveCount(0);
  await expect(page.locator('#f-medida option')).toHaveText(['Todas', '7 oz (1)', '16 oz (1)', '23 cm (1)']);
  expect(await nombres(page)).toHaveLength(3);
});

test('en el celular los filtros van de a dos por fila y caben sin correr de lado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirTienda(page, { catalogo: conDetalles() });
  const cajas = await page.locator('#cats .nivel').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(cajas.length).toBe(5);
  for (const c of cajas) expect(c.right).toBeLessThanOrEqual(390);
  expect(Math.round(cajas[0].top)).toBe(Math.round(cajas[1].top));
  expect(cajas[2].top).toBeGreaterThan(cajas[0].top);
});

test('sin detalles ni tipo (un CRM de antes) solo sale el filtro de categoría', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('#cats .nivel .nivel-tit')).toHaveText(['Categoría']);
});

test('toda la pastilla del filtro abre la lista: también la flecha y el título', async ({ page }) => {
  await abrirTienda(page, { catalogo: conDetalles() });
  const pastilla = page.locator('#cats .nivel').first();
  await pastilla.scrollIntoViewIfNeeded();
  const caja = await pastilla.boundingBox();
  if (!caja) throw new Error('sin pastilla');
  /* lo que hay debajo del dedo en la flecha (derecha), en el título (arriba) y en el borde izquierdo es la lista */
  const puntos = [[caja.x + caja.width - 18, caja.y + caja.height / 2], [caja.x + 20, caja.y + 10], [caja.x + 6, caja.y + caja.height - 8]];
  for (const [x, y] of puntos) {
    const id = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e && e.id; }, [x, y]);
    expect(id, `en ${x},${y}`).toBe('f-cat');
  }
});
