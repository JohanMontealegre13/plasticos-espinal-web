/* Quién ve qué y dónde (Cloudflare Pages Functions). Corre antes que cualquier otro
   archivo o función, pero solo en las rutas que nombra _routes.json: las demás (fotos,
   letras, estilos de la página) se sirven solas y no gastan peticiones del plan gratis.

   1. La tienda vive en tienda.plasticosespinal.com (decisión de Johan, 10-nov-2026).
      Sus archivos siguen en la carpeta tienda/: en el subdominio, «/» se sirve de
      tienda/, «/terminos/» de tienda/terminos/ y así. Lo que la tienda pide por su ruta
      completa (/tienda/tienda.css, /tienda/mi-cuenta/api/…) pasa tal cual, y una página
      pedida con /tienda/ delante se manda a su dirección limpia.
   2. plasticosespinal.com/tienda/… (con o sin www) se va con 301 al subdominio.
   3. Nadie entra sin cuenta (decisión de Johan, 10-nov-2026). Una página de la tienda solo
      se sirve si el navegador trae la galleta de la sesión (pe_sesion: la pone el
      intermediario de Mi cuenta al entrar o al crear la cuenta). Sin ella, todo va a la
      entrada (/mi-cuenta/: bienvenida, crear cuenta y entrar), que recibe en ?volver= lo
      que se pidió para regresar ahí. Sin cuenta solo se ven la entrada, los términos y la
      política de datos.
      Aquí solo se mira que la galleta exista. Si la sesión vale lo dice el CRM con cada
      dato (catálogo sin precios, 401 en lo demás): con una galleta inventada se ve la
      tienda vacía, y ella misma manda a la entrada.
      Los archivos (.css, .js, logos) y la API pasan sin galleta: la entrada los necesita
      y ninguno trae precios ni datos de nadie.

   Vista previa de Cloudflare (*.pages.dev): <vista previa>/?sitio=tienda la muestra como
   si fuera el subdominio (deja la galleta pe_sitio); ?sitio=web vuelve a la página. */

const DOMINIO_TIENDA = 'tienda.plasticosespinal.com';
const DOMINIOS_WEB = ['plasticosespinal.com', 'www.plasticosespinal.com'];
/* Lo que la tienda comparte con la página (letras, íconos, el catálogo público) */
const COMPARTIDO = /^\/(?:fonts|img|css|js|api|\.well-known)\/|^\/(?:favicon\.ico|site\.webmanifest|apple-touch-icon\.png)$/;
/* La API del portal: nunca se redirige ni pide la galleta (el CRM revisa cada sesión) */
const API = '/tienda/mi-cuenta/api/';

/* La sesión de la cuenta: el mismo nombre que usa functions/tienda/mi-cuenta/api/[[ruta]].js */
const SESION = 'pe_sesion';
/* La entrada de la tienda, desde su raíz */
const ENTRADA = 'mi-cuenta/';
/* Lo único que se ve sin cuenta (direcciones limpias, sin /tienda/ delante) */
const ABIERTAS = ['/mi-cuenta/', '/terminos/', '/privacidad/'];
const SITIO = 'pe_sitio';
const TREINTA_DIAS = 60 * 60 * 24 * 30;
/* Fotos de producto que manda el CRM: su nombre cambia con cada foto, así que
   el navegador las puede guardar (solo él). */
const FOTOS = API + 'tienda/foto/';

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
 * ¿Esa ruta de la tienda (con /tienda/ delante) solo se sirve con cuenta? Todo lo que no sea
 * la API, un archivo (.css, .js, .svg…) o una de las páginas abiertas. Una dirección sin «/»
 * final ni extensión cuenta como página: el servidor de archivos la manda a la que sí la tiene.
 * @param {string} ruta
 */
export function pideCuenta(ruta) {
  if (ruta.startsWith(API)) return false;
  if (/\.[a-z0-9]+$/i.test(ruta) && !ruta.endsWith('.html')) return false;
  return !ABIERTAS.includes(sinTienda(ruta).replace(/\/?$/, '/'));
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
      if (lectura && !ruta.startsWith(API) && esPagina(ruta)) return { tipo: 'ir', destino: sinTienda(ruta) + url.search };
      return { tipo: 'pasar' };
    }
    if (COMPARTIDO.test(ruta)) return { tipo: 'pasar' };
    return { tipo: 'tienda', ruta: '/tienda' + ruta };
  }
  if (DOMINIOS_WEB.includes(url.hostname) && deTienda && lectura && !ruta.startsWith(API)) {
    return { tipo: 'ir', destino: `https://${DOMINIO_TIENDA}${sinTienda(ruta)}${url.search}` };
  }
  return { tipo: 'pasar' };
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

function irA(destino, galletas = [], estado = 303) {
  const headers = new Headers({ Location: destino, 'Cache-Control': 'no-store' });
  for (const g of galletas) headers.append('Set-Cookie', g);
  return new Response(null, { status: estado, headers });
}

function robots() {
  /* La tienda es solo para quien tiene cuenta: nada de ella va a los buscadores */
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
  if (!deTienda) return next();

  /* Sin la galleta de la sesión, una página de la tienda manda a la entrada */
  const ruta = destino.tipo === 'tienda' ? destino.ruta : url.pathname;
  const lectura = request.method === 'GET' || request.method === 'HEAD';
  if (lectura && pideCuenta(ruta) && !leerGalleta(request, SESION)) {
    const entrada = inicio + ENTRADA;
    const pedida = url.pathname + url.search;
    return irA(sinTienda(ruta) === '/' && !url.search ? entrada : `${entrada}?volver=${encodeURIComponent(pedida)}`, [], 302);
  }
  if (destino.tipo === 'tienda') return privada(await servirTienda(env, request, url, destino.ruta), destino.ruta);
  return privada(await next(), url.pathname);
}
