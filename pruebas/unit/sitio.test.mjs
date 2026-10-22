/* Pruebas estáticas del sitio: lo que se rompe sin que nadie lo note al editar el HTML.
   Cada prueba dice qué protege; las marcadas «Regresión» cubren un error que ya pasó. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RAIZ, WHATSAPP, leer, existe, paginas, urlDe, archivoDe, resolver, esLocal, referencias,
  scriptsEmbebidos, huellaCsp, directivas, cspMeta, leerHeaders, cabecerasPara,
} from '../lib.mjs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUBLICAS = ['index.html', '404.html'];   /* las que sí se anuncian al público */

test('todas las páginas esperadas existen', () => {
  for (const p of ['index.html', '404.html', 'tienda/index.html']) assert.ok(existe(p), `falta ${p}`);
  assert.ok(paginas().length >= 3);
});

test('enlaces y recursos locales apuntan a archivos que existen (HTML)', () => {
  const rotos = [];
  for (const pagina of paginas()) {
    const html = leer(pagina);
    for (const ref of referencias(html).filter(esLocal)) {
      /* 404.html se sirve en cualquier dirección: se resuelve desde una subcarpeta cualquiera */
      const base = pagina === '404.html' ? '/una/carpeta/que-no-existe' : urlDe(pagina);
      const ruta = resolver(ref, base);
      if (ruta.startsWith('/tienda/salir') || ruta.startsWith('/tienda/entrar')) continue; /* las atiende el candado */
      if (!archivoDe(ruta)) rotos.push(`${pagina}: ${ref}`);
    }
  }
  assert.deepEqual(rotos, []);
});

test('enlaces internos #ancla llevan a un id que existe en la página', () => {
  const rotos = [];
  for (const pagina of paginas()) {
    const html = leer(pagina);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of html.matchAll(/\s(?:href)="#([^"]+)"/g)) if (!ids.has(m[1])) rotos.push(`${pagina}: #${m[1]}`);
  }
  assert.deepEqual(rotos, []);
});

test('url() de las hojas de estilo apuntan a archivos que existen', () => {
  const rotos = [];
  for (const css of ['css/estilos.css', 'tienda/tienda.css']) {
    const base = '/' + css;
    for (const m of leer(css).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (!esLocal(m[1]) || m[1].startsWith('data:')) continue;
      if (!archivoDe(resolver(m[1], base))) rotos.push(`${css}: ${m[1]}`);
    }
  }
  assert.deepEqual(rotos, []);
});

test('los íconos del manifiesto existen', () => {
  const manifiesto = JSON.parse(leer('site.webmanifest'));
  for (const i of manifiesto.icons) assert.ok(archivoDe(resolver(i.src, '/')), `falta ${i.src}`);
});

test('todos los JSON del repositorio son válidos', () => {
  const archivos = ['site.webmanifest', 'tienda/catalogo.json', 'skills-lock.json'];
  for (const a of archivos) assert.doesNotThrow(() => JSON.parse(leer(a)), a);
  /* Los datos estructurados de Google (JSON-LD) dentro del HTML también */
  for (const pagina of paginas()) {
    for (const m of leer(pagina).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(m[1]), `JSON-LD de ${pagina}`);
    }
  }
});

test('sitemap y robots apuntan al dominio real y son XML válido', () => {
  const sitemap = leer('sitemap.xml');
  assert.match(sitemap, /^<\?xml/);
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0);
  for (const l of locs) assert.match(l, /^https:\/\/www\.plasticosespinal\.com\//);
  assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length);
  assert.match(leer('robots.txt'), /Sitemap: https:\/\/www\.plasticosespinal\.com\/sitemap\.xml/);
});

/* ---------------- Seguridad: CSP ---------------- */

test('Regresión (e7352f9): cada script embebido tiene su huella en la CSP de la página, de _headers y de .htaccess', () => {
  const cspHeaders = cabecerasPara('/index.html')['Content-Security-Policy'];
  const cspApache = (leer('.htaccess').match(/Content-Security-Policy "([^"]+)"/) || [])[1];
  for (const pagina of PUBLICAS) {
    const html = leer(pagina);
    const meta = cspMeta(html);
    for (const codigo of scriptsEmbebidos(html)) {
      const h = huellaCsp(codigo);
      assert.ok(meta && meta.includes(h), `${pagina}: la <meta> CSP no trae ${h}; el navegador bloquearía el script`);
      assert.ok(cspHeaders.includes(h), `_headers no trae ${h}: en producción el script quedaría bloqueado`);
      assert.ok(cspApache.includes(h), `.htaccess no trae ${h}`);
    }
  }
});

