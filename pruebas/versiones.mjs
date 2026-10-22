/* Revisa el ?v=N de la caché: si un CSS o JS cambió frente a la rama base,
   todas las páginas que lo piden tienen que subir su número. Si no, Cloudflare
   y los navegadores siguen sirviendo la versión vieja hasta 7 días (_headers).
   Uso: node versiones.mjs [ref-base]   (por omisión origin/main) */
import { execFileSync } from 'node:child_process';
import { RAIZ, paginas, leer } from './lib.mjs';

const base = process.argv[2] || process.env.BASE_REF || 'origin/main';
const git = (/** @type {string[]} */ ...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' });

/** @param {string} ruta */
function enBase(ruta) {
  try { return git('show', `${base}:${ruta}`); } catch { return null; }
}

/* Recursos versionados: lo que las páginas piden con ?v= */
/** @type {Map<string, {pagina: string, v: string}[]>} */
const usos = new Map();
for (const pagina of paginas()) {
  for (const m of leer(pagina).matchAll(/(?:href|src)="\/?((?:[\w-]+\/)*[\w.-]+\.(?:css|js))\?v=(\d+)"/g)) {
    const archivo = pagina.includes('/') && !m[0].includes('="/') ? pagina.replace(/[^/]+$/, '') + m[1] : m[1];
    if (!usos.has(archivo)) usos.set(archivo, []);
    usos.get(archivo)?.push({ pagina, v: m[2] });
  }
}

const errores = [];
for (const [archivo, lista] of usos) {
  const antes = enBase(archivo);
  if (antes === null || antes === leer(archivo)) continue;      /* nuevo o sin cambios */
  for (const { pagina, v } of lista) {
    const paginaAntes = enBase(pagina);
    const vAntes = paginaAntes && (paginaAntes.match(new RegExp(archivo.split('/').pop().replace('.', '\\.') + '\\?v=(\\d+)')) || [])[1];
    if (vAntes && vAntes === v) errores.push(`${archivo} cambió pero ${pagina} sigue pidiendo ?v=${v}: súbalo a ?v=${Number(v) + 1}`);
  }
}

if (errores.length) {
  console.error('✗ Caché sin actualizar:\n  ' + errores.join('\n  '));
  process.exit(1);
}
console.log(`✓ Versiones de caché al día frente a ${base} (${usos.size} recursos revisados)`);
