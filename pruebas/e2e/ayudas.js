/* Ayudas de las pruebas en navegador. */
import { expect } from '@playwright/test';

/**
 * Anota todo lo que sale mal en la página: errores de JS, avisos de la CSP,
 * recursos propios que no cargan. Al final de la prueba se exige que esté vacío.
 * @param {import('@playwright/test').Page} page
 */
export function vigilar(page) {
  /** @type {string[]} */
  const problemas = [];
  page.on('pageerror', (e) => problemas.push('JS: ' + e.message));
  page.on('console', (m) => {
    /* Los recursos que no cargan ya se anotan abajo con su dirección */
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problemas.push('consola: ' + m.text());
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    /* Las respuestas de la API (401 sin sesión, 400 código malo) son parte del contrato y se prueban aparte */
    if (u.hostname === '127.0.0.1' && r.status() >= 400 && r.request().resourceType() !== 'document' && !u.pathname.includes('/api/')) {
      problemas.push(`${r.status()} ${u.pathname}`);
    }
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.hostname === '127.0.0.1') problemas.push(`falló ${u.pathname}: ${r.failure()?.errorText}`);
  });
  return {
    problemas,
    sinProblemas: () => expect(problemas, 'la página tuvo errores').toEqual([]),
  };
}

/**
 * Catálogo de prueba con precios pensados para probar los bordes del domicilio.
 * Se sirve en lugar de /tienda/catalogo.json.
 */
export const CATALOGO_PRUEBA = {
  generado: '2026-10-07T10:00:00-05:00',
  muestra: true,
  domicilio: { tarifa: 4000, gratis_desde: 60000 },
  whatsapp: '573183555246',
  categorias: [
    { id: 'vasos', nombre: 'Vasos', imagen: '/img/productos/vasos.webp' },
    { id: 'bolsas', nombre: 'Bolsas', imagen: '/img/productos/bolsas.webp' },
  ],
  productos: [
    { id: 1, nombre: 'Vaso grande', categoria: 'vasos', precio: 30000, destacado: true },
    { id: 2, nombre: 'Vaso pequeño', categoria: 'vasos', precio: 29999, destacado: true },
    { id: 3, nombre: 'Bolsa ecológica', categoria: 'bolsas', precio: 1, destacado: true },
    { id: 4, nombre: 'Bolsa de 57 mil', categoria: 'bolsas', precio: 57000 },
    { id: 5, nombre: '<img src=x onerror="window.__xss=1">Bolsa rara', categoria: 'bolsas', precio: 1000 },
  ],
};

/**
 * Abre la tienda con un catálogo dado (o el real si no se da) y la canasta vacía.
 * @param {import('@playwright/test').Page} page
 * @param {object | null} [catalogo]
 */
export async function abrirTienda(page, catalogo = CATALOGO_PRUEBA) {
  if (catalogo) {
    await page.route('**/tienda/catalogo.json', (r) => r.fulfill({ json: catalogo }));
  }
  /* WhatsApp nunca se abre de verdad; window.open queda anotado */
  await page.route(/wa\.me|api\.whatsapp\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    /** @type {any} */ (window).__abiertos = [];
    window.open = (/** @type {any} */ url) => { /** @type {any} */ (window).__abiertos.push(String(url)); return /** @type {any} */ ({ opener: null }); };
  });
  await page.goto('/tienda/');
  await expect(page.locator('#grilla > li').first()).toBeVisible();
}

/**
 * Agrega un producto (por su nombre visible) las veces pedidas, desde «Todos los productos».
 * @param {import('@playwright/test').Page} page
 * @param {string} nombre
 * @param {number} [veces]
 */
export async function agregar(page, nombre, veces = 1) {
  await page.locator('#q').fill(nombre);
  const tarjeta = page.locator('#grilla article').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) });
  for (let i = 0; i < veces; i++) {
    const nuevo = tarjeta.getByRole('button', { name: `Agregar ${nombre} a la canasta` });
    if (await nuevo.count()) await nuevo.click();
    else await tarjeta.getByRole('button', { name: `Agregar uno más de ${nombre}` }).click();
  }
  await page.locator('#q').fill('');
}

/** Datos de entrega válidos (solo aplican cuando la tienda pide el formulario). */
export const DATOS = {
  nombre: 'Restaurante La Prueba', documento: '1105678901', celular: '3183555246',
  correo: 'prueba@ejemplo.com', barrio: 'El Centro', direccion: 'Calle 7 # 5-35', extra: '',
};

/**
 * Manda el pedido y devuelve el texto del mensaje de WhatsApp.
 * Sirve con la canasta de hoy (enlace directo) y con la del paso 2 de datos de entrega.
 * @param {import('@playwright/test').Page} page
 * @param {Partial<typeof DATOS>} [datos]
 */
export async function mensajeDelPedido(page, datos = {}) {
  await page.locator('[data-abrir]').first().click();
  const seguir = page.locator('#seguir');
  let url;
  if (await seguir.count()) {
    await seguir.click();
    const d = { ...DATOS, ...datos };
    await page.fill('#d-nombre', d.nombre);
    await page.fill('#d-doc', d.documento);
    await page.fill('#d-cel', d.celular);
    await page.fill('#d-correo', d.correo);
    await page.fill('#d-barrio', d.barrio);
    await page.fill('#d-dir', d.direccion);
    await page.fill('#d-extra', d.extra);
    await page.check('#d-acepto');
    await page.locator('#enviar').click();
    url = await page.evaluate(() => /** @type {any} */ (window).__abiertos.at(-1));
  } else {
    url = await page.locator('#enviar').getAttribute('href');
    await page.locator('#enviar').click();   /* al enviar, la tienda prepara un código nuevo */
  }
  expect(url, 'no se generó el enlace de WhatsApp').toBeTruthy();
  const u = new URL(url);
  expect(u.hostname).toBe('wa.me');
  expect(u.pathname).toBe('/573183555246');
  return u.searchParams.get('text') || '';
}

/**
 * Lee el mensaje del pedido como lo leería el bot: código, líneas y totales.
 * Es la «otra mitad» del contrato: si el formato cambia, esto deja de entenderlo.
 * @param {string} texto
 */
export function leerPedido(texto) {
  const lineas = texto.split('\n');
  const cab = lineas[0].match(/^Hola, quiero hacer este pedido 🛒 (PE-[A-HJ-NP-Z2-9]{4})$/);
  /** @type {{cantidad: number, nombre: string, id: number}[]} */
  const items = [];
  /** @type {Record<string, string>} */
  const campos = {};
  for (const l of lineas.slice(1)) {
    const it = l.match(/^(\d+) × (.+) \[#(\d+)\]$/);
    if (it) { items.push({ cantidad: Number(it[1]), nombre: it[2], id: Number(it[3]) }); continue; }
    const kv = l.match(/^([^:]+): (.*)$/);
    if (kv) {
      if (kv[1] in campos) throw new Error(`la clave «${kv[1]}» aparece dos veces en el mensaje`);
      campos[kv[1]] = kv[2];
    }
  }
  const pesos = (/** @type {string|undefined} */ t) => (t === 'gratis' ? 0 : Number(String(t).replace(/[$.\s]/g, '')));
  return {
    codigo: cab ? cab[1] : null,
    items,
    campos,
    productos: pesos(campos.Productos),
    domicilio: pesos(campos.Domicilio),
    total: pesos(campos.Total),
  };
}