test('Regresión (e7352f9, se perdió en c86743b): el inicio trae el script que abre arriba aunque haya #ancla', () => {
  const scripts = scriptsEmbebidos(leer('index.html'));
  assert.ok(scripts.some((s) => /scrollRestoration\s*=\s*'manual'/.test(s) && /replaceState/.test(s)),
    'falta el script embebido que ignora el #ancla al recargar');
});

test('la CSP no guarda huellas de scripts que ya no existen (o de algo que nadie revisó)', () => {
  const vigentes = new Set(PUBLICAS.flatMap((p) => scriptsEmbebidos(leer(p)).map(huellaCsp)));
  const declaradas = cabecerasPara('/')['Content-Security-Policy'].match(/'sha256-[^']+'/g) || [];
  for (const h of declaradas) assert.ok(vigentes.has(h), `_headers permite ${h}, que no corresponde a ningún script del sitio`);
});

test('la CSP de _headers y la de .htaccess son la misma', () => {
  const cspHeaders = cabecerasPara('/index.html')['Content-Security-Policy'];
  const cspApache = (leer('.htaccess').match(/Content-Security-Policy "([^"]+)"/) || [])[1];
  assert.equal(cspApache, cspHeaders);
});

test('Regresión (3a46a34): la <meta> CSP coincide con _headers (menos lo que una meta no puede llevar)', () => {
  const real = directivas(cabecerasPara('/index.html')['Content-Security-Policy']);
  delete real['frame-ancestors'];  /* una <meta> no puede aplicarla */
  for (const pagina of PUBLICAS) {
    assert.deepEqual(directivas(cspMeta(leer(pagina)) || ''), real, pagina);
  }
});

test('ninguna página trae style="" ni onclick="": la CSP (style-src/script-src self) los bloquearía', () => {
  for (const pagina of paginas()) {
    const html = leer(pagina);
    assert.doesNotMatch(html, /\sstyle\s*=\s*"/, `${pagina} tiene style=""`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*"/, `${pagina} tiene un manejador on…=""`);
  }
});

test('_headers trae las cabeceras de seguridad para todo el sitio', () => {
  const c = cabecerasPara('/');
  for (const k of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
    'Strict-Transport-Security', 'Permissions-Policy']) assert.ok(c[k], `falta ${k}`);
  const csp = directivas(c['Content-Security-Policy']);
  assert.equal(csp['object-src'], "'none'");
  assert.doesNotMatch(csp['script-src'], /unsafe-inline|unsafe-eval/);
});

