/* Candado de la tienda (functions/tienda/_middleware.js, Cloudflare Pages Functions).
   Lo que protege: que nadie vea la tienda ni los precios de muestra sin la contraseña,
   que Google no la indexe y que la galleta sea segura.
   La contraseña real no se conoce aquí (solo su huella). Para probar el camino
   «contraseña correcta» se carga una copia del archivo con huellas de una clave de prueba. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { RAIZ, leer } from '../lib.mjs';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const fuente = leer('functions/tienda/_middleware.js');
const SAL = (fuente.match(/const SAL = '([^']+)'/) || [])[1];

/** @type {{ onRequest: (ctx: any) => Promise<Response> }} */
const real = await import(pathToFileURL(join(RAIZ, 'functions/tienda/_middleware.js')).href);

const CLAVE_PRUEBA = 'clave-solo-para-pruebas';
const copia = fuente
  .replace(/const HUELLA_CLAVE = '[0-9a-f]{64}'/, `const HUELLA_CLAVE = '${sha(`${SAL}|clave|${CLAVE_PRUEBA}`)}'`)
  .replace(/const HUELLA_GALLETA = '[0-9a-f]{64}'/, `const HUELLA_GALLETA = '${sha(sha(`${SAL}|galleta|${CLAVE_PRUEBA}`))}'`);
/** @type {{ onRequest: (ctx: any) => Promise<Response> }} */
const prueba = await import('data:text/javascript,' + encodeURIComponent(copia));

const PAGINA = new Response('<html>tienda</html>', { headers: { 'Content-Type': 'text/html' } });

/**
 * Llama al candado y dice si dejó pasar la petición hasta el archivo.
 * @param {{ onRequest: (ctx: any) => Promise<Response> }} mod
 * @param {string} ruta
 * @param {RequestInit} [init]
 */
async function pedir(mod, ruta, init) {
  let paso = false;
  const request = new Request('https://plasticosespinal.com' + ruta, init);
  const r = await mod.onRequest({ request, next: async () => { paso = true; return PAGINA.clone(); } });
  return { r, paso, html: await r.clone().text() };
}

test('las huellas del archivo real tienen el formato esperado (si no, nadie podría entrar)', () => {
  assert.ok(SAL, 'no encontré la SAL');
  assert.match(fuente, /const HUELLA_CLAVE = '[0-9a-f]{64}'/);
  assert.match(fuente, /const HUELLA_GALLETA = '[0-9a-f]{64}'/);
  assert.notEqual(copia, fuente, 'la copia de prueba no reemplazó las huellas');
});

for (const ruta of ['/tienda/', '/tienda/index.html', '/tienda/catalogo.json', '/tienda/tienda.js', '/tienda/img/logo-negativo-noche.svg']) {
  test(`sin galleta, ${ruta} pide la contraseña y no se sirve`, async () => {
    const { r, paso, html } = await pedir(real, ruta);
    assert.equal(paso, false, 'el archivo se sirvió sin contraseña');
    assert.equal(r.status, 401);
    assert.match(html, /<form method="post" action="\/tienda\/entrar">/);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.match(r.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  });
}

test('una galleta inventada no abre la tienda', async () => {
  const { paso, r } = await pedir(real, '/tienda/catalogo.json', { headers: { Cookie: 'pe_tienda=' + 'a'.repeat(64) } });
  assert.equal(paso, false);
  assert.equal(r.status, 401);
});

test('solo el logo exacto se sirve sin candado', async () => {
  assert.equal((await pedir(real, '/tienda/img/logo-color.svg')).paso, true);
  assert.equal((await pedir(real, '/tienda/img/logo-color.svg.bak')).paso, false);
  assert.equal((await pedir(real, '/tienda/img/logo-color.svg/../../catalogo.json')).paso, false);
});

test('contraseña equivocada: 401, sin galleta y con pausa contra adivinar a la fuerza', async () => {
  const cuerpo = new URLSearchParams({ clave: 'no-es-esta' });
  const t0 = Date.now();
  const { r, html } = await pedir(real, '/tienda/entrar', { method: 'POST', body: cuerpo });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('Set-Cookie'), null);
  assert.match(html, /Esa no es la contraseña/);
  assert.ok(Date.now() - t0 >= 700, 'la pausa contra fuerza bruta desapareció');
});

test('GET a /tienda/entrar no intenta entrar: vuelve a la tienda', async () => {
  const { r } = await pedir(real, '/tienda/entrar');
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/tienda/');
});

test('formulario dañado cuenta como contraseña equivocada (no revienta)', async () => {
  const { r } = await pedir(real, '/tienda/entrar', { method: 'POST', body: '%%%', headers: { 'Content-Type': 'multipart/form-data; boundary=x' } });
  assert.equal(r.status, 401);
});

test('contraseña correcta: galleta HttpOnly, Secure, SameSite y solo para /tienda, por 30 días', async () => {
  const { r } = await pedir(prueba, '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: `  ${CLAVE_PRUEBA} ` }) });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/tienda/');
  const galleta = r.headers.get('Set-Cookie') || '';
  for (const parte of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/tienda', `Max-Age=${60 * 60 * 24 * 30}`]) assert.ok(galleta.includes(parte), `a la galleta le falta ${parte}`);
  assert.ok(!galleta.includes(CLAVE_PRUEBA), 'la galleta lleva la contraseña en claro');
});

test('con la galleta buena se sirve la tienda, privada y fuera de buscadores', async () => {
  const entrada = await pedir(prueba, '/tienda/entrar', { method: 'POST', body: new URLSearchParams({ clave: CLAVE_PRUEBA }) });
  const valor = (entrada.r.headers.get('Set-Cookie') || '').split(';')[0];
  const { r, paso } = await pedir(prueba, '/tienda/catalogo.json', { headers: { Cookie: `otra=1; ${valor}` } });
  assert.equal(paso, true);
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
});

test('/tienda/salir borra la galleta', async () => {
  const { r } = await pedir(real, '/tienda/salir');
  assert.equal(r.status, 303);
  assert.match(r.headers.get('Set-Cookie') || '', /pe_tienda=; Path=\/tienda; Max-Age=0/);
});
