/* Middleware del sitio (functions/_middleware.js, Cloudflare Pages Functions).
   Lo que protege:
   - el subdominio tienda.plasticosespinal.com sirve la tienda desde tienda/ y
     plasticosespinal.com/tienda/… se va allá con 301 (decisión de Johan, 10-nov-2026);
   - la puerta: nadie ve una página de la tienda sin la galleta de su cuenta (decisión de
     Johan, 10-nov-2026). Sin ella todo va a la entrada, y solo se ven la entrada, los
     términos y la política de datos. Google no indexa nada;
   - lo que no es tienda sigue igual (la página, el catálogo público, las letras).
   Que la sesión valga de verdad lo revisa el CRM en cada dato (sus pruebas viven en el
   repositorio del CRM); que la galleta sea segura, unit/mi-cuenta.test.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RAIZ, leer } from '../lib.mjs';

const ARCHIVO = 'functions/_middleware.js';
const fuente = leer(ARCHIVO);

/** @typedef {{ onRequest: (ctx: any) => Promise<Response>, rutaDe: (url: URL, enTienda: boolean, metodo?: string) => any, pideCuenta: (ruta: string) => boolean }} Modulo */
/** @type {Modulo} */
const real = await import(pathToFileURL(join(RAIZ, ARCHIVO)).href);

const CON_CUENTA = { headers: { Cookie: 'otra=1; pe_sesion=token-firmado-por-el-crm' } };

const TIENDA = 'https://tienda.plasticosespinal.com';
const WEB = 'https://www.plasticosespinal.com';
const PREVIA = 'https://claude-algo.plasticos-espinal-web.pages.dev';

/**
 * Llama al middleware y cuenta qué sirvió: `paso` = siguió a su archivo o función (next),
 * `archivo` = la ruta que pidió al servidor de archivos (env.ASSETS) para el subdominio.
 * @param {string} direccion dirección completa
 * @param {RequestInit} [init]
 * @param {(ruta: string) => Response} [archivos] lo que responde el servidor de archivos
 */
async function pedir(direccion, init, archivos) {
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
  const r = await real.onRequest({ request, env, next: async () => { paso = true; return new Response('<html>archivo</html>', { headers: { 'Content-Type': 'text/html' } }); } });
  return { r, paso, archivo, html: await r.clone().text() };
}

/* ---------------- El subdominio ---------------- */

test('en el subdominio, «/» y sus páginas salen de la carpeta tienda/', async () => {
  for (const [ruta, desde] of [['/', '/tienda/'], ['/terminos/', '/tienda/terminos/'], ['/mi-cuenta/pedidos/?id=3', '/tienda/mi-cuenta/pedidos/']]) {
    const { r, paso, archivo } = await pedir(TIENDA + ruta, CON_CUENTA);
    assert.equal(r.status, 200, ruta);
    assert.equal(paso, false, `${ruta} se sirvió de la página y no de la tienda`);
    assert.equal(archivo, desde, ruta);
  }
});

test('en el subdominio, una página pedida con /tienda/ delante se va a su dirección limpia', async () => {
  for (const [ruta, limpia] of [['/tienda', '/'], ['/tienda/', '/'], ['/tienda/index.html', '/'], ['/tienda/terminos/?v=1', '/terminos/?v=1'], ['/tienda/mi-cuenta/index.html', '/mi-cuenta/']]) {
    const { r } = await pedir(TIENDA + ruta);
    assert.equal(r.status, 301, ruta);
    assert.equal(r.headers.get('Location'), limpia, ruta);
  }
});

test('en el subdominio, los archivos y la API de /tienda/ pasan tal cual (sin redirigir)', async () => {
  for (const ruta of ['/tienda/tienda.css', '/tienda/tienda.js', '/tienda/catalogo.json', '/tienda/mi-cuenta/api/yo', '/tienda/mi-cuenta/api/tienda/pedido']) {
    const { r, paso } = await pedir(TIENDA + ruta, CON_CUENTA);
    assert.equal(paso, true, ruta);
    assert.equal(r.status, 200, ruta);
  }
});

test('en el subdominio, lo compartido con la página (letras, íconos, catálogo público) pasa sin pedir cuenta', async () => {
  for (const ruta of ['/fonts/archivo-latin.woff2', '/img/apple-touch-icon.png', '/favicon.ico', '/api/catalogo', '/js/buscar.js']) {
    const { paso } = await pedir(TIENDA + ruta);
    assert.equal(paso, true, `${ruta} pidió cuenta o se fue a la tienda`);
  }
});

