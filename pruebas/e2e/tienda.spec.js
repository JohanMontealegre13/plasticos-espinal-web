/* La tienda tal como está hoy: catálogo del CRM, agotados y domicilio.
   Las pruebas de cada función nueva viven en su propio archivo. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirTienda, vigilar, llenarDatos } from './ayudas.js';

test('pinta los productos del CRM y el agotado no se puede agregar', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  await expect(page.locator('#grilla li')).toHaveCount(8);
  await expect(page.locator('#grilla li', { hasText: 'Plato 23 cm' }).getByRole('button', { name: 'Agotado' })).toBeDisabled();
  v.sinProblemas();
});

test('bajo $50.000 cobra $4.000 de domicilio', async ({ page }) => {
  await abrirTienda(page);
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#dom')).toHaveText('$4.000');
  await expect(page.locator('#tot')).toHaveText('$13.800');
});

test('desde $50.000 en productos el domicilio es gratis', async ({ page }) => {
  await abrirTienda(page);
  await page.locator('#verTodo').click();
  for (const n of ['Bolsa kraft #6 x100 und', 'Detergente en polvo 1 kg', 'Contenedor icopor J1 x25 und', 'Servilleta 25x25 x300 und', 'Tenedor plástico x100 und']) {
    await page.getByRole('button', { name: `Agregar ${n} a la canasta` }).click();
  }   /* 18.900 + 12.500 + 9.800 + 9.200 + 6.200 = 56.600 */
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#dom')).toHaveText('Gratis');
});

test('la franja dice desde cuánto es gratis con el valor del CRM', async ({ page }) => {
  const v = vigilar(page);
  const catalogo = JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
  catalogo.domicilio.gratis_desde = 70000;
  await abrirTienda(page, { catalogo });
  await expect(page.locator('#gratisDesde')).toHaveText('$70.000');
  v.sinProblemas();
});

test('la franja y el inicio no nombran Chicoral', async ({ page }) => {
  await abrirTienda(page);
  await expect(page.locator('body')).not.toContainText(/Chicoral/i);
  await page.goto('/');
  await expect(page.locator('body')).not.toContainText(/Chicoral/i);
  expect(await page.content()).not.toMatch(/Chicoral/i);
});

/* ---------- La canasta (vienen del PR #4, puestas al día con el catálogo del CRM) ---------- */

const catalogoCrm = () => JSON.parse(readFileSync(new URL('./catalogo-crm.json', import.meta.url), 'utf8'));
/**
 * El catálogo de prueba del CRM con otros precios, para pisar los bordes del domicilio.
 * @param {Record<number, number>} precios id -> precio
 */
function conPrecios(precios) {
  const c = catalogoCrm();
  for (const p of c.productos) if (p.id in precios) p.precio = precios[p.id];
  return c;
}
/** @param {import('@playwright/test').Page} page @param {string} nombre */
const agregar = (page, nombre) => page.locator('#grilla').getByRole('button', { name: new RegExp(`^Agregar (uno más de )?${nombre.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&')}`) }).click();

