/* Quién ve qué y dónde (Cloudflare Pages Functions). Corre antes que cualquier otro
   archivo o función, pero solo en las rutas que nombra _routes.json: las demás (fotos,
   letras, estilos de la página) se sirven solas y no gastan peticiones del plan gratis.

   1. La tienda vive en tienda.plasticosespinal.com (decisión de Johan, 10-nov-2026).
      Sus archivos siguen en la carpeta tienda/: en el subdominio, «/» se sirve de
      tienda/, «/terminos/» de tienda/terminos/ y así. Lo que la tienda pide por su ruta
      completa (/tienda/tienda.css, /tienda/mi-cuenta/api/…) pasa tal cual, y una página
      pedida con /tienda/ delante se manda a su dirección limpia.
   2. plasticosespinal.com/tienda/… (con o sin www) se va con 301 al subdominio.
   3. Candado de prueba: la tienda pide la contraseña antes de servirse (en el subdominio
      y en /tienda/ de cualquier dirección). No está escrita aquí: solo su huella SHA-256
      con sal. Al entrar queda una galleta HttpOnly de 30 días; /tienda/salir la borra.
      Para cambiar la contraseña, recalcular las dos huellas:
        CLAVE   = sha256(SAL + "|clave|" + contraseña)
        GALLETA = sha256(sha256(SAL + "|galleta|" + contraseña))

   Vista previa de Cloudflare (*.pages.dev): <vista previa>/?sitio=tienda la muestra como
   si fuera el subdominio (deja la galleta pe_sitio); ?sitio=web vuelve a la página. */

const DOMINIO_TIENDA = 'tienda.plasticosespinal.com';
const DOMINIOS_WEB = ['plasticosespinal.com', 'www.plasticosespinal.com'];
/* Lo que la tienda comparte con la página (letras, íconos, el catálogo público) */
const COMPARTIDO = /^\/(?:fonts|img|css|js|api|\.well-known)\/|^\/(?:favicon\.ico|site\.webmanifest|apple-touch-icon\.png)$/;
/* Rutas de /tienda/ que nunca se redirigen: la API del portal y el candado */
const SIEMPRE_AQUI = /^\/tienda\/(?:mi-cuenta\/api\/|entrar$|salir$)/;

const SAL = 'pe-tienda-2026';
const HUELLA_CLAVE = '56fd20b17c5e2b4b9fe6d9918e817656a00035d32c66fe6f61150d3b53d66b5c';
const HUELLA_GALLETA = '6833740cb8d8d221685d1283cfd7cd29a5984a1bde2c55bc6ce88e9626b78905';
const GALLETA = 'pe_tienda';
const SITIO = 'pe_sitio';
const TREINTA_DIAS = 60 * 60 * 24 * 30;
/* El logo de la pantalla de la contraseña se sirve sin candado */
const LOGO_LIBRE = '/tienda/img/logo-color.svg';
/* Fotos de producto que manda el CRM: su nombre cambia con cada foto, así que
   el navegador las puede guardar (solo él: siguen detrás del candado). */
const FOTOS = '/tienda/mi-cuenta/api/tienda/foto/';

/**
 * Una página de la tienda pedida con /tienda/ delante, sin ese pedazo:
 * /tienda/ -> /, /tienda/terminos/ -> /terminos/, /tienda/mi-cuenta/index.html -> /mi-cuenta/.
 * @param {string} ruta
 */
export function sinTienda(ruta) {
  return (ruta.replace(/^\/tienda(?=\/|$)/, '') || '/').replace(/(^|\/)index\.html$/, '$1');
}

/** ¿Es una página (y no un archivo como .css, .js o .svg)? @param {string} ruta */
function esPagina(ruta) {
  return ruta === '/tienda' || ruta.endsWith('/') || ruta.endsWith('.html');
}

/**
 * Qué hacer con una petición, sin tocar nada (lo usan el middleware, las pruebas y el
 * servidor local de pruebas):
 *   { tipo: 'pasar' }                       sigue tal cual (archivo o función)
 *   { tipo: 'tienda', ruta: '/tienda/…' }   página de la tienda servida desde su carpeta
 *   { tipo: 'ir', destino: '…' }            redirige con 301
 *   { tipo: 'robots' }                      robots.txt del subdominio
 * @param {URL} url
 * @param {boolean} enTienda ¿llegó por el subdominio de la tienda (o su copia de vista previa)?
 * @param {string} [metodo]
 */
