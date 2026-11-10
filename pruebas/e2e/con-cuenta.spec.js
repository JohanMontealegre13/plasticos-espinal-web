/* La tienda para quien entró con su cuenta (nadie la ve sin ella): el precio por cantidad que
   anuncia el CRM es el que suma la canasta, los datos de entrega salen de la cuenta y no se pide
   la cédula, y qué pasa si la sesión se vence con la canasta armada o si el CRM no responde. */
import { test, expect } from '@playwright/test';
import { abrirTienda, abrirCanasta, llenarDatos, sitioDe, vigilar, CATALOGO_CRM, CUENTA } from './ayudas.js';

const CONTENEDOR = 'Contenedor icopor J1 x25 und';   /* id 141, $9.800 la unidad */
const TENEDOR = 'Tenedor plástico x100 und';         /* id 131, $6.200, sin precio por cantidad */

/** El catálogo con la escalera del contenedor como la manda el CRM: el primer corte siempre es desde 1. */
function conEscalones() {
  const c = structuredClone(CATALOGO_CRM);
  for (const p of c.productos) p.escalones = [{ desde: 1, precio: p.precio }];
  c.productos.find((/** @type {any} */ p) => p.id === 141).escalones = [{ desde: 1, precio: 9800 }, { desde: 3, precio: 9000 }, { desde: 12, precio: 8400 }];
  return c;
}
const linea = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ nombre) => page.locator('#items li', { hasText: nombre });

/** @param {import('@playwright/test').Page} page */
async function hastaLosDatos(page) {
  await page.getByRole('button', { name: `Agregar ${CONTENEDOR} a la canasta` }).click();
  await abrirCanasta(page);
  await page.locator('#seguir').click();
  await expect(page.locator('#datos')).toBeVisible();
}

/* ---------------- precio por cantidad ---------------- */

test('la canasta cobra el precio por cantidad: al llegar al corte baja cada unidad y lo dice', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { catalogo: conEscalones() });
  await page.getByRole('button', { name: `Agregar ${CONTENEDOR} a la canasta` }).click();
  await page.getByRole('button', { name: `Agregar ${TENEDOR} a la canasta` }).click();
  await abrirCanasta(page);
  const cantidad = page.locator('#items').getByLabel(`Cantidad de ${CONTENEDOR}`);
  /* Dos: todavía al precio de una unidad, sin aviso */
  await cantidad.fill('2');
  await cantidad.blur();
  await expect(linea(page, CONTENEDOR).locator('.v')).toHaveText('$19.600');
  await expect(linea(page, CONTENEDOR).locator('.cada-uno')).toHaveCount(0);
  await expect(page.locator('#tot')).toHaveText('$29.800');                /* 19.600 + 6.200 + 4.000 de domicilio */
  /* Tres: cada uno a $9.000 */
  await cantidad.fill('3');
  await cantidad.blur();
  await expect(linea(page, CONTENEDOR).locator('.v')).toHaveText('$27.000');
  await expect(linea(page, CONTENEDOR).locator('.cada-uno')).toHaveText('$9.000 cada uno por llevar 3');
  await expect(page.locator('#tot')).toHaveText('$37.200');                /* 27.000 + 6.200 + 4.000 */
  /* Doce: el corte siguiente, y con eso el domicilio ya es gratis */
  await cantidad.fill('12');
  await cantidad.blur();
  await expect(linea(page, CONTENEDOR).locator('.v')).toHaveText('$100.800');
  await expect(linea(page, CONTENEDOR).locator('.cada-uno')).toHaveText('$8.400 cada uno por llevar 12');
  await expect(page.locator('#dom')).toHaveText('Gratis');
  await expect(page.locator('#tot')).toHaveText('$107.000');
  /* Y al bajar, vuelve al precio de antes: llevar menos no conserva la rebaja */
  await cantidad.fill('1');
  await cantidad.blur();
  await expect(linea(page, CONTENEDOR).locator('.v')).toHaveText('$9.800');
  await expect(linea(page, CONTENEDOR).locator('.cada-uno')).toHaveCount(0);
  /* El que no tiene precio por cantidad nunca cambia */
  await expect(linea(page, TENEDOR).locator('.v')).toHaveText('$6.200');
  await expect(linea(page, TENEDOR).locator('.cada-uno')).toHaveCount(0);
  v.sinProblemas();
});