test.describe('canasta', () => {
  test.beforeEach(async ({ page }) => { await page.route(/wa\.me|api\.whatsapp\.com/, (r) => r.abort()); });

  test('canasta vacía: domicilio $0 y no deja seguir', async ({ page }) => {
    const v = vigilar(page);
    await abrirTienda(page);
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#vacio')).toBeVisible();
    await expect(page.locator('#dom')).toHaveText('$0');
    await expect(page.locator('#tot')).toHaveText('$0');
    await expect(page.locator('#seguir')).toBeDisabled();
    v.sinProblemas();
  });

  test('con $1 menos del umbral se cobra el domicilio y dice cuánto falta', async ({ page }) => {
    await abrirTienda(page, { catalogo: conPrecios({ 141: 30000, 131: 19999 }) });
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Tenedor plástico x100 und');           /* 49.999 */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#dom')).toHaveText('$4.000');
    await expect(page.locator('#tot')).toHaveText('$53.999');
    await expect(page.locator('#falta')).toHaveText('· gratis si agrega $1');
  });

  test('con el umbral exacto en productos el domicilio es gratis', async ({ page }) => {
    await abrirTienda(page, { catalogo: conPrecios({ 141: 30000, 131: 20000 }) });
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Tenedor plástico x100 und');           /* 50.000 */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#dom')).toHaveText('Gratis');
    await expect(page.locator('#tot')).toHaveText('$50.000');
    await expect(page.locator('#falta')).toHaveText('');
  });

  test('Regresión (68a745b): el umbral cuenta solo los productos, no el domicilio', async ({ page }) => {
    await abrirTienda(page, { catalogo: conPrecios({ 305: 47000 }) });
    await page.locator('#verTodo').click();
    await agregar(page, 'Bolsa kraft #6 x100 und');             /* 47.000 + 4.000 = 51.000, igual paga domicilio */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#dom')).toHaveText('$4.000');
    await expect(page.locator('#tot')).toHaveText('$51.000');
  });

  test('quitar con − hasta cero saca el producto y recalcula', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#tot')).toHaveText('$23.600');      /* 2 × 9.800 + 4.000 */
    const panel = page.locator('#panel');
    await panel.getByRole('button', { name: 'Quitar uno de Contenedor icopor J1 x25 und' }).click();
    await expect(page.locator('#tot')).toHaveText('$13.800');
    await panel.getByRole('button', { name: 'Quitar uno de Contenedor icopor J1 x25 und' }).click();
    await expect(page.locator('#vacio')).toBeVisible();
    await expect(page.locator('#n')).toBeHidden();
  });

  test('la canasta sobrevive a recargar la página', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Tenedor plástico x100 und');
    await page.reload();
    await expect(page.locator('#n')).toHaveText('2');
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#items li')).toHaveCount(2);
  });

  test('si un producto sale del catálogo o se agota, sale de la canasta guardada', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('sembrada')) {
        localStorage.setItem('pe-canasta-v1', JSON.stringify({ 141: 2, 131: 1, 999999: 3 }));
        sessionStorage.setItem('sembrada', '1');
      }
    });
    const catalogo = catalogoCrm();
    catalogo.productos.find((/** @type {any} */ p) => p.id === 131).disponible = false;
    await abrirTienda(page, { catalogo });
    await expect(page.locator('#n')).toHaveText('2');            /* solo los 2 contenedores */
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('pe-canasta-v1') || '{}'))).toEqual({ 141: 2 });
  });

  test('si el navegador bloquea el almacenamiento, la canasta igual funciona', async ({ page }) => {
    const v = vigilar(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
    });
    await abrirTienda(page);
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await expect(page.locator('#n')).toHaveText('1');
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#tot')).toHaveText('$13.800');
    v.sinProblemas();
  });

  test('un nombre con HTML se muestra como texto (nunca se ejecuta)', async ({ page }) => {
    const catalogo = catalogoCrm();
    catalogo.productos.push({ id: 777, nombre: '<img src=x onerror="window.__xss=1">Bolsa rara', categoria: 'c3', precio: 1000, disponible: true, destacado: true, foto: '', fotos: [] });
    await abrirTienda(page, { catalogo });
    await expect(page.locator('#grilla')).toContainText('<img src=x onerror="window.__xss=1">Bolsa rara');
    await agregar(page, '<img src=x onerror="window.__xss=1">Bolsa rara');
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#items')).toContainText('Bolsa rara');
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  });

  test('cada botón de categoría muestra solo productos de esa categoría', async ({ page }) => {
    const v = vigilar(page);
    const catalogo = catalogoCrm();
    await abrirTienda(page, { catalogo });
    for (const c of catalogo.categorias) {
      const esperados = catalogo.productos.filter((/** @type {any} */ p) => p.categoria === c.id).map((/** @type {any} */ p) => p.nombre).sort();
      await page.locator(`#cats [data-cat="${c.id}"]`).click();
      await expect(page.locator(`#cats [data-cat="${c.id}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#grilla li')).toHaveCount(esperados.length);
      const vistos = (await page.locator('#grilla li .nombre').allTextContents()).map((t) => t.trim()).sort();
      expect(vistos).toEqual(esperados);
    }
    v.sinProblemas();
  });

  test('el combo agrega sus tres productos y abre la canasta', async ({ page }) => {
    const v = vigilar(page);
    await abrirTienda(page);
    await page.getByRole('button', { name: 'Agregar el combo' }).click();
    await expect(page.locator('#n')).toHaveText('3');
    await expect(page.locator('#panel')).toBeVisible();
    for (const n of ['Contenedor icopor J1 x25 und', 'Tenedor plástico x100 und', 'Servilleta 25x25 x300 und']) {
      await expect(page.locator('#items')).toContainText(n);
    }
    v.sinProblemas();
  });

  test('el pedido le manda al CRM cada producto con su cantidad y los datos de entrega; el precio lo pone el CRM', async ({ page }) => {
    /** @type {any[]} */
    const enviados = [];
    await page.route('**/tienda/mi-cuenta/api/tienda/pedido', async (r) => {
      enviados.push(r.request().postDataJSON());
      await r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 'secreto-de-prueba-123', total: 29800 } });
    });
    await abrirTienda(page);
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Contenedor icopor J1 x25 und');
    await agregar(page, 'Tenedor plástico x100 und');
    await page.locator('.btn-canasta').click();
    await page.locator('#seguir').click();
    await llenarDatos(page);
    await page.locator('#enviar').click();
    await expect(page.locator('#pago')).toBeVisible();
    expect(enviados).toHaveLength(1);
    const { lineas, ...datos } = enviados[0];
    expect([...lineas].sort((/** @type {any} */ a, /** @type {any} */ b) => a.id - b.id)).toEqual([{ id: 131, cantidad: 1 }, { id: 141, cantidad: 2 }]);
    expect(datos).toMatchObject({ nombre: 'Ana Prueba', documento: '1105678901', celular: '300 123 4567', barrio: 'Belén', direccion: 'Calle 1 # 2-3' });
    expect(JSON.stringify(enviados[0])).not.toMatch(/precio|total/i);
    await expect(page.locator('#n')).toBeHidden();                /* la canasta queda vacía para el próximo pedido */
  });
});