export function rutaDe(url, enTienda, metodo = 'GET') {
  const ruta = url.pathname;
  const deTienda = ruta === '/tienda' || ruta.startsWith('/tienda/');
  const lectura = metodo === 'GET' || metodo === 'HEAD';
  if (enTienda) {
    if (ruta === '/robots.txt') return { tipo: 'robots' };
    if (deTienda) {
      if (lectura && !SIEMPRE_AQUI.test(ruta) && esPagina(ruta)) return { tipo: 'ir', destino: sinTienda(ruta) + url.search };
      return { tipo: 'pasar' };
    }
    if (COMPARTIDO.test(ruta)) return { tipo: 'pasar' };
    return { tipo: 'tienda', ruta: '/tienda' + ruta };
  }
  if (DOMINIOS_WEB.includes(url.hostname) && deTienda && lectura && !SIEMPRE_AQUI.test(ruta)) {
    return { tipo: 'ir', destino: `https://${DOMINIO_TIENDA}${sinTienda(ruta)}${url.search}` };
  }
  return { tipo: 'pasar' };
}

async function sha256(texto) {
  const datos = new TextEncoder().encode(texto);
  const huella = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(huella)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Comparación de tiempo constante entre dos huellas hex de igual largo */
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function leerGalleta(request, nombre) {
  const todas = request.headers.get('Cookie') || '';
  for (const parte of todas.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return resto.join('=');
  }
  return '';
}

/** Vista previa de Cloudflare o este computador: ahí se puede imitar el subdominio */
function esVistaPrevia(/** @type {string} */ host) {
  return host.endsWith('.pages.dev') || host === 'localhost' || host === '127.0.0.1';
}

function privada(respuesta, ruta) {
  const r = new Response(respuesta.body, respuesta);
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  const guardable = ruta.startsWith(FOTOS) && respuesta.status === 200;
  r.headers.set('Cache-Control', guardable ? 'private, max-age=2592000, immutable' : 'private, no-store');
  return r;
}

function pantallaClave(error, estado) {
  const aviso = error ? '<p class="error" role="alert">Esa no es la contraseña. Intente de nuevo.</p>' : '';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Tienda en pruebas · Plásticos Espinal</title>
<style>
@font-face{font-family:"Archivo";font-weight:400 800;font-display:swap;src:url("/fonts/archivo-latin.woff2") format("woff2")}
@font-face{font-family:"Archivo Black";font-display:swap;src:url("/fonts/archivoblack-latin.woff2") format("woff2")}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#f4f6fb;color:#121833;font-family:"Archivo",system-ui,sans-serif}
form{width:100%;max-width:380px;background:#fff;border:1px solid #e3e7f1;border-radius:20px;padding:28px 24px;display:grid;gap:14px;box-shadow:0 10px 30px rgba(14,26,71,.08)}
img{height:46px;width:auto}
h1{font-family:"Archivo Black","Archivo",sans-serif;font-size:24px;margin:0;line-height:1.15}
p{margin:0;color:#59617d}
label{font-weight:700}
input{width:100%;font:inherit;font-size:18px;padding:12px 14px;border:2px solid #e3e7f1;border-radius:12px}
input:focus{outline:none;border-color:#1A44BE}
button{font:inherit;font-weight:800;font-size:17px;padding:13px;border:0;border-radius:99px;background:#1A44BE;color:#fff;cursor:pointer}
.error{color:#D42215;font-weight:700}
</style></head>
<body>
<form method="post" action="/tienda/entrar">
  <img src="${LOGO_LIBRE}" alt="Plásticos Espinal">
  <h1>Tienda en línea en pruebas</h1>
  <p>Todavía no está abierta al público. Escriba la contraseña de prueba para entrar.</p>
  ${aviso}
  <label for="clave">Contraseña</label>
  <input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
  <button type="submit">Entrar</button>
</form>
</body></html>`;
  return new Response(html, {
    status: estado,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

function irA(destino, galletas = [], estado = 303) {
  const headers = new Headers({ Location: destino, 'Cache-Control': 'no-store' });
  for (const g of galletas) headers.append('Set-Cookie', g);
  return new Response(null, { status: estado, headers });
}

function robots() {
  /* Mientras la tienda tenga candado, nada de ella va a los buscadores */
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Sirve una página de la tienda desde su carpeta. Si el servidor de archivos redirige
 * (/tienda/terminos -> /tienda/terminos/), la dirección nueva sale sin /tienda/ delante.
 * @param {any} env
 * @param {Request} request
 * @param {URL} url
 * @param {string} ruta
 */
async function servirTienda(env, request, url, ruta) {
  const respuesta = await env.ASSETS.fetch(new Request(new URL(ruta + url.search, url), request));
  const destino = respuesta.headers.get('Location');
  if (respuesta.status >= 300 && respuesta.status < 400 && destino) {
    const nueva = new URL(destino, url);
    if (nueva.origin === url.origin) {
      const r = new Response(respuesta.body, respuesta);
      r.headers.set('Location', sinTienda(nueva.pathname) + nueva.search);
      return r;
    }
  }
  return respuesta;
}

/** @param {{ request: Request, next: (r?: Request) => Promise<Response>, env: any }} ctx */
export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  /* Vista previa: ?sitio=tienda la muestra como el subdominio; ?sitio=web la devuelve */
  const pedido = url.searchParams.get('sitio');
  if (esVistaPrevia(url.hostname) && (pedido === 'tienda' || pedido === 'web')) {
    url.searchParams.delete('sitio');
    const valor = pedido === 'tienda' ? `${SITIO}=tienda; Path=/; Max-Age=${TREINTA_DIAS}` : `${SITIO}=; Path=/; Max-Age=0`;
    return irA(url.pathname + url.search, [`${valor}; HttpOnly; Secure; SameSite=Lax`], 302);
  }
  const enTienda = url.hostname === DOMINIO_TIENDA || (esVistaPrevia(url.hostname) && leerGalleta(request, SITIO) === 'tienda');
  const inicio = enTienda ? '/' : '/tienda/';

  const destino = rutaDe(url, enTienda, request.method);
  if (destino.tipo === 'ir') return irA(destino.destino, [], 301);
  if (destino.tipo === 'robots') return robots();

  const deTienda = destino.tipo === 'tienda' || url.pathname === '/tienda' || url.pathname.startsWith('/tienda/');
  if (!deTienda || url.pathname === LOGO_LIBRE) return next();

  if (url.pathname === '/tienda/salir') {
    /* También la de antes del subdominio, que vivía solo en /tienda */
    const borrar = (/** @type {string} */ camino) => `${GALLETA}=; Path=${camino}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
    return irA(inicio, [borrar('/'), borrar('/tienda')]);
  }

  if (url.pathname === '/tienda/entrar') {
    if (request.method !== 'POST') return irA(inicio);
    let clave = '';
    try {
      const datos = await request.formData();
      clave = String(datos.get('clave') || '').trim();
    } catch (e) { /* formulario dañado: cuenta como contraseña equivocada */ }
    if (iguales(await sha256(`${SAL}|clave|${clave}`), HUELLA_CLAVE)) {
      const valor = await sha256(`${SAL}|galleta|${clave}`);
      return irA(inicio, [`${GALLETA}=${valor}; Path=/; Max-Age=${TREINTA_DIAS}; HttpOnly; Secure; SameSite=Lax`]);
    }
    /* Pausa corta para que adivinar a la fuerza sea lento */
    await new Promise((listo) => setTimeout(listo, 800));
    return pantallaClave(true, 401);
  }

  const galleta = leerGalleta(request, GALLETA);
  if (!galleta || !iguales(await sha256(galleta), HUELLA_GALLETA)) return pantallaClave(false, 401);
  if (destino.tipo === 'tienda') return privada(await servirTienda(env, request, url, destino.ruta), destino.ruta);
  return privada(await next(), url.pathname);
}
