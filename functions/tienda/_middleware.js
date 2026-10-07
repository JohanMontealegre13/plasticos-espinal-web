/* Candado de la tienda en línea mientras está en pruebas (Cloudflare Pages Functions).
   Todo lo que cuelga de /tienda pide la contraseña de prueba antes de servirse.
   La contraseña NO está escrita aquí: solo su huella SHA-256 con sal. Al entrar
   queda una galleta HttpOnly de 30 días; /tienda/salir la borra.
   Para cambiar la contraseña, recalcular las dos huellas:
     CLAVE   = sha256(SAL + "|clave|" + contraseña)
     GALLETA = sha256(sha256(SAL + "|galleta|" + contraseña))
   Cuando la tienda salga al público, se borra esta carpeta functions/tienda. */

const SAL = 'pe-tienda-2026';
const HUELLA_CLAVE = '56fd20b17c5e2b4b9fe6d9918e817656a00035d32c66fe6f61150d3b53d66b5c';
const HUELLA_GALLETA = '6833740cb8d8d221685d1283cfd7cd29a5984a1bde2c55bc6ce88e9626b78905';
const GALLETA = 'pe_tienda';
const TREINTA_DIAS = 60 * 60 * 24 * 30;

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

function leerGalleta(request) {
  const todas = request.headers.get('Cookie') || '';
  for (const parte of todas.split(';')) {
    const [nombre, ...resto] = parte.trim().split('=');
    if (nombre === GALLETA) return resto.join('=');
  }
  return '';
}

function privada(respuesta) {
  const r = new Response(respuesta.body, respuesta);
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  r.headers.set('Cache-Control', 'private, no-store');
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
  <img src="/tienda/img/logo-color.svg" alt="Plásticos Espinal">
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

function irA(destino, galleta) {
  const headers = { Location: destino, 'Cache-Control': 'no-store' };
  if (galleta) headers['Set-Cookie'] = galleta;
  return new Response(null, { status: 303, headers });
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  /* El logo de la pantalla de la contraseña se sirve sin candado */
  if (url.pathname === '/tienda/img/logo-color.svg') return next();

  if (url.pathname === '/tienda/salir') {
    return irA('/tienda/', `${GALLETA}=; Path=/tienda; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }

  if (url.pathname === '/tienda/entrar') {
    if (request.method !== 'POST') return irA('/tienda/');
    let clave = '';
    try {
      const datos = await request.formData();
      clave = String(datos.get('clave') || '').trim();
    } catch (e) { /* formulario dañado: cuenta como contraseña equivocada */ }
    if (iguales(await sha256(`${SAL}|clave|${clave}`), HUELLA_CLAVE)) {
      const valor = await sha256(`${SAL}|galleta|${clave}`);
      return irA('/tienda/', `${GALLETA}=${valor}; Path=/tienda; Max-Age=${TREINTA_DIAS}; HttpOnly; Secure; SameSite=Lax`);
    }
    /* Pausa corta para que adivinar a la fuerza sea lento */
    await new Promise((listo) => setTimeout(listo, 800));
    return pantallaClave(true, 401);
  }

  const galleta = leerGalleta(request);
  if (galleta && iguales(await sha256(galleta), HUELLA_GALLETA)) {
    return privada(await next());
  }
  return pantallaClave(false, 401);
}