test('el umbral del domicilio gratis se mide con lo que de verdad se cobra, no con el precio de una unidad', async ({ page }) => {
  const c = conEscalones();
  c.productos.find((/** @type {any} */ p) => p.id === 141).escalones = [{ desde: 1, precio: 9800 }, { desde: 6, precio: 8000 }];
  await abrirTienda(page, { catalogo: c });
  await page.getByRole('button', { name: `Agregar ${CONTENEDOR} a la canasta` }).click();
  await abrirCanasta(page);
  const cantidad = page.locator('#items').getByLabel(`Cantidad de ${CONTENEDOR}`);
  await cantidad.fill('6');                                                /* 6 × 8.000 = 48.000: no llega a 50.000 (6 × 9.800 sí) */
  await cantidad.blur();
  await expect(page.locator('#dom')).toHaveText('$4.000');
  await expect(page.locator('#falta')).toHaveText('· gratis si agrega $2.000');
  await expect(page.locator('#tot')).toHaveText('$52.000');
});

test('la ficha dice desde cuántos baja el precio; la del que no tiene precio por cantidad no muestra nada', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { catalogo: conEscalones(), ruta: '/tienda/#p=141' });
  const caja = page.locator('#escalonesCaja');
  await expect(caja).toBeVisible();
  await expect(caja.getByRole('heading')).toHaveText('Precio por cantidad');
  await expect(caja.locator('li')).toHaveText(['Desde 3$9.000', 'Desde 12$8.400']);
  await page.goto('/tienda/#p=131');
  await page.reload();
  await expect(page.locator('#ficha')).toContainText(TENEDOR);
  await expect(caja).toBeHidden();
  v.sinProblemas();
});

test('un precio por cantidad dañado o más caro no se anuncia ni se cobra de más por error del catálogo', async ({ page }) => {
  const c = conEscalones();
  c.productos.find((/** @type {any} */ p) => p.id === 141).escalones = [{ desde: 1, precio: 9800 }, { desde: 2, precio: '9000' }, { desde: 3, precio: 0 }, null, { desde: 4, precio: -5 }];
  c.productos.find((/** @type {any} */ p) => p.id === 131).escalones = 'ninguno';
  await abrirTienda(page, { catalogo: c, ruta: '/tienda/#p=141' });
  await expect(page.locator('#ficha')).toContainText(CONTENEDOR);
  await expect(page.locator('#escalonesCaja')).toBeHidden();
  await page.locator('#fichaCerrar').click();
  await page.getByRole('button', { name: `Agregar ${CONTENEDOR} a la canasta` }).click();
  await page.getByRole('button', { name: `Agregar ${TENEDOR} a la canasta` }).click();
  await abrirCanasta(page);
  const cantidad = page.locator('#items').getByLabel(`Cantidad de ${CONTENEDOR}`);
  await cantidad.fill('5');
  await cantidad.blur();
  await expect(linea(page, CONTENEDOR).locator('.v')).toHaveText('$49.000');   /* 5 × 9.800 */
  await expect(linea(page, TENEDOR).locator('.v')).toHaveText('$6.200');
});

/* ---------------- los datos de entrega salen de la cuenta ---------------- */

test('el pedido no pide la cédula y propone el nombre y el celular de la cuenta', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await expect(page.locator('#d-doc, #d-tipo')).toHaveCount(0);
  await expect(page.locator('#datos')).not.toContainText(/c[eé]dula|documento/i);
  await expect(page.locator('#d-nombre')).toHaveValue('Ana Prueba');
  await expect(page.locator('#d-cel')).toHaveValue('3001234567');
  await expect(page.locator('#d-barrio')).toHaveValue('');
  await expect(page.locator('#d-barrio')).toBeFocused();                   /* lo primero que falta */
  v.sinProblemas();
});

test('con la dirección ya guardada en «Mis datos» el pedido sale lleno y se pide en un toque', async ({ page }) => {
  /** @type {any[]} */
  const enviados = [];
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', async (r) => {
    enviados.push(r.request().postDataJSON());
    await r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 'secreto-de-prueba-123', total: 13800 } });
  });
  await abrirTienda(page, { cuenta: { ...CUENTA, barrio: 'El Centro', direccion: 'Calle 7 # 5-25 local 2', indicaciones: 'Timbre dañado, llamar' } });
  await hastaLosDatos(page);
  await expect(page.locator('#d-barrio')).toHaveValue('El Centro');
  await expect(page.locator('#d-dir')).toHaveValue('Calle 7 # 5-25 local 2');
  await expect(page.locator('#d-extra')).toHaveValue('Timbre dañado, llamar');
  await expect(page.locator('#enviar')).toBeFocused();
  await page.locator('#d-acepto').check();
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados).toEqual([{
    nombre: 'Ana Prueba', celular: '300 123 4567', barrio: 'El Centro', direccion: 'Calle 7 # 5-25 local 2',
    indicaciones: 'Timbre dañado, llamar', lineas: [{ id: 141, cantidad: 1 }],
  }]);
});

