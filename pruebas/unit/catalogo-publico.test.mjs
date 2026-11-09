/* Catálogo PÚBLICO de la página (functions/api/catalogo.js y functions/api/foto/[archivo].js).
   Lo que protege: decisión de Johan (9-nov-2026) de no mostrar precios en lo público
   (art. 26 de la Ley 1480: el precio publicado obliga); que solo salga lo que la página
   necesita (nunca stock, costo ni la dirección del CRM); que la clave nunca llegue al
   navegador; y que con el Mac del CRM apagado la página siga con la última lista buena.
   El CRM y la caché de Cloudflare se simulan. */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RAIZ } from '../lib.mjs';

/** @type {any} */
const catalogo = await import(pathToFileURL(join(RAIZ, 'functions/api/catalogo.js')).href);
/** @type {any} */
const foto = await import(pathToFileURL(join(RAIZ, 'functions/api/foto/[archivo].js')).href);

const CLAVE = 'clave-secreta-de-prueba-123';
const CRM = 'https://crm.ejemplo.test';
const FOTO_OK = '0123456789abcdef0123456789abcdef.webp';

/** Lo que manda el CRM (cuenta.tienda_catalogo): con precio, domicilio y campos de más */
function respuestaDelCrm() {
  return {
    ok: true,
    domicilio: { tarifa: 3000, gratis_desde: 50000 },
    categorias: [{ id: 'c1', nombre: 'Contenedores' }, { id: 'c2', nombre: 'Vasos' }, { id: 'c9', nombre: 'Vacía' }],
    productos: [
      {
        id: 141, nombre: 'Contenedor icopor J1 x25 und', categoria: 'c1', precio: 13800, disponible: true, destacado: true,
        foto: FOTO_OK, fotos: [FOTO_OK, '../../etc/passwd', 'fffffffffffffffffffffffffffffff0.svg'],
        contenido: { cantidad: 25, unidad: 'und', se_mide: false }, descripcion: '  Para comida caliente.  ',
        detalles: [{ nombre: 'Marca', valor: 'Wau' }, { nombre: '', valor: 'x' }], stock: 40, costo: 9000,
      },
      { id: 7, nombre: 'Vaso 7 oz', categoria: 'c2', precio: 5000, disponible: false, foto: 'malo.png' },
      { id: 'x', nombre: 'Sin id' },
      { id: 8, nombre: '   ' },
    ],
  };
}

/** @type {{url: string, init: any}[]} */
let llamadas = [];
/** @type {() => Promise<Response>} */
let crm;
/** @type {Map<string, Response>} */
let guardadas;
const fetchOriginal = globalThis.fetch;
const cachesOriginal = /** @type {any} */ (globalThis).caches;

beforeEach(() => {
  llamadas = [];
  guardadas = new Map();
  crm = async () => Response.json(respuestaDelCrm());
  globalThis.fetch = /** @type {any} */ (async (/** @type {string} */ url, /** @type {any} */ init) => {
    llamadas.push({ url: String(url), init });
    return crm();
  });
  /** @type {any} */ (globalThis).caches = {
    default: {
      match: async (/** @type {string} */ k) => (guardadas.has(k) ? /** @type {Response} */ (guardadas.get(k)).clone() : undefined),
      put: async (/** @type {string} */ k, /** @type {Response} */ r) => { guardadas.set(k, r.clone()); },
    },
  };
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  /** @type {any} */ (globalThis).caches = cachesOriginal;
});

/** @param {Record<string, string>} [env] */
async function pedirCatalogo(env = { PORTAL_CLAVE: CLAVE, CRM_URL: CRM }) {
  /** @type {Promise<any>[]} */
  const pendientes = [];
  const r = await catalogo.onRequestGet({
    request: new Request('https://www.plasticosespinal.com/api/catalogo', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }),
    env, waitUntil: (/** @type {Promise<any>} */ p) => pendientes.push(p),
  });
  await Promise.all(pendientes);
  return { r, datos: await r.json() };
}

