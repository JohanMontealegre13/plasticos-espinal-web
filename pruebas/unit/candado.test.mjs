/* Middleware del sitio (functions/_middleware.js, Cloudflare Pages Functions).
   Lo que protege:
   - el subdominio tienda.plasticosespinal.com sirve la tienda desde tienda/ y
     plasticosespinal.com/tienda/… se va allá con 301 (decisión de Johan, 10-nov-2026);
   - el candado: nadie ve la tienda ni sus precios sin la contraseña, Google no la
     indexa y la galleta es segura;
   - lo que no es tienda sigue igual (la página, el catálogo público, las letras).
   La contraseña real no se conoce aquí (solo su huella). Para probar el camino
   «contraseña correcta» se carga una copia del archivo con huellas de una clave de prueba. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RAIZ, leer } from '../lib.mjs';

const ARCHIVO = 'functions/_middleware.js';
const sha = (t) => createHash('sha256').update(t).digest('hex');
const fuente = leer(ARCHIVO);
const SAL = (fuente.match(/const SAL = '([^']+)'/) || [])[1];

/** @typedef {{ onRequest: (ctx: any) => Promise<Response>, rutaDe: (url: URL, enTienda: boolean, metodo?: string) => any }} Modulo */
/** @type {Modulo} */
const real = await import(pathToFileURL(join(RAIZ, ARCHIVO)).href);

const CLAVE_PRUEBA = 'clave-solo-para-pruebas';
const copia = fuente
  .replace(/const HUELLA_CLAVE = '[0-9a-f]{64}'/, `const HUELLA_CLAVE = '${sha(`${SAL}|clave|${CLAVE_PRUEBA}`)}'`)
  .replace(/const HUELLA_GALLETA = '[0-9a-f]{64}'/, `const HUELLA_GALLETA = '${sha(sha(`${SAL}|galleta|${CLAVE_PRUEBA}`))}'`);
/** @type {Modulo} */
const prueba = await import('data:text/javascript,' + encodeURIComponent(copia));
const GALLETA_BUENA = `pe_tienda=${sha(`${SAL}|galleta|${CLAVE_PRUEBA}`)}`;

const TIENDA = 'https://tienda.plasticosespinal.com';
const WEB = 'https://www.plasticosespinal.com';
const PREVIA = 'https://claude-algo.plasticos-espinal-web.pages.dev';

/**
 * Llama al middleware y cuenta qué sirvió: `paso` = siguió a su archivo o función (next),
 * `archivo` = la ruta que pidió al servidor de archivos (env.ASSETS) para el subdominio.
 * @param {Modulo} mod
 * @param {string} direccion dirección completa
 * @param {RequestInit} [init]
 * @param {(ruta: string) => Response} [archivos] lo que responde el servidor de archivos
 */
async function pedir(mod, direccion, init, archivos) {
  let paso = false;
  /** @type {string | null} */
  let archivo = null;
  const request = new Request(direccion, init);
  const env = {
    ASSETS: {
      fetch: async (/** @type {Request} */ r) => {
        archivo = new URL(r.url).pathname;
        return archivos ? archivos(archivo) : new Response('<html>tienda</html>', { headers: { 'Content-Type': 'text/html' } });
      },
    },
  };
  const r = await mod.onRequest({ request, env, next: async () => { paso = true; return new Response('<html>archivo</html>', { headers: { 'Content-Type': 'text/html' } }); } });
  return { r, paso, archivo, html: await r.clone().text() };
}

test('las huellas del archivo real tienen el formato esperado (si no, nadie podría entrar)', () => {
  assert.ok(SAL, 'no encontré la SAL');
  assert.match(fuente, /const HUELLA_CLAVE = '[0-9a-f]{64}'/);
  assert.match(fuente, /const HUELLA_GALLETA = '[0-9a-f]{64}'/);
  assert.notEqual(copia, fuente, 'la copia de prueba no reemplazó las huellas');
});