test('el robots.txt del subdominio no deja indexar nada: la tienda es solo para quien tiene cuenta', async () => {
  const { r, html, paso } = await pedir(TIENDA + '/robots.txt');
  assert.equal(paso, false);
  assert.match(html, /Disallow: \/\n/);
  assert.match(r.headers.get('Content-Type') || '', /text\/plain/);
});

test('si el servidor de archivos redirige (falta la «/»), la dirección sale sin /tienda/', async () => {
  const archivos = () => new Response(null, { status: 308, headers: { Location: '/tienda/terminos/' } });
  const { r } = await pedir(TIENDA + '/terminos', undefined, archivos);
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('Location'), '/terminos/');
});

/* ---------------- La página principal ---------------- */

test('plasticosespinal.com/tienda/… (con y sin www) se va con 301 al subdominio', async () => {
  for (const host of [WEB, 'https://plasticosespinal.com']) {
    for (const [ruta, destino] of [['/tienda', '/'], ['/tienda/', '/'], ['/tienda/mi-cuenta/?a=1', '/mi-cuenta/?a=1'], ['/tienda/terminos/', '/terminos/']]) {
      const { r, paso } = await pedir(host + ruta);
      assert.equal(paso, false);
      assert.equal(r.status, 301, host + ruta);
      assert.equal(r.headers.get('Location'), TIENDA + destino, host + ruta);
    }
  }
});

test('en la página principal la API del portal no se redirige: pasa a su función', async () => {
  const { r, paso } = await pedir(WEB + '/tienda/mi-cuenta/api/yo');
  assert.equal(paso, true);
  assert.equal(r.status, 200);
});

test('lo que no es tienda en la página principal pasa sin tocar', async () => {
  for (const ruta of ['/', '/index.html', '/terminos/', '/robots.txt']) {
    const { paso, archivo } = await pedir(WEB + ruta);
    assert.equal(paso, true, ruta);
    assert.equal(archivo, null, `${ruta} se sirvió de la tienda en la página principal`);
  }
});

test('el catálogo viejo /productos/ se va con 301 a la tienda; la ficha ?p=ID, al mismo producto (#p=ID)', async () => {
  for (const host of [WEB, 'https://plasticosespinal.com', PREVIA]) {
    for (const [ruta, destino] of [['/productos', '/'], ['/productos/', '/'], ['/productos/index.html', '/'], ['/productos/?categoria=vasos', '/'],
      ['/productos/?p=141', '/#p=141'], ['/productos/?categoria=vasos&p=7', '/#p=7'], ['/productos/?p=<script>', '/'], ['/productos/?p=12abc', '/']]) {
      const { r, paso } = await pedir(host + ruta);
      assert.equal(paso, false, host + ruta);
      assert.equal(r.status, 301, host + ruta);
      assert.equal(r.headers.get('Location'), TIENDA + destino, host + ruta);
    }
  }
  /* Lo que solo empieza parecido no se toca */
  const { paso } = await pedir(WEB + '/productos-nuevos.html');
  assert.equal(paso, true);
});

test('un POST a /tienda/ no se redirige en ningún dominio (un 301 perdería el cuerpo)', async () => {
  for (const host of [WEB, TIENDA, PREVIA]) {
    for (const ruta of ['/tienda/mi-cuenta/api/entrar', '/tienda/mi-cuenta/api/tienda/pedido', '/tienda/']) {
      const { r } = await pedir(host + ruta, { method: 'POST', body: '{}' });
      assert.ok(r.status < 300 || r.status >= 400, `${host}${ruta} se redirigió con ${r.status}`);
    }
  }
});

/* ---------------- Vista previa ---------------- */

test('vista previa: ?sitio=tienda la muestra como el subdominio y ?sitio=web la devuelve', async () => {
  const ida = await pedir(PREVIA + '/terminos/?sitio=tienda&x=1');
  assert.equal(ida.r.status, 302);
  assert.equal(ida.r.headers.get('Location'), '/terminos/?x=1');
  assert.match(ida.r.headers.get('Set-Cookie') || '', /^pe_sitio=tienda; Path=\/;.*HttpOnly; Secure; SameSite=Lax/);

  const como = await pedir(PREVIA + '/', { headers: { Cookie: 'pe_sitio=tienda; pe_sesion=token' } });
  assert.equal(como.archivo, '/tienda/');

  const vuelta = await pedir(PREVIA + '/?sitio=web');
  assert.match(vuelta.r.headers.get('Set-Cookie') || '', /^pe_sitio=; Path=\/; Max-Age=0/);
});