test('sin precios: el catálogo público no deja pasar el precio, ni stock, ni costo, ni el domicilio', async () => {
  const { r, datos } = await pedirCatalogo();
  assert.equal(r.status, 200);
  const texto = JSON.stringify(datos);
  assert.doesNotMatch(texto, /precio|stock|costo|tarifa|gratis_desde|13800|9000/);
  assert.deepEqual(Object.keys(datos.productos[0]).sort(),
    ['categoria', 'contenido', 'descripcion', 'destacado', 'detalles', 'disponible', 'foto', 'fotos', 'id', 'nombre']);
});

test('PRECIOS_PUBLICOS="1" deja pasar el precio (y solo ese valor exacto lo prende)', async () => {
  assert.equal(catalogo.limpiarProducto({ id: 1, nombre: 'A', precio: 900 }, true).precio, 900);
  assert.equal(catalogo.limpiarProducto({ id: 1, nombre: 'A', precio: 900 }, false).precio, undefined);
  const { datos } = await pedirCatalogo({ PORTAL_CLAVE: CLAVE, CRM_URL: CRM, PRECIOS_PUBLICOS: '1' });
  assert.equal(datos.productos[0].precio, 13800);
  guardadas.clear();
  const otra = await pedirCatalogo({ PORTAL_CLAVE: CLAVE, CRM_URL: CRM, PRECIOS_PUBLICOS: 'true' });
  assert.equal(otra.datos.productos[0].precio, undefined);
});

test('apagar PRECIOS_PUBLICOS nunca sirve una copia guardada con precios', async () => {
  await pedirCatalogo({ PORTAL_CLAVE: CLAVE, CRM_URL: CRM, PRECIOS_PUBLICOS: '1' });
  crm = async () => { throw new Error('Mac apagado'); };
  const { r, datos } = await pedirCatalogo();
  assert.equal(r.status, 503, 'sin copia SIN precios, mejor el aviso que una lista con precios');
  assert.doesNotMatch(JSON.stringify(datos), /precio/);
});

test('fotos: solo nombres del CRM (32 hex + extensión de foto); nada de rutas ni SVG', () => {
  const p = catalogo.limpiarProducto(respuestaDelCrm().productos[0], false);
  assert.deepEqual(p.fotos, [FOTO_OK]);
  assert.equal(p.foto, FOTO_OK);
  assert.equal(catalogo.limpiarProducto(respuestaDelCrm().productos[1], false).foto, '');
});

test('descarta productos sin id o sin nombre, y categorías que nadie usa', () => {
  const c = catalogo.catalogoPublico(respuestaDelCrm(), false);
  assert.deepEqual(c.productos.map((/** @type {any} */ p) => p.id), [141, 7]);
  assert.deepEqual(c.categorias.map((/** @type {any} */ x) => x.id), ['c1', 'c2']);
  assert.equal(c.productos[0].descripcion, 'Para comida caliente.');
  assert.deepEqual(c.productos[0].detalles, [{ nombre: 'Marca', valor: 'Wau' }]);
  assert.equal(c.productos[1].disponible, false);
});

test('le pide al CRM con la clave en la cabecera (nunca en la dirección) y la respuesta no la trae', async () => {
  const { r, datos } = await pedirCatalogo();
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, `${CRM}/cuenta/api/tienda/catalogo`);
  assert.equal(llamadas[0].init.headers['X-Portal-Clave'], CLAVE);
  assert.equal(llamadas[0].init.headers['X-Cliente-IP'], '203.0.113.9');
  assert.doesNotMatch(JSON.stringify(datos) + JSON.stringify([...r.headers]), new RegExp(CLAVE + '|crm\\.ejemplo'));
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=300');
});

test('una copia reciente se sirve sin molestar al CRM', async () => {
  await pedirCatalogo();
  await pedirCatalogo();
  assert.equal(llamadas.length, 1);
});