/* ---------------- El subdominio ---------------- */

test('en el subdominio, «/» y sus páginas salen de la carpeta tienda/', async () => {
  for (const [ruta, desde] of [['/', '/tienda/'], ['/terminos/', '/tienda/terminos/'], ['/mi-cuenta/pedidos/?id=3', '/tienda/mi-cuenta/pedidos/']]) {
    const { r, paso, archivo } = await pedir(prueba, TIENDA + ruta, { headers: { Cookie: GALLETA_BUENA } });
    assert.equal(r.status, 200, ruta);
    assert.equal(paso, false, `${ruta} se sirvió de la página y no de la tienda`);
    assert.equal(archivo, desde, ruta);
  }
});

test('en el subdominio, una página pedida con /tienda/ delante se va a su dirección limpia', async () => {
  for (const [ruta, limpia] of [['/tienda', '/'], ['/tienda/', '/'], ['/tienda/index.html', '/'], ['/tienda/terminos/?v=1', '/terminos/?v=1'], ['/tienda/mi-cuenta/index.html', '/mi-cuenta/']]) {
    const { r } = await pedir(real, TIENDA + ruta);
    assert.equal(r.status, 301, ruta);
    assert.equal(r.headers.get('Location'), limpia, ruta);
  }
});

test('en el subdominio, los archivos y la API de /tienda/ pasan tal cual (sin redirigir)', async () => {
  for (const ruta of ['/tienda/tienda.css', '/tienda/tienda.js', '/tienda/catalogo.json', '/tienda/mi-cuenta/api/yo', '/tienda/mi-cuenta/api/tienda/pedido']) {
    const { r, paso } = await pedir(prueba, TIENDA + ruta, { headers: { Cookie: GALLETA_BUENA } });
    assert.equal(paso, true, ruta);
    assert.equal(r.status, 200, ruta);
  }
});

test('en el subdominio, lo compartido con la página (letras, íconos, catálogo público) pasa sin candado', async () => {
  for (const ruta of ['/fonts/archivo-latin.woff2', '/img/apple-touch-icon.png', '/favicon.ico', '/api/catalogo', '/js/buscar.js']) {
    const { paso } = await pedir(real, TIENDA + ruta);
    assert.equal(paso, true, `${ruta} quedó detrás del candado o se fue a la tienda`);
  }
});

test('el robots.txt del subdominio no deja indexar nada mientras haya candado', async () => {
  const { r, html, paso } = await pedir(real, TIENDA + '/robots.txt');
  assert.equal(paso, false);
  assert.match(html, /Disallow: \/\n/);
  assert.match(r.headers.get('Content-Type') || '', /text\/plain/);
});

test('si el servidor de archivos redirige (falta la «/»), la dirección sale sin /tienda/', async () => {
  const archivos = () => new Response(null, { status: 308, headers: { Location: '/tienda/terminos/' } });
  const { r } = await pedir(prueba, TIENDA + '/terminos', { headers: { Cookie: GALLETA_BUENA } }, archivos);
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('Location'), '/terminos/');
});

/* ---------------- La página principal ---------------- */

test('plasticosespinal.com/tienda/… (con y sin www) se va con 301 al subdominio', async () => {
  for (const host of [WEB, 'https://plasticosespinal.com']) {
    for (const [ruta, destino] of [['/tienda', '/'], ['/tienda/', '/'], ['/tienda/mi-cuenta/?a=1', '/mi-cuenta/?a=1'], ['/tienda/terminos/', '/terminos/']]) {
      const { r, paso } = await pedir(real, host + ruta);
      assert.equal(paso, false);
      assert.equal(r.status, 301, host + ruta);
      assert.equal(r.headers.get('Location'), TIENDA + destino, host + ruta);
    }
  }
});

test('en la página principal la API del portal no se redirige (sigue detrás del candado)', async () => {
  const { r, paso } = await pedir(real, WEB + '/tienda/mi-cuenta/api/yo');
  assert.equal(paso, false);
  assert.equal(r.status, 401);
});

