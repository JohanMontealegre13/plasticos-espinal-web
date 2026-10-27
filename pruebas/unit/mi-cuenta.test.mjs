/* Contrato del portal del cliente: el intermediario de Cloudflare
   (functions/tienda/mi-cuenta/api/[[ruta]].js) es lo único que habla con el CRM.
   Lo que protege: que el navegador nunca vea la clave ni la dirección del CRM,
   que la sesión viva solo en galletas HttpOnly, que solo pasen las rutas del
   portal y que un CRM caído o raro dé un aviso y no datos a medias.
   Que cada cliente vea solo lo suyo lo decide el CRM con su token: esa prueba
   vive en el repositorio del CRM. Aquí se simula el CRM con un fetch falso. */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RAIZ, leer, paginas } from '../lib.mjs';

const ARCHIVO = 'functions/tienda/mi-cuenta/api/[[ruta]].js';
/** @type {{ onRequest: (ctx: any) => Promise<Response> }} */
const intermediario = await import(pathToFileURL(join(RAIZ, ARCHIVO)).href);

const CLAVE = 'clave-secreta-de-prueba-123';
const CRM = 'https://crm.ejemplo.test';
const SITIO = 'https://plasticosespinal.com';
const SESION = 'sesion-xyz';

/** @type {{url: string, init: any}[]} */
let llamadas = [];
/** @type {(url: string, init: any) => Promise<Response>} */
let respuestaCrm;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  llamadas = [];
  respuestaCrm = async () => Response.json({ ok: true });
  globalThis.fetch = /** @type {any} */ (async (/** @type {string} */ url, /** @type {any} */ init) => {
    llamadas.push({ url: String(url), init });
    return respuestaCrm(String(url), init);
  });
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

/**
 * Llama al intermediario como lo haría Cloudflare.
 * @param {string} ruta lo que va después de /tienda/mi-cuenta/api/
 * @param {{ metodo?: string, cuerpo?: any, galleta?: string, origen?: string, env?: Record<string, string> }} [o]
 */
async function pedir(ruta, o = {}) {
  const headers = new Headers({ 'CF-Connecting-IP': '190.1.2.3' });
  if (o.galleta) headers.set('Cookie', o.galleta);
  if (o.origen) headers.set('Origin', o.origen);
  if (o.cuerpo !== undefined) headers.set('Content-Type', 'application/json');
  const request = new Request(`${SITIO}/tienda/mi-cuenta/api/${ruta}`, {
    method: o.metodo || 'GET', headers, body: o.cuerpo === undefined ? undefined : JSON.stringify(o.cuerpo),
  });
  const env = o.env || { PORTAL_CLAVE: CLAVE, CRM_URL: CRM };
  const r = await intermediario.onRequest({ request, env, params: { ruta: ruta.split('/') } });
  const texto = await r.clone().text();
  return { r, texto, galletas: r.headers.getSetCookie() };
}

/** Nada de lo que recibe el navegador puede delatar la clave ni el CRM. */
function sinFugas(/** @type {{r: Response, texto: string}} */ { r, texto }) {
  const todo = texto + JSON.stringify([...r.headers]);
  assert.ok(!todo.includes(CLAVE), 'la clave del CRM llegó al navegador');
  assert.ok(!todo.includes(CRM) && !todo.includes('portal.plasticosespinal.com'), 'la dirección del CRM llegó al navegador');
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
}