test('vista previa sin la galleta: la página sigue siendo la página y /tienda/ sigue en /tienda/', async () => {
  assert.equal((await pedir(PREVIA + '/')).paso, true);
  const { r, paso } = await pedir(PREVIA + '/tienda/', CON_CUENTA);
  assert.equal(r.status, 200, 'en la vista previa /tienda/ se fue a otra dirección');
  assert.equal(paso, true);
});

test('?sitio=tienda en el dominio de verdad no hace nada (no se puede imitar la tienda allá)', async () => {
  const { r, paso } = await pedir(WEB + '/?sitio=tienda');
  assert.equal(paso, true);
  assert.equal(r.headers.get('Set-Cookie'), null);
});

/* ---------------- La puerta: nadie entra sin cuenta ---------------- */

for (const [direccion, entrada] of [
  [TIENDA + '/', '/mi-cuenta/'],
  [TIENDA + '/index.html', '/mi-cuenta/'],
  [TIENDA + '/?promo=1', '/mi-cuenta/?volver=%2F%3Fpromo%3D1'],
  [TIENDA + '/mi-cuenta/pedidos/', '/mi-cuenta/?volver=%2Fmi-cuenta%2Fpedidos%2F'],
  [TIENDA + '/mi-cuenta/pedido/?id=12', '/mi-cuenta/?volver=%2Fmi-cuenta%2Fpedido%2F%3Fid%3D12'],
  [TIENDA + '/mi-cuenta/datos', '/mi-cuenta/?volver=%2Fmi-cuenta%2Fdatos'],
  [TIENDA + '/una-que-no-existe/', '/mi-cuenta/?volver=%2Funa-que-no-existe%2F'],
  [PREVIA + '/tienda/', '/tienda/mi-cuenta/'],
  [PREVIA + '/tienda', '/tienda/mi-cuenta/'],
  [PREVIA + '/tienda/index.html', '/tienda/mi-cuenta/'],
  [PREVIA + '/tienda/mi-cuenta/pedidos/', '/tienda/mi-cuenta/?volver=%2Ftienda%2Fmi-cuenta%2Fpedidos%2F'],
]) {
  test(`sin cuenta, ${direccion} no se sirve: va a la entrada`, async () => {
    for (const method of ['GET', 'HEAD']) {
      const { r, paso, archivo } = await pedir(direccion, { method });
      assert.equal(paso, false, 'el archivo se sirvió sin cuenta');
      assert.equal(archivo, null, 'la página de la tienda se sirvió sin cuenta');
      assert.equal(r.status, 302, 'tiene que ser temporal: con la cuenta, la misma dirección sí se sirve');
      assert.equal(r.headers.get('Location'), entrada);
      assert.equal(r.headers.get('Cache-Control'), 'no-store');
      assert.equal(r.headers.get('Set-Cookie'), null);
    }
  });
}

