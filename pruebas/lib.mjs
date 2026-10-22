/* Utilidades compartidas por las pruebas: rutas del sitio y lectura de archivos. */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/** Carpeta raíz del sitio (lo que publica Cloudflare Pages). */
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/** El único WhatsApp del negocio, en formato internacional sin «+». */
export const WHATSAPP = '573183555246';

/** Reglas del domicilio de la tienda (decisión de Johan, 2026-10-07). */
export const DOMICILIO = { tarifa: 4000, gratis_desde: 60000 };

/** @param {string} ruta ruta relativa a la raíz del sitio */
export function leer(ruta) { return readFileSync(join(RAIZ, ruta), 'utf8'); }

/** @param {string} ruta */
export function existe(ruta) { return existsSync(join(RAIZ, ruta)); }

/** Páginas HTML que se publican (sin node_modules ni reportes de pruebas). */
export function paginas() {
  /** @type {string[]} */
  const fuera = [];
  /** @param {string} dir */
  const recorrer = (dir) => {
    for (const nombre of readdirSync(join(RAIZ, dir))) {
      if (nombre.startsWith('.') || ['node_modules', 'pruebas', 'functions'].includes(nombre)) continue;
      const rel = dir ? `${dir}/${nombre}` : nombre;
      if (statSync(join(RAIZ, rel)).isDirectory()) recorrer(rel);
      else if (nombre.endsWith('.html')) fuera.push(rel);
    }
  };
  recorrer('');
  return fuera.sort();
}

/**
 * Dirección pública de una página: index.html -> "/", tienda/index.html -> "/tienda/".
 * @param {string} rel
 */
export function urlDe(rel) {
  return '/' + rel.replace(/(^|\/)index\.html$/, '$1');
}

/**
 * Lleva una ruta pública (/css/x.css?v=3) al archivo que la sirve, o null si no existe.
 * @param {string} ruta
 */
export function archivoDe(ruta) {
  let limpia = decodeURIComponent(ruta.split(/[?#]/)[0]);
  if (limpia.endsWith('/')) limpia += 'index.html';
  const rel = limpia.replace(/^\//, '');
  if (existe(rel) && statSync(join(RAIZ, rel)).isFile()) return rel;
  if (existe(rel + '/index.html')) return rel + '/index.html';
  return null;
}

/**
 * Resuelve un href/src de una página a ruta pública absoluta.
 * @param {string} valor
 * @param {string} base dirección pública de la página
 */
export function resolver(valor, base) {
  return posix.normalize(new URL(valor, 'https://x' + base).pathname);
}

/** ¿Es una referencia a algo del propio sitio? */
export function esLocal(/** @type {string} */ v) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(v) && v.trim() !== '';
}

/**
 * Todos los valores de href= y src= de un HTML.
 * @param {string} html
 */
export function referencias(html) {
  const fuera = [];
  const re = /\s(href|src|srcset|content)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === 'content') continue;
    if (m[1] === 'srcset') fuera.push(...m[2].split(',').map((s) => s.trim().split(/\s+/)[0]));
    else fuera.push(m[2]);
  }
  return fuera;
}

/**
 * Scripts embebidos ejecutables (sin src y que no son datos JSON-LD).
 * @param {string} html
 */
export function scriptsEmbebidos(html) {
  const fuera = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\ssrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*"application\/(ld\+)?json"/.test(attrs)) continue;
    fuera.push(m[2]);
  }
  return fuera;
}

/** Huella CSP de un script embebido: 'sha256-…' */
export function huellaCsp(/** @type {string} */ codigo) {
  return `'sha256-${createHash('sha256').update(codigo, 'utf8').digest('base64')}'`;
}

/**
 * Directivas de una política CSP como mapa directiva -> valores.
 * @param {string} csp
 */
export function directivas(csp) {
  /** @type {Record<string, string>} */
  const d = {};
  for (const parte of csp.split(';')) {
    const [nombre, ...valores] = parte.trim().split(/\s+/);
    if (nombre) d[nombre] = valores.join(' ');
  }
  return d;
}

/** CSP de la meta etiqueta de una página, o null. */
export function cspMeta(/** @type {string} */ html) {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  return m ? m[1] : null;
}

/**
 * Lee _headers (sintaxis de Cloudflare Pages) como lista de { patron, cabeceras }.
 * @param {string} [texto]
 */
export function leerHeaders(texto = leer('_headers')) {
  /** @type {{patron: string, cabeceras: Record<string, string>}[]} */
  const reglas = [];
  for (const linea of texto.split('\n')) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) { reglas.push({ patron: linea.trim(), cabeceras: {} }); continue; }
    const i = linea.indexOf(':');
    reglas[reglas.length - 1].cabeceras[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return reglas;
}

/**
 * Cabeceras que Cloudflare Pages aplicaría a una ruta.
 * @param {string} ruta
 * @param {ReturnType<typeof leerHeaders>} [reglas]
 */
export function cabecerasPara(ruta, reglas = leerHeaders()) {
  /** @type {Record<string, string>} */
  const fuera = {};
  for (const { patron, cabeceras } of reglas) {
    const re = new RegExp('^' + patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (re.test(ruta)) Object.assign(fuera, cabeceras);
  }
  return fuera;
}

export { relative };
