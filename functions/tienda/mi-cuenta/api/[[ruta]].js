/* Intermediario del portal del cliente (Cloudflare Pages Functions).

   Las páginas de /tienda/mi-cuenta/ le piden datos a /tienda/mi-cuenta/api/*
   y ESTE archivo es el único que habla con el CRM. El navegador del cliente
   nunca ve la dirección del CRM ni su sesión:

   - Le añade al CRM la clave del portal (secreto PORTAL_CLAVE de Cloudflare
     Pages, el mismo valor que PORTAL_CLAVE del .env del CRM) y la IP real
     del cliente, para que el CRM cuente los intentos por persona.
   - La sesión del cliente (token firmado por el CRM) vive en una galleta
     HttpOnly de este sitio: el JavaScript de la página no la puede leer.
     Los pasos de crear cuenta y de cambiar la contraseña (registro u
     olvide -> verificar -> clave) también: cada uno deja su paso firmado en
     la galleta pe_cuenta_p y el siguiente lo toma de ahí.
   - Solo deja pasar las rutas del portal; cualquier otra da 404.

   Variables de Cloudflare Pages:
     PORTAL_CLAVE  (secreto, obligatorio)
     CRM_URL       (opcional; por defecto https://portal.plasticosespinal.com) */

const GALLETA = 'pe_cuenta';
const PENDIENTE = 'pe_cuenta_p';
const RUTA_GALLETA = '/tienda';
const NO_RESPONDE = 'No pudimos traer sus datos. Intente más tarde o escríbanos por WhatsApp al 318 355 5246.';

/* ruta del navegador -> [método, ruta en el CRM] */
const RUTAS = [
  [/^entrar$/, 'POST'],
  [/^registro$/, 'POST'],
  [/^olvide$/, 'POST'],
  [/^verificar$/, 'POST'],
  [/^clave$/, 'POST'],
  [/^salir$/, 'POST'],
  [/^yo$/, 'GET'],
  [/^pedidos$/, 'GET'],
  [/^pedidos\/\d{1,9}$/, 'GET'],
  [/^pedidos\/\d{1,9}\/recibo\.pdf$/, 'GET'],
  [/^datos$/, 'POST'],
];

function leerGalleta(request, nombre) {
  const todas = request.headers.get('Cookie') || '';
  for (const parte of todas.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return resto.join('=');
  }
  return '';
}

function galleta(nombre, valor, segundos) {
  return `${nombre}=${valor}; Path=${RUTA_GALLETA}; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
}

function json(datos, estado = 200, galletas = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  for (const g of galletas) headers.append('Set-Cookie', g);
  return new Response(JSON.stringify(datos), { status: estado, headers });
}

async function leerJson(request) {
  try {
    const datos = await request.json();
    return datos && typeof datos === 'object' ? datos : {};
  } catch (e) {
    return {};
  }
}

export async function onRequest({ request, env, params }) {
  const ruta = [].concat(params.ruta || []).join('/');
  const permitida = RUTAS.find(([patron, metodo]) => patron.test(ruta) && metodo === request.method);
  if (!permitida) return json({ ok: false, error: 'No existe.' }, 404);

  /* Un POST solo vale si sale de una página de este mismo sitio */
  if (request.method === 'POST') {
    const origen = request.headers.get('Origin');
    if (origen && origen !== new URL(request.url).origin) {
      return json({ ok: false, error: 'No permitido.' }, 403);
    }
  }

  if (ruta === 'salir') {
    return json({ ok: true }, 200, [galleta(GALLETA, '', 0), galleta(PENDIENTE, '', 0)]);
  }

  if (!env.PORTAL_CLAVE) return json({ ok: false, error: NO_RESPONDE }, 503);
  const base = (env.CRM_URL || 'https://portal.plasticosespinal.com').replace(/\/+$/, '');

  const cabeceras = {
    'X-Portal-Clave': env.PORTAL_CLAVE,
    'X-Cliente-IP': request.headers.get('CF-Connecting-IP') || '',
    Accept: 'application/json, application/pdf',
  };
  const token = leerGalleta(request, GALLETA);
  if (token) cabeceras['X-Cuenta-Token'] = token;

  let cuerpo;
  if (request.method === 'POST') {
    const datos = await leerJson(request);
    if (ruta === 'verificar') datos.pendiente = leerGalleta(request, PENDIENTE);
    if (ruta === 'clave') datos.verificado = leerGalleta(request, PENDIENTE);
    cuerpo = JSON.stringify(datos);
    cabeceras['Content-Type'] = 'application/json';
  }

  let respuesta;
  try {
    respuesta = await fetch(`${base}/cuenta/api/${ruta}`, {
      method: request.method, headers: cabeceras, body: cuerpo, redirect: 'manual',
    });
  } catch (e) {
    return json({ ok: false, error: NO_RESPONDE }, 502);
  }

  /* El recibo pasa tal cual (PDF) */
  if (ruta.endsWith('recibo.pdf') && respuesta.ok) {
    return new Response(respuesta.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': respuesta.headers.get('Content-Disposition') || 'inline',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch (e) {
    /* CRM sin la clave (404 en HTML), caído o detrás de otra página */
    return json({ ok: false, error: NO_RESPONDE }, 502);
  }

  if (respuesta.status === 401) {
    return json(datos, 401, [galleta(GALLETA, '', 0)]);
  }
  const sesion = (d) => [
    galleta(GALLETA, d.token || '', (Number(d.dias) || 30) * 86400),
    galleta(PENDIENTE, '', 0),
  ];
  if ((ruta === 'entrar' || ruta === 'clave') && respuesta.ok) {
    return json({ ok: true, nombre: datos.nombre || '', estado: datos.estado || '' }, 200, sesion(datos));
  }
  if ((ruta === 'registro' || ruta === 'olvide') && respuesta.ok) {
    /* El paso queda en galleta; la página solo ve cómo confirmar el WhatsApp */
    const { pendiente, ...resto } = datos;
    return json(resto, 200, [galleta(PENDIENTE, pendiente || '', 15 * 60)]);
  }
  if (ruta === 'verificar' && respuesta.ok) {
    if (!datos.listo) return json({ ok: true, listo: false });
    return json({ ok: true, listo: true }, 200, [galleta(PENDIENTE, datos.verificado || '', 15 * 60)]);
  }
  return json(datos, respuesta.status);
}