test('lo que no es tienda en la página principal pasa sin tocar', async () => {
  for (const ruta of ['/', '/index.html', '/productos/', '/terminos/', '/api/catalogo', '/robots.txt']) {
    const { paso, archivo } = await pedir(real, WEB + ruta);
    assert.equal(paso, true, ruta);
    assert.equal(archivo, null, `${ruta} se sirvió de la tienda en la página principal`);
  }
});

test('un POST a /tienda/ en la página principal no se redirige (un 301 perdería el cuerpo)', async () => {
  const { r } = await pedir(real, WEB + '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: 'x' }) });
  assert.notEqual(r.status, 301);
});

/* ---------------- Vista previa ---------------- */

test('vista previa: ?sitio=tienda la muestra como el subdominio y ?sitio=web la devuelve', async () => {
  const ida = await pedir(real, PREVIA + '/terminos/?sitio=tienda&x=1');
  assert.equal(ida.r.status, 302);
  assert.equal(ida.r.headers.get('Location'), '/terminos/?x=1');
  assert.match(ida.r.headers.get('Set-Cookie') || '', /^pe_sitio=tienda; Path=\/;.*HttpOnly; Secure; SameSite=Lax/);

  const como = await pedir(prueba, PREVIA + '/', { headers: { Cookie: `pe_sitio=tienda; ${GALLETA_BUENA}` } });
  assert.equal(como.archivo, '/tienda/');

  const vuelta = await pedir(real, PREVIA + '/?sitio=web');
  assert.match(vuelta.r.headers.get('Set-Cookie') || '', /^pe_sitio=; Path=\/; Max-Age=0/);
});

test('vista previa sin la galleta: la página sigue siendo la página y /tienda/ sigue en /tienda/', async () => {
  assert.equal((await pedir(real, PREVIA + '/')).paso, true);
  const { r } = await pedir(real, PREVIA + '/tienda/');
  assert.equal(r.status, 401, 'en la vista previa /tienda/ se redirigió en vez de pedir la contraseña');
});

test('?sitio=tienda en el dominio de verdad no hace nada (no se puede imitar la tienda allá)', async () => {
  const { r, paso } = await pedir(real, WEB + '/?sitio=tienda');
  assert.equal(paso, true);
  assert.equal(r.headers.get('Set-Cookie'), null);
});

/* ---------------- El candado ---------------- */

for (const direccion of [TIENDA + '/', TIENDA + '/terminos/', TIENDA + '/tienda/catalogo.json', TIENDA + '/tienda/tienda.js',
  TIENDA + '/tienda/img/logo-negativo-noche.svg', TIENDA + '/tienda/mi-cuenta/api/tienda/catalogo', PREVIA + '/tienda/', PREVIA + '/tienda/index.html']) {
  test(`sin galleta, ${direccion} pide la contraseña y no se sirve`, async () => {
    const { r, paso, archivo, html } = await pedir(real, direccion);
    assert.equal(paso, false, 'el archivo se sirvió sin contraseña');
    assert.equal(archivo, null, 'la página de la tienda se sirvió sin contraseña');
    assert.equal(r.status, 401);
    assert.match(html, /<form method="post" action="\/tienda\/entrar">/);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.match(r.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  });
}

test('una galleta inventada no abre la tienda', async () => {
  for (const direccion of [TIENDA + '/', TIENDA + '/tienda/catalogo.json']) {
    const { paso, archivo, r } = await pedir(real, direccion, { headers: { Cookie: 'pe_tienda=' + 'a'.repeat(64) } });
    assert.equal(paso || !!archivo, false);
    assert.equal(r.status, 401);
  }
});

test('solo el logo exacto se sirve sin candado', async () => {
  assert.equal((await pedir(real, TIENDA + '/tienda/img/logo-color.svg')).paso, true);
  assert.equal((await pedir(real, TIENDA + '/tienda/img/logo-color.svg.bak')).paso, false);
  assert.equal((await pedir(real, TIENDA + '/tienda/img/logo-color.svg/../../catalogo.json')).paso, false);
});

test('contraseña equivocada: 401, sin galleta y con pausa contra adivinar a la fuerza', async () => {
  const cuerpo = new URLSearchParams({ clave: 'no-es-esta' });
  const t0 = Date.now();
  const { r, html } = await pedir(real, TIENDA + '/tienda/entrar', { method: 'POST', body: cuerpo });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('Set-Cookie'), null);
  assert.match(html, /Esa no es la contraseña/);
  assert.ok(Date.now() - t0 >= 700, 'la pausa contra fuerza bruta desapareció');
});

test('GET a /tienda/entrar no intenta entrar: vuelve al inicio de la tienda', async () => {
  assert.equal((await pedir(real, TIENDA + '/tienda/entrar')).r.headers.get('Location'), '/');
  const previa = await pedir(real, PREVIA + '/tienda/entrar');
  assert.equal(previa.r.status, 303);
  assert.equal(previa.r.headers.get('Location'), '/tienda/');
});

test('formulario dañado cuenta como contraseña equivocada (no revienta)', async () => {
  const { r } = await pedir(real, TIENDA + '/tienda/entrar', { method: 'POST', body: '%%%', headers: { 'Content-Type': 'multipart/form-data; boundary=x' } });
  assert.equal(r.status, 401);
});

test('contraseña correcta: galleta HttpOnly, Secure, SameSite, para toda la tienda (Path=/), por 30 días', async () => {
  const { r } = await pedir(prueba, TIENDA + '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: `  ${CLAVE_PRUEBA} ` }) });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/');
  const galleta = r.headers.get('Set-Cookie') || '';
  for (const parte of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/;', `Max-Age=${60 * 60 * 24 * 30}`]) assert.ok(galleta.includes(parte), `a la galleta le falta ${parte}`);
  assert.ok(!/Domain=/i.test(galleta), 'la galleta no debe salir del subdominio');
  assert.ok(!galleta.includes(CLAVE_PRUEBA), 'la galleta lleva la contraseña en claro');
});

test('con la galleta buena se sirve la tienda, privada y fuera de buscadores', async () => {
  const entrada = await pedir(prueba, TIENDA + '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: CLAVE_PRUEBA }) });
  const valor = (entrada.r.headers.get('Set-Cookie') || '').split(';')[0];
  for (const ruta of ['/', '/tienda/catalogo.json']) {
    const { r, paso, archivo } = await pedir(prueba, TIENDA + ruta, { headers: { Cookie: `otra=1; ${valor}` } });
    assert.ok(paso || archivo, ruta);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('/tienda/salir borra la galleta (la de ahora y la de antes del subdominio)', async () => {
  const { r } = await pedir(real, TIENDA + '/tienda/salir');
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/');
  const galletas = r.headers.getSetCookie();
  assert.ok(galletas.some((g) => /^pe_tienda=; Path=\/; Max-Age=0/.test(g)));
  assert.ok(galletas.some((g) => /^pe_tienda=; Path=\/tienda; Max-Age=0/.test(g)));
});

test('_routes.json despierta el middleware en las páginas de la tienda y en nada más de sobra', () => {
  const rutas = JSON.parse(leer('_routes.json'));
  assert.equal(rutas.version, 1);
  for (const r of ['/', '/tienda/*', '/api/*', '/mi-cuenta/*', '/terminos/*', '/privacidad/*', '/robots.txt']) assert.ok(rutas.include.includes(r), `falta ${r}`);
  assert.ok(!rutas.include.includes('/*'), 'con /* cada foto y cada letra gastaría una petición del plan gratis');
  for (const r of ['/fonts/*', '/img/*', '/css/*', '/js/*']) assert.ok(!rutas.include.includes(r), `${r} no necesita el middleware`);
});