test('sin cuenta solo se ven la entrada, los términos y la política de datos', async () => {
  for (const ruta of ['/mi-cuenta/', '/mi-cuenta/index.html', '/mi-cuenta/?volver=%2F', '/terminos/', '/privacidad/']) {
    const { r, archivo } = await pedir(TIENDA + ruta);
    assert.equal(r.status, 200, ruta);
    assert.ok(archivo && archivo.startsWith('/tienda/'), `${ruta} no salió de la carpeta de la tienda`);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow', ruta);
    assert.equal(r.headers.get('Cache-Control'), 'private, no-store', ruta);
  }
  for (const ruta of ['/tienda/mi-cuenta/', '/tienda/terminos/', '/tienda/privacidad/index.html']) {
    const { r, paso } = await pedir(PREVIA + ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(paso, true, ruta);
  }
});

test('sin cuenta pasan los archivos y la API: la entrada los necesita y el CRM cuida lo suyo', async () => {
  for (const ruta of ['/tienda/tienda.css', '/tienda/mi-cuenta/cuenta.css', '/tienda/mi-cuenta/cuenta.js', '/tienda/img/logo-negativo-noche.svg',
    '/tienda/catalogo.json', '/tienda/mi-cuenta/api/tienda/catalogo', '/tienda/mi-cuenta/api/yo']) {
    const { r, paso } = await pedir(TIENDA + ruta);
    assert.equal(paso, true, ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow', ruta);
  }
  const registro = await pedir(TIENDA + '/tienda/mi-cuenta/api/registro', { method: 'POST', body: '{}' });
  assert.equal(registro.paso, true, 'sin cuenta no se podría crear la cuenta');
});

test('qué pide cuenta y qué no (pideCuenta)', () => {
  const pide = ['/tienda', '/tienda/', '/tienda/index.html', '/tienda/mi-cuenta/pedidos/', '/tienda/mi-cuenta/pedidos', '/tienda/mi-cuenta/pedido/',
    '/tienda/mi-cuenta/datos/index.html', '/tienda/terminos/otra/', '/tienda/terminos/otra.html', '/tienda/mi-cuenta/apis/', '/tienda/TERMINOS/', '/tienda/v1.2/'];
  const libre = ['/tienda/mi-cuenta', '/tienda/mi-cuenta/', '/tienda/mi-cuenta/index.html', '/tienda/terminos', '/tienda/terminos/', '/tienda/privacidad/',
    '/tienda/privacidad/index.html', '/tienda/tienda.css', '/tienda/tienda.js', '/tienda/catalogo.json', '/tienda/img/logo-color.svg',
    '/tienda/mi-cuenta/api/yo', '/tienda/mi-cuenta/api/tienda/pedido/PE-AB2C3'];
  for (const ruta of pide) assert.equal(real.pideCuenta(ruta), true, `${ruta} se sirve sin cuenta`);
  for (const ruta of libre) assert.equal(real.pideCuenta(ruta), false, `${ruta} pide cuenta`);
});

test('una galleta vacía o la de la contraseña de antes no abren la tienda', async () => {
  for (const Cookie of ['pe_sesion=', 'pe_tienda=' + 'a'.repeat(64), 'pe_cuenta=token-de-antes', 'pe_sesion_x=1']) {
    const { r, paso, archivo } = await pedir(TIENDA + '/', { headers: { Cookie } });
    assert.equal(paso || !!archivo, false, Cookie);
    assert.equal(r.status, 302, Cookie);
  }
});

test('con la galleta de la cuenta se sirve la tienda, privada y fuera de buscadores', async () => {
  for (const ruta of ['/', '/mi-cuenta/pedidos/', '/tienda/catalogo.json']) {
    const { r, paso, archivo } = await pedir(TIENDA + ruta, CON_CUENTA);
    assert.ok(paso || archivo, ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('la galleta que mira la puerta es la que pone el intermediario de Mi cuenta', () => {
  const puerta = (fuente.match(/const SESION = '([a-z_]+)'/) || [])[1];
  const portal = (leer('functions/tienda/mi-cuenta/api/[[ruta]].js').match(/const GALLETA = '([a-z_]+)'/) || [])[1];
  assert.ok(puerta, 'no encontré el nombre de la galleta en el middleware');
  assert.equal(puerta, portal);
});

test('la contraseña de prueba ya no existe: nada en la puerta pone ni compara galletas', async () => {
  assert.doesNotMatch(fuente, /HUELLA|sha256|Set-Cookie[^\n]*pe_sesion/i, 'la puerta no debe poner la sesión: eso es del intermediario');
  const { r } = await pedir(TIENDA + '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: 'x' }) });
  assert.equal(r.headers.get('Set-Cookie'), null);
});

test('_routes.json despierta el middleware en las páginas de la tienda y en nada más de sobra', () => {
  const rutas = JSON.parse(leer('_routes.json'));
  assert.equal(rutas.version, 1);
  for (const r of ['/', '/tienda/*', '/productos', '/productos/*', '/mi-cuenta/*', '/terminos/*', '/privacidad/*', '/robots.txt']) assert.ok(rutas.include.includes(r), `falta ${r}`);
  assert.ok(!rutas.include.includes('/*'), 'con /* cada foto y cada letra gastaría una petición del plan gratis');
  for (const r of ['/fonts/*', '/img/*', '/css/*', '/js/*']) assert.ok(!rutas.include.includes(r), `${r} no necesita el middleware`);
});