test('las páginas y el JS del portal nunca nombran al CRM ni su clave', () => {
  const archivos = [...paginas().filter((p) => p.startsWith('tienda/')), 'tienda/mi-cuenta/cuenta.js', 'tienda/mi-cuenta/menu.js', 'tienda/tienda.js'];
  for (const a of archivos) {
    assert.doesNotMatch(leer(a), /portal\.plasticosespinal\.com|X-Portal-Clave|PORTAL_CLAVE/i, a);
  }
  /* La clave solo sale de las variables de Cloudflare, nunca escrita en el archivo */
  assert.match(leer(ARCHIVO), /env\.PORTAL_CLAVE/);
  assert.doesNotMatch(leer(ARCHIVO), /PORTAL_CLAVE\s*[:=]\s*['"]/);
});

for (const [ruta, metodo] of [['admin', 'GET'], ['yo', 'POST'], ['entrar', 'GET'], ['codigo', 'POST'], ['pedidos/../admin', 'GET'], ['pedidos/abc', 'GET'], ['pedidos/1/recibo.pdf/x', 'GET'], ['', 'GET']]) {
  test(`ruta fuera del portal (${metodo} «${ruta}») da 404 sin llamar al CRM`, async () => {
    const res = await pedir(ruta, { metodo });
    assert.equal(res.r.status, 404);
    assert.equal(llamadas.length, 0);
  });
}

test('un POST desde otro sitio se rechaza (CSRF) sin llamar al CRM', async () => {
  const res = await pedir('entrar', { metodo: 'POST', cuerpo: {}, origen: 'https://malo.example' });
  assert.equal(res.r.status, 403);
  assert.equal(llamadas.length, 0);
});

test('sin la clave configurada en Cloudflare no se llama al CRM y se avisa', async () => {
  const res = await pedir('yo', { env: {} });
  assert.equal(res.r.status, 503);
  assert.equal(llamadas.length, 0);
  assert.match(res.texto, /318 355 5246/);
});

test('al CRM le llegan la clave, la IP del cliente y su token; al navegador nada de eso', async () => {
  respuestaCrm = async () => Response.json({ ok: true, nombre: 'Ana' });
  const res = await pedir('pedidos', { galleta: 'otra=1; pe_cuenta=tok-123' });
  assert.equal(llamadas.length, 1);
  const { url, init } = llamadas[0];
  assert.equal(url, `${CRM}/cuenta/api/pedidos`);
  assert.equal(init.headers['X-Portal-Clave'], CLAVE);
  assert.equal(init.headers['X-Cliente-IP'], '190.1.2.3');
  assert.equal(init.headers['X-Cuenta-Token'], 'tok-123');
  assert.equal(init.redirect, 'manual', 'una redirección del CRM no se debe seguir');
  assert.equal(res.r.status, 200);
  sinFugas(res);
});

test('sin CRM_URL usa el portal de producción', async () => {
  await pedir('yo', { env: { PORTAL_CLAVE: CLAVE } });
  assert.equal(llamadas[0].url, 'https://portal.plasticosespinal.com/cuenta/api/yo');
});

/** La galleta que se llama `nombre`, o falla la prueba. */
function galletaDe(/** @type {string[]} */ galletas, /** @type {string} */ nombre) {
  const g = galletas.find((x) => x.startsWith(nombre + '='));
  assert.ok(g, `falta la galleta ${nombre}`);
  return g;
}

for (const ruta of ['entrar', 'clave']) {
  test(`${ruta}: la sesión queda solo en galleta HttpOnly y el paso intermedio se borra`, async () => {
    respuestaCrm = async () => Response.json({ ok: true, token: SESION, nombre: 'Ana', estado: 'activa', dias: 30 });
    const res = await pedir(ruta, { metodo: 'POST', cuerpo: { usuario: '1105678901', clave: 'una-clave-larga' }, galleta: 'pe_cuenta_p=paso-verificado', origen: SITIO });
    assert.deepEqual(JSON.parse(res.texto), { ok: true, nombre: 'Ana', estado: 'activa' }, 'el token no puede ir en el cuerpo: el JS lo leería');
    const sesion = galletaDe(res.galletas, 'pe_cuenta');
    for (const parte of ['sesion-xyz', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/tienda', `Max-Age=${30 * 86400}`]) assert.ok(sesion.includes(parte), `falta ${parte}`);
    assert.match(galletaDe(res.galletas, 'pe_cuenta_p'), /^pe_cuenta_p=;.*Max-Age=0/, 'el paso intermedio debe borrarse');
    sinFugas(res);
  });
}

test('clave: al CRM le llega el paso verificado que guardó la galleta, no uno que mande la página', async () => {
  await pedir('clave', { metodo: 'POST', cuerpo: { clave: 'una-clave-larga', verificado: 'inventado' }, galleta: 'pe_cuenta_p=paso-verificado', origen: SITIO });
  assert.deepEqual(JSON.parse(llamadas[0].init.body), { clave: 'una-clave-larga', verificado: 'paso-verificado' });
});

for (const ruta of ['registro', 'olvide']) {
  test(`${ruta}: el paso intermedio queda en galleta HttpOnly por 15 minutos y no en la respuesta`, async () => {
    respuestaCrm = async () => Response.json({ ok: true, pendiente: 'paso-secreto', modo: 'enviar_codigo' });
    const res = await pedir(ruta, { metodo: 'POST', cuerpo: { documento: '1105678901', celular: '3183555246' }, origen: SITIO });
    assert.deepEqual(JSON.parse(res.texto), { ok: true, modo: 'enviar_codigo' });
    const g = galletaDe(res.galletas, 'pe_cuenta_p');
    for (const parte of ['paso-secreto', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/tienda', 'Max-Age=900']) assert.ok(g.includes(parte), `falta ${parte}`);
    assert.deepEqual(JSON.parse(llamadas[0].init.body), { documento: '1105678901', celular: '3183555246' });
    sinFugas(res);
  });
}

test('verificar: reenvía el paso de la galleta y, si el CRM dice listo, guarda el paso verificado en galleta', async () => {
  respuestaCrm = async () => Response.json({ ok: true, listo: true, verificado: 'paso-verificado' });
  const res = await pedir('verificar', { metodo: 'POST', cuerpo: { codigo: '123456', pendiente: 'inventado' }, galleta: 'pe_cuenta_p=paso-secreto', origen: SITIO });
  assert.deepEqual(JSON.parse(llamadas[0].init.body), { codigo: '123456', pendiente: 'paso-secreto' });
  assert.deepEqual(JSON.parse(res.texto), { ok: true, listo: true });
  assert.ok(galletaDe(res.galletas, 'pe_cuenta_p').includes('paso-verificado'));
  sinFugas(res);
});

test('verificar: mientras el CRM no dice listo, no se toca ninguna galleta', async () => {
  respuestaCrm = async () => Response.json({ ok: true, listo: false });
  const res = await pedir('verificar', { metodo: 'POST', cuerpo: {}, galleta: 'pe_cuenta_p=paso-secreto', origen: SITIO });
  assert.deepEqual(JSON.parse(res.texto), { ok: true, listo: false });
  assert.deepEqual(res.galletas, []);
});

test('el secreto del pedido solo pasa al CRM en las rutas de la tienda, y solo si tiene la forma esperada', async () => {
  const SECRETO = 'abcdefghij0123456789_-';
  /** @param {string} ruta @param {string} secreto */
  const conSecreto = async (ruta, secreto) => {
    llamadas = [];
    const headers = new Headers({ 'X-Pedido-Secreto': secreto });
    const request = new Request(`${SITIO}/tienda/mi-cuenta/api/${ruta}`, { headers });
    await intermediario.onRequest({ request, env: { PORTAL_CLAVE: CLAVE, CRM_URL: CRM }, params: { ruta: ruta.split('/') } });
    return llamadas[0].init.headers['X-Pedido-Secreto'];
  };
  assert.equal(await conSecreto('tienda/pedido/PE-AB2C3', SECRETO), SECRETO);
  assert.equal(await conSecreto('pedidos', SECRETO), undefined, 'fuera de la tienda el secreto no sale');
  assert.equal(await conSecreto('tienda/pedido/PE-AB2C3', 'corto'), undefined);
  assert.equal(await conSecreto('tienda/pedido/PE-AB2C3', 'tiene espacios y "comillas" 1234'), undefined);
});

test('la foto de un producto pasa como imagen; si el CRM no da una imagen, no existe', async () => {
  const ARCHIVO_FOTO = 'tienda/foto/' + 'a'.repeat(32) + '.webp';
  respuestaCrm = async () => new Response('RIFF....WEBP', { headers: { 'Content-Type': 'image/webp' } });
  const foto = await pedir(ARCHIVO_FOTO);
  assert.equal(foto.r.status, 200);
  assert.equal(foto.r.headers.get('Content-Type'), 'image/webp');
  assert.equal(foto.r.headers.get('X-Content-Type-Options'), 'nosniff');

  respuestaCrm = async () => new Response(`<html>${CRM}</html>`, { headers: { 'Content-Type': 'text/html' } });
  const html = await pedir(ARCHIVO_FOTO);
  assert.equal(html.r.status, 404);
  sinFugas(html);

  llamadas = [];
  assert.equal((await pedir('tienda/foto/../yo.webp')).r.status, 404);
  assert.equal((await pedir('tienda/foto/foto.svg')).r.status, 404, 'un SVG podría traer código');
  assert.equal(llamadas.length, 0);
});

test('si el CRM dice 401, la sesión se borra', async () => {
  respuestaCrm = async () => Response.json({ ok: false, error: 'Vuelva a entrar.' }, { status: 401 });
  const res = await pedir('yo', { galleta: 'pe_cuenta=vencido' });
  assert.equal(res.r.status, 401);
  assert.ok(res.galletas.some((x) => x.startsWith('pe_cuenta=;') && x.includes('Max-Age=0')));
});

test('CRM caído o que responde HTML: aviso amable, nunca su página', async () => {
  respuestaCrm = async () => new Response(`<html>Login del CRM en ${CRM}</html>`, { status: 404, headers: { 'Content-Type': 'text/html' } });
  const html = await pedir('yo');
  assert.equal(html.r.status, 502);
  assert.match(html.texto, /WhatsApp/);
  sinFugas(html);

  respuestaCrm = async () => { throw new Error('ECONNREFUSED'); };
  const caido = await pedir('yo');
  assert.equal(caido.r.status, 502);
  sinFugas(caido);
});

test('salir borra las dos galletas sin llamar al CRM', async () => {
  const res = await pedir('salir', { metodo: 'POST', origen: SITIO });
  assert.equal(llamadas.length, 0);
  assert.ok(res.galletas.some((x) => x.startsWith('pe_cuenta=;')));
  assert.ok(res.galletas.some((x) => x.startsWith('pe_cuenta_p=;')));
});

test('el recibo PDF pasa como PDF privado', async () => {
  respuestaCrm = async () => new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="FE-1.pdf"' } });
  const res = await pedir('pedidos/12/recibo.pdf', { galleta: 'pe_cuenta=t' });
  assert.equal(res.r.headers.get('Content-Type'), 'application/pdf');
  assert.equal(res.r.headers.get('Cache-Control'), 'private, no-store');
});

test('el portal queda detrás del candado de la tienda (mismo /tienda)', () => {
  assert.ok(ARCHIVO.startsWith('functions/tienda/'), 'si el portal sale de /tienda, el candado de pruebas ya no lo cubre');
});
