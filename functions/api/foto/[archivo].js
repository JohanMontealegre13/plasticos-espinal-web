/* Foto PÚBLICA de un producto del catálogo de la página (/productos/). El CRM solo entrega
   la de lo que se vende en la tienda; el nombre lo pone el CRM y cambia con cada foto, así
   que Cloudflare y el navegador la pueden guardar mucho tiempo (y se sigue viendo con el
   Mac del CRM apagado). Variables: las mismas de functions/api/catalogo.js. */

const FOTO = /^[0-9a-f]{32}\.(?:png|jpe?g|gif|webp)$/;
const UN_MES = 60 * 60 * 24 * 30;
/* Solo fotos de verdad: un SVG (u otra cosa) servido desde este dominio podría traer código */
const TIPOS = /^image\/(?:png|jpeg|gif|webp)(?:;|$)/;

function noExiste() {
  return new Response('No existe.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** @param {{ request: Request, env: Record<string, string>, params: { archivo?: string | string[] }, waitUntil?: (p: Promise<any>) => void }} ctx */
export async function onRequestGet({ request, env, params, waitUntil }) {
  const archivo = [].concat(params.archivo || []).join('/');
  if (!FOTO.test(archivo) || !env.PORTAL_CLAVE) return noExiste();
  const cache = typeof caches !== 'undefined' ? /** @type {any} */ (caches).default : null;
  const llave = new URL(`/api/foto/${archivo}`, request.url).toString();
  if (cache) {
    const guardada = await cache.match(llave).catch(() => null);
    if (guardada) return guardada;
  }
  const base = (env.CRM_URL || 'https://portal.plasticosespinal.com').replace(/\/+$/, '');
  let r;
  try {
    r = await fetch(`${base}/cuenta/api/tienda/foto/${archivo}`, {
      headers: { 'X-Portal-Clave': env.PORTAL_CLAVE, Accept: 'image/*' }, redirect: 'manual',
    });
  } catch (e) {
    return noExiste();
  }
  const tipo = r.headers.get('Content-Type') || '';
  if (!r.ok || !TIPOS.test(tipo)) return noExiste();
  const foto = new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': tipo,
      'Cache-Control': `public, max-age=${UN_MES}, immutable`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  if (cache) {
    const guardar = cache.put(llave, foto.clone()).catch(() => {});
    if (waitUntil) waitUntil(guardar); else await guardar;
  }
  return foto;
}