test('con el Mac apagado sirve la última copia buena aunque esté vieja', async () => {
  await pedirCatalogo();
  /* la envejece: 10 minutos */
  const [llave, resp] = [...guardadas][0];
  const vieja = await resp.json();
  vieja.generado = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  guardadas.set(llave, Response.json(vieja));
  crm = async () => new Response('Bad gateway', { status: 502 });
  const { r, datos } = await pedirCatalogo();
  assert.equal(llamadas.length, 2, 'la copia vieja se intenta renovar');
  assert.equal(r.status, 200);
  assert.equal(datos.productos.length, 2);
});

test('sin copia y sin CRM: 503 con el WhatsApp, sin guardar nada en el navegador', async () => {
  crm = async () => { throw new Error('caído'); };
  const { r, datos } = await pedirCatalogo();
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(datos.ok, false);
  assert.match(datos.error, /WhatsApp/);
});

test('un CRM que responde raro o vacío no borra la copia buena', async () => {
  await pedirCatalogo();
  const [llave, resp] = [...guardadas][0];
  const vieja = await resp.json();
  vieja.generado = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  guardadas.set(llave, Response.json(vieja));
  crm = async () => Response.json({ ok: true, productos: [] });
  const { datos } = await pedirCatalogo();
  assert.equal(datos.productos.length, 2);
});

test('sin PORTAL_CLAVE no llama al CRM', async () => {
  const { r } = await pedirCatalogo({ CRM_URL: CRM });
  assert.equal(llamadas.length, 0);
  assert.equal(r.status, 503);
});

/* ---------------- Fotos ---------------- */

/** @param {string} archivo @param {Record<string, string>} [env] */
async function pedirFoto(archivo, env = { PORTAL_CLAVE: CLAVE, CRM_URL: CRM }) {
  return foto.onRequestGet({
    request: new Request(`https://www.plasticosespinal.com/api/foto/${archivo}`),
    env, params: { archivo },
  });
}

test('foto: solo nombres válidos llegan al CRM; lo demás es 404 sin llamar', async () => {
  for (const malo of ['../crm.db', 'abc.png', `${'0'.repeat(32)}.svg`, `${'0'.repeat(32)}.png/x`, '']) {
    const r = await pedirFoto(malo);
    assert.equal(r.status, 404, malo);
  }
  assert.equal(llamadas.length, 0);
  assert.equal((await pedirFoto(FOTO_OK, { CRM_URL: CRM })).status, 404, 'sin clave, apagada');
});

test('foto: pasa una imagen del CRM con caché larga y la clave solo va al CRM', async () => {
  crm = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
  const r = await pedirFoto(FOTO_OK);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Type'), 'image/webp');
  assert.match(r.headers.get('Cache-Control') || '', /immutable/);
  assert.equal(llamadas[0].url, `${CRM}/cuenta/api/tienda/foto/${FOTO_OK}`);
  assert.equal(llamadas[0].init.headers['X-Portal-Clave'], CLAVE);
  /* la segunda vez sale de la caché de Cloudflare (sirve con el Mac apagado) */
  crm = async () => { throw new Error('Mac apagado'); };
  assert.equal((await pedirFoto(FOTO_OK)).status, 200);
  assert.equal(llamadas.length, 1, "no volvió a llamar al CRM");
});

test('foto: un SVG, HTML o error del CRM no pasa', async () => {
  for (const tipo of ['image/svg+xml', 'text/html', 'application/octet-stream']) {
    crm = async () => new Response('<svg onload="x()"/>', { headers: { 'Content-Type': tipo } });
    assert.equal((await pedirFoto(FOTO_OK)).status, 404, tipo);
  }
  crm = async () => new Response('no', { status: 404, headers: { 'Content-Type': 'image/png' } });
  assert.equal((await pedirFoto(FOTO_OK)).status, 404);
});
