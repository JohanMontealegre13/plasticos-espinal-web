/* Catálogo PÚBLICO de la página (Cloudflare Pages Functions): lo usan /productos/ y las
   pestañas del inicio. Decisión de Johan (9-nov-2026): sin precios; cada producto se pide
   por WhatsApp. Los precios solo existen en la tienda, para quien entró con su cuenta: desde
   el 10-nov-2026 el CRM ni siquiera los manda a quien no trae sesión, como aquí.

   - Le pide al CRM el mismo catálogo de la tienda (con PORTAL_CLAVE, como el intermediario
     de Mi cuenta) y deja pasar SOLO lo que la página necesita: nunca el precio (salvo que
     PRECIOS_PUBLICOS valga "1"), nunca cuántas hay, nunca la dirección del CRM.
   - Guarda la última respuesta buena en la caché de Cloudflare: si el Mac del CRM está
     apagado (cortes de luz), la página sigue mostrando la última lista que tuvo.

   Variables de Cloudflare Pages:
     PORTAL_CLAVE      (secreto, obligatorio; el mismo de Mi cuenta)
     CRM_URL           (opcional; por defecto https://portal.plasticosespinal.com)
     PRECIOS_PUBLICOS  (opcional; "1" deja pasar el precio si el CRM lo manda. Apagado por decisión
                       de Johan, y sin sesión el CRM ya no lo manda: prenderlo no muestra nada) */

const FRESCA_MS = 5 * 60 * 1000;          /* más vieja que esto, se vuelve a pedir al CRM */
const GUARDAR_S = 60 * 60 * 24 * 14;      /* cuánto la guarda Cloudflare por si el CRM no responde */
const FOTO = /^[0-9a-f]{32}\.(?:png|jpe?g|gif|webp)$/;
/* Una copia por modo: apagar PRECIOS_PUBLICOS nunca deja salir una copia guardada con precios */
const LLAVE = 'https://cache.plasticosespinal.local/api/catalogo/v2';
const LLAVE_CON_PRECIO = LLAVE + '?precio=1';

/* Notas que el CRM guarda en la descripción para uso interno («Importado de Siigo…
   Revisar precio de venta e IVA.»): son para el personal, nunca para la página. */
const NOTA_INTERNA = /^importado de |revisar precio/i;

/** Texto limpio y con tope, o '' */
function texto(v, tope) {
  return typeof v === 'string' ? v.trim().slice(0, tope) : '';
}

/**
 * Lo que sale a la página de cada producto. Lo que no está aquí no sale.
 * @param {any} p producto del CRM
 * @param {boolean} conPrecio
 */
export function limpiarProducto(p, conPrecio) {
  if (!p || typeof p !== 'object') return null;
  const id = Number(p.id);
  const nombre = texto(p.nombre, 160);
  if (!Number.isInteger(id) || id <= 0 || !nombre) return null;
  const fotos = (Array.isArray(p.fotos) ? p.fotos : []).filter((f) => typeof f === 'string' && FOTO.test(f)).slice(0, 8);
  const foto = typeof p.foto === 'string' && FOTO.test(p.foto) ? p.foto : (fotos[0] || '');
  /** @type {Record<string, any>} */
  const limpio = {
    id, nombre, categoria: p.categoria == null ? '' : String(p.categoria).slice(0, 40),
    disponible: p.disponible !== false, destacado: !!p.destacado, foto, fotos,
  };
  const c = p.contenido;
  if (c && typeof c === 'object' && Number(c.cantidad) > 0 && texto(c.unidad, 20)) {
    limpio.contenido = { cantidad: Number(c.cantidad), unidad: texto(c.unidad, 20), se_mide: !!c.se_mide };
  }
  const descripcion = texto(p.descripcion, 1500);
  if (descripcion && !NOTA_INTERNA.test(descripcion)) limpio.descripcion = descripcion;
  const detalles = (Array.isArray(p.detalles) ? p.detalles : [])
    .map((d) => ({ nombre: texto(d && d.nombre, 40), valor: texto(d && d.valor, 120) }))
    .filter((d) => d.nombre && d.valor).slice(0, 12);
  if (detalles.length) limpio.detalles = detalles;
  if (conPrecio && Number(p.precio) > 0) limpio.precio = Number(p.precio);
  return limpio;
}

/**
 * El catálogo que ve la página, a partir de lo que manda el CRM.
 * @param {any} crm
 * @param {boolean} conPrecio
 */
export function catalogoPublico(crm, conPrecio) {
  const productos = (Array.isArray(crm && crm.productos) ? crm.productos : [])
    .map((p) => limpiarProducto(p, conPrecio)).filter(Boolean);
  const usadas = new Set(productos.map((p) => p && p.categoria));
  const categorias = (Array.isArray(crm && crm.categorias) ? crm.categorias : [])
    .map((c) => ({ id: c && c.id != null ? String(c.id).slice(0, 40) : '', nombre: texto(c && c.nombre, 60) }))
    .filter((c) => c.id && c.nombre && usadas.has(c.id));
  return { ok: true, categorias, productos, generado: new Date().toISOString() };
}

function responder(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* el navegador la guarda poco; la copia larga es la de Cloudflare (abajo) */
      'Cache-Control': estado === 200 ? 'public, max-age=300' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/** @param {{ request: Request, env: Record<string, string>, waitUntil?: (p: Promise<any>) => void }} ctx */
export async function onRequestGet({ request, env, waitUntil }) {
  const cache = typeof caches !== 'undefined' ? /** @type {any} */ (caches).default : null;
  const conPrecio = env.PRECIOS_PUBLICOS === '1';
  const llave = conPrecio ? LLAVE_CON_PRECIO : LLAVE;
  /** @type {any} */
  let guardado = null;
  if (cache) {
    try {
      const r = await cache.match(llave);
      if (r) guardado = await r.json();
    } catch (e) { /* sin caché: se pide al CRM */ }
  }
  if (guardado && Date.now() - Date.parse(guardado.generado) < FRESCA_MS) return responder(guardado);

  let nuevo = null;
  if (env.PORTAL_CLAVE) {
    const base = (env.CRM_URL || 'https://portal.plasticosespinal.com').replace(/\/+$/, '');
    try {
      const r = await fetch(`${base}/cuenta/api/tienda/catalogo`, {
        headers: {
          'X-Portal-Clave': env.PORTAL_CLAVE,
          'X-Cliente-IP': request.headers.get('CF-Connecting-IP') || '',
          Accept: 'application/json',
        },
        redirect: 'manual',
      });
      const datos = r.ok ? await r.json() : null;
      if (datos && datos.ok && Array.isArray(datos.productos)) nuevo = catalogoPublico(datos, conPrecio);
    } catch (e) { /* CRM apagado o caído: queda la copia guardada, si hay */ }
  }

  if (nuevo && nuevo.productos.length) {
    if (cache) {
      const copia = new Response(JSON.stringify(nuevo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${GUARDAR_S}` } });
      const guardar = cache.put(llave, copia).catch(() => {});
      if (waitUntil) waitUntil(guardar); else await guardar;
    }
    return responder(nuevo);
  }
  if (guardado) return responder(guardado);   /* vieja, pero mejor que nada */
  return responder({ ok: false, error: 'No pudimos traer los productos. Escríbanos por WhatsApp al 318 355 5246.' }, 503);
}