test('las rutas con caché larga en _headers existen', () => {
  for (const { patron } of leerHeaders()) {
    if (patron === '/*') continue;
    const carpeta = patron.replace(/^\//, '').replace(/\/\*$/, '');
    assert.ok(existe(carpeta), `_headers cachea ${patron} pero esa carpeta no existe`);
  }
});

/* ---------------- Caché: ?v=N ---------------- */

test('index.html y 404.html piden la misma versión de la hoja de estilos', () => {
  const v = (p) => (leer(p).match(/css\/estilos\.css\?v=(\d+)/) || [])[1];
  assert.ok(v('index.html'), 'index.html no versiona estilos.css');
  assert.equal(v('404.html'), v('index.html'));
});

test('CSS y JS del sitio se piden siempre con ?v= (si no, la caché de 7 días esconde los cambios)', () => {
  for (const pagina of paginas()) {
    for (const m of leer(pagina).matchAll(/(?:href|src)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)) {
      if (!esLocal(m[1])) continue;
      assert.match(m[1], /\?v=\d+$/, `${pagina}: ${m[1]} sin ?v=N`);
    }
  }
});

/* ---------------- Regresiones de contenido ---------------- */

test('Regresión (5275792): 404.html usa rutas desde la raíz (se sirve en cualquier subcarpeta)', () => {
  const relativas = referencias(leer('404.html')).filter(esLocal).filter((r) => !r.startsWith('/'));
  assert.deepEqual(relativas, []);
});

test('Regresión (8aa83d6): el sitio público no enlaza al portal del CRM', () => {
  for (const p of [...PUBLICAS, 'sitemap.xml']) {
    assert.doesNotMatch(leer(p), /portal\.plasticosespinal\.com/i, p);
  }
  /* La tienda solo puede llevar a «Mi cuenta» del cliente, nunca al ingreso del CRM */
  for (const p of paginas().filter((x) => x.startsWith('tienda/'))) {
    for (const m of leer(p).matchAll(/https?:\/\/portal\.plasticosespinal\.com[^"']*/gi)) {
      assert.match(m[0], /^https:\/\/portal\.plasticosespinal\.com\/cuenta\//, `${p}: ${m[0]}`);
    }
  }
});

test('Regresión (bd6b77c): los botones dicen «Pida», no «Encargue»', () => {
  for (const p of paginas()) assert.doesNotMatch(leer(p), /encargue/i, p);
});

test('Regresión (d9a07ee): la tienda en pruebas sigue escondida (sin enlaces desde lo público)', () => {
  for (const p of [...PUBLICAS, 'sitemap.xml', 'robots.txt', 'site.webmanifest']) {
    assert.doesNotMatch(leer(p), /\/tienda|tienda\.html|tienda\//i, `${p} enlaza a la tienda escondida`);
  }
  assert.match(leer('tienda/index.html'), /<meta name="robots" content="noindex, nofollow">/);
});

test('la tienda tiene candado: el middleware existe y exporta onRequest', () => {
  /* Cuando la tienda salga al público se borra functions/tienda y esta prueba, a propósito */
  assert.ok(existe('functions/tienda/_middleware.js'));
  assert.match(leer('functions/tienda/_middleware.js'), /export async function onRequest/);
});

test('todos los enlaces de WhatsApp y teléfono van al número del negocio', () => {
  for (const p of paginas()) {
    const html = leer(p);
    for (const m of html.matchAll(/https:\/\/wa\.me\/(\d+)/g)) assert.equal(m[1], WHATSAPP, `${p}: wa.me/${m[1]}`);
    for (const m of html.matchAll(/href="tel:([^"]+)"/g)) assert.equal(m[1], '+' + WHATSAPP, `${p}: tel:${m[1]}`);
  }
  assert.equal(JSON.parse(leer('tienda/catalogo.json')).whatsapp, WHATSAPP);
});

test('los enlaces que abren otra pestaña llevan rel="noopener"', () => {
  for (const p of paginas()) {
    for (const m of leer(p).matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="[^"]*noopener/, `${p}: ${m[0]}`);
  }
});

test('los mensajes prellenados de WhatsApp están bien codificados', () => {
  for (const p of paginas()) {
    for (const m of leer(p).matchAll(/https:\/\/wa\.me\/\d+\?text=([^"]+)"/g)) {
      assert.doesNotThrow(() => decodeURIComponent(m[1]), `${p}: ${m[1]}`);
      assert.doesNotMatch(m[1], /[ \n]/, `${p}: espacio sin codificar en ${m[1]}`);
    }
  }
});

test('en la tienda no se habla de IVA: se dice «valor del pedido»', () => {
  for (const p of ['tienda/index.html', 'tienda/tienda.js']) {
    assert.doesNotMatch(leer(p), /\bIVA\b|con iva|sin iva/i, p);
  }
});

test('Regresión (3869274): no reaparece la promesa de envío gratis «sobre $50.000» del bot', () => {
  for (const p of paginas()) assert.doesNotMatch(leer(p), /env[ií]os? gratis en pedidos sobre/i, p);
});

test('el umbral de domicilio gratis es el mismo en el inicio y en la tienda ($60.000, Johan 2026-10-08)', () => {
  const tienda = JSON.parse(leer('tienda/catalogo.json')).domicilio.gratis_desde;
  const inicio = leer('index.html');
  const valor = '$' + tienda.toLocaleString('es-CO');
  assert.ok(inicio.includes(valor), `el inicio no dice ${valor}`);
  /* Ningún otro monto de «gratis desde» en el inicio (ni en el JSON-LD para Google) */
  for (const m of inicio.matchAll(/gratis[^.<]*?desde \$([\d.]+)|desde \$([\d.]+)[^.<]*?(?:casco urbano|Chicoral)/g)) {
    assert.equal('$' + (m[1] || m[2]), valor, `el inicio promete domicilio gratis desde $${m[1] || m[2]}`);
  }
});

test('los domicilios solo se prometen en El Espinal (Johan 2026-10-08: a Chicoral no)', () => {
  for (const p of paginas()) {
    assert.doesNotMatch(leer(p), /chicoral/i, `${p} promete domicilio fuera de El Espinal`);
  }
});

test('el repositorio no publica secretos ni contraseñas en claro', () => {
  const sospechosos = [];
  /** @param {string} dir */
  const recorrer = (dir) => {
    for (const n of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      if (['.git', 'node_modules', 'test-results', 'playwright-report'].includes(n.name)) continue;
      const rel = dir ? `${dir}/${n.name}` : n.name;
      if (n.isDirectory()) { recorrer(rel); continue; }
      if (!/\.(html|js|mjs|json|md|txt|css|toml|yml|yaml)$|^_headers$|^\.env/.test(n.name)) continue;
      if (rel === 'pruebas/package-lock.json') continue;
      const texto = leer(rel);
      if (/(api[_-]?key|secret|token|password|contrase[ñn]a)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(texto)) sospechosos.push(rel);
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(texto)) sospechosos.push(rel);
    }
  };
  recorrer('');
  assert.deepEqual(sospechosos, []);
  assert.ok(!existe('.env'), 'hay un .env en el repositorio');
});