test('lo que esta cuenta escribió la última vez en este celular manda sobre lo guardado en la cuenta', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', (r) => r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } }));
  await abrirTienda(page, { cuenta: { ...CUENTA, barrio: 'El Centro', direccion: 'Calle 7 # 5-25' } });
  await hastaLosDatos(page);
  await llenarDatos(page);                                                  /* Belén, Calle 1 # 2-3 */
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('pe-cliente-v1') || '{}'));
  expect(guardado).toMatchObject({ cuenta: '1105678901', barrio: 'Belén', direccion: 'Calle 1 # 2-3' });
  expect(JSON.stringify(guardado), 'la cédula solo va como marca de a quién son esos datos').not.toContain('tipo');
  /* Otro pedido, en otra visita */
  await page.evaluate(() => localStorage.removeItem('pe-pedido-v1'));
  await page.reload();
  await hastaLosDatos(page);
  await expect(page.locator('#d-barrio')).toHaveValue('Belén');
  await expect(page.locator('#d-dir')).toHaveValue('Calle 1 # 2-3');
});

test('en un celular compartido, los datos de entrega que dejó otra cuenta no se le muestran a esta', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pe-cliente-v1', JSON.stringify({ cuenta: '52000111', nombre: 'Otra Persona', celular: '310 999 8877', barrio: 'Balkanes', direccion: 'Carrera 4 # 9-99', extra: 'Preguntar por Otra', acepto: true }));
  });
  await abrirTienda(page);
  await hastaLosDatos(page);
  await expect(page.locator('#d-nombre')).toHaveValue('Ana Prueba');
  await expect(page.locator('#d-cel')).toHaveValue('3001234567');
  await expect(page.locator('#d-barrio')).toHaveValue('');
  await expect(page.locator('#d-dir')).toHaveValue('');
  await expect(page.locator('#d-extra')).toHaveValue('');
  await expect(page.locator('#d-acepto')).not.toBeChecked();
  await expect(page.locator('#datos')).not.toContainText('Otra');
});

test('los datos guardados antes de que existieran las cuentas (sin marca de quién son) tampoco se muestran', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pe-cliente-v1', JSON.stringify({ nombre: 'Alguien de Antes', tipo: 'CC', documento: '999', celular: '310 999 8877', barrio: 'Balkanes', direccion: 'Carrera 4 # 9-99', acepto: true }));
  });
  await abrirTienda(page);
  await hastaLosDatos(page);
  await expect(page.locator('#d-nombre')).toHaveValue('Ana Prueba');
  await expect(page.locator('#d-dir')).toHaveValue('');
});

test('si «yo» no responde, la tienda abre igual y los datos de entrega se escriben a mano', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', (r) => r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } }));
  await abrirTienda(page);
  await page.unroute('**/tienda/mi-cuenta/api/yo');
  await page.route('**/tienda/mi-cuenta/api/yo', (r) => r.fulfill({ status: 502, json: { ok: false } }));
  await page.reload();
  await expect(page.locator('#grilla li').first()).toBeVisible();
  await hastaLosDatos(page);
  await expect(page.locator('#d-nombre')).toHaveValue('');
  await llenarDatos(page);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
});

/* ---------------- la sesión se vence, o el CRM no responde ---------------- */

test('si la sesión se venció con la canasta armada, pedir lleva a la entrada y la canasta no se pierde', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', (r) => r.fulfill({ status: 401, json: { ok: false, error: 'Entre con su cuenta para pedir.' } }));
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.unroute('**/tienda/mi-cuenta/api/yo');
  await page.route('**/tienda/mi-cuenta/api/yo', (r) => r.fulfill({ status: 401, json: { ok: false } }));
  await page.locator('#enviar').click();
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/$/);
  await expect(page.locator('#v-bienvenida, #v-entrar').first()).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('pe-canasta-v1') || '{}'))).toEqual({ 141: 1 });
});

test('si el CRM no responde, la tienda dice que está en pausa y da el WhatsApp; no manda a la entrada', async ({ page }) => {
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', (r) => r.fulfill({ status: 502, json: { ok: false, error: 'No pudimos' } }));
  await page.goto('/tienda/');
  await expect(page.locator('#estado')).toHaveText('La tienda está en pausa por un momento. Escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.');
  await expect(page).toHaveURL(/\/tienda\/$/);
  await expect(page.locator('#grilla li')).toHaveCount(0);
});

test('un catálogo que no dice nada de la sesión (CRM de antes) no manda a la entrada', async ({ page }) => {
  const { sesion, ...deAntes } = CATALOGO_CRM;   // eslint-disable-line no-unused-vars
  await abrirTienda(page, { catalogo: deAntes });
  await expect(page).toHaveURL(/\/tienda\/$/);
});
