/* «Romper a propósito»: mete un error pequeño en cada parte crítica y comprueba
   que alguna prueba lo atrapa. Trabaja sobre una COPIA del sitio en una carpeta
   temporal: los archivos reales nunca se tocan.
   Uso: npm run mutaciones            (todas)
        npm run mutaciones -- candado (solo las que contienen esa palabra) */
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { RAIZ } from './lib.mjs';

/** Qué corre cada tipo de prueba (desde la carpeta pruebas/ de la copia).
 * @type {Record<string, [string, string[]]>} */
const COMANDOS = {
  unit: ['node', ['--test', 'unit/*.test.mjs']],
  e2e: ['npx', ['playwright', 'test', '--project=escritorio', '--reporter=dot', '--retries=0']],
  versiones: ['node', ['versiones.mjs', 'HEAD']],
  html: ['npm', ['run', '-s', 'lint:html']],
  css: ['npm', ['run', '-s', 'lint:css']],
  js: ['npm', ['run', '-s', 'lint:js']],
};

/**
 * Cada mutación: parte crítica, archivo, texto a buscar, cómo queda y qué pruebas deberían atraparla.
 * @type {{parte: string, nombre: string, archivo: string, buscar: string | RegExp, poner: string, pruebas: string[]}[]}
 */
const MUTACIONES = [
  /* Canasta y domicilio */
  { parte: 'Domicilio', nombre: 'gratis desde MÁS de $50.000 (borde)', archivo: 'tienda/tienda.js', buscar: 's >= cat.domicilio.gratis_desde', poner: 's > cat.domicilio.gratis_desde', pruebas: ['e2e'] },
  { parte: 'Domicilio', nombre: 'el umbral suma el domicilio', archivo: 'tienda/tienda.js', buscar: 's >= cat.domicilio.gratis_desde', poner: 's + cat.domicilio.tarifa >= cat.domicilio.gratis_desde', pruebas: ['e2e'] },
  { parte: 'Domicilio', nombre: 'la franja de respaldo dice otro umbral', archivo: 'tienda/index.html', buscar: 'id="gratisDesde">$50.000<', poner: 'id="gratisDesde">$60.000<', pruebas: ['unit'] },
  { parte: 'Domicilio', nombre: 'el total no suma el domicilio', archivo: 'tienda/tienda.js', buscar: 't: s + d', poner: 't: s', pruebas: ['e2e'] },
  /* El pedido que llega al CRM */
  { parte: 'Pedido', nombre: 'la cantidad de cada línea no llega', archivo: 'tienda/tienda.js', buscar: 'return { id: Number(id), cantidad: canasta[id] };', poner: 'return { id: Number(id), cantidad: 1 };', pruebas: ['e2e'] },
  { parte: 'Pedido', nombre: 'el pedido manda el precio de la página', archivo: 'tienda/tienda.js', buscar: 'return { id: Number(id), cantidad: canasta[id] };', poner: 'return { id: Number(id), cantidad: canasta[id], precio: por[id].precio };', pruebas: ['e2e'] },
  { parte: 'Pedido', nombre: 'la canasta no se vacía después de pedir', archivo: 'tienda/tienda.js', buscar: 'canasta = {}; guardar();', poner: '', pruebas: ['e2e'] },
  { parte: 'Pedido', nombre: 'el combo agrega solo dos productos', archivo: 'tienda/index.html', buscar: 'data-combo="141,131,191"', poner: 'data-combo="141,131"', pruebas: ['e2e'] },
  { parte: 'Pedido', nombre: 'número de WhatsApp equivocado', archivo: 'tienda/catalogo.json', buscar: '"whatsapp": "573183555246"', poner: '"whatsapp": "573183555245"', pruebas: ['unit'] },
  /* Vitrina */
  { parte: 'Vitrina', nombre: 'búsqueda vuelve a depender de tildes', archivo: 'tienda/buscar.js', buscar: ".replace(/[\\u0300-\\u036f]/g, '')", poner: '', pruebas: ['unit', 'e2e'] },
  { parte: 'Vitrina', nombre: 'nombres pintados como HTML (XSS)', archivo: 'tienda/tienda.js', buscar: 'n.textContent = x', poner: 'n.innerHTML = x', pruebas: ['e2e'] },
  /* tienda/catalogo.json (lo que Johan cambia a mano) */
  { parte: 'Catálogo', nombre: 'radio del GPS entre comillas', archivo: 'tienda/catalogo.json', buscar: '"radio_km": 8', poner: '"radio_km": "8"', pruebas: ['unit'] },
  { parte: 'Catálogo', nombre: 'minutos de alistar entre comillas', archivo: 'tienda/catalogo.json', buscar: '"alistar_min": 60', poner: '"alistar_min": "60"', pruebas: ['unit'] },
  /* Candado */
  { parte: 'Candado', nombre: 'deja pasar cualquier galleta', archivo: 'functions/tienda/_middleware.js', buscar: 'iguales(await sha256(galleta), HUELLA_GALLETA)', poner: 'true', pruebas: ['unit'] },
  { parte: 'Candado', nombre: 'galleta sin HttpOnly', archivo: 'functions/tienda/_middleware.js', buscar: 'Max-Age=${TREINTA_DIAS}; HttpOnly;', poner: 'Max-Age=${TREINTA_DIAS};', pruebas: ['unit'] },
  { parte: 'Candado', nombre: 'toda la carpeta img sin candado', archivo: 'functions/tienda/_middleware.js', buscar: "url.pathname === '/tienda/img/logo-color.svg'", poner: "url.pathname.startsWith('/tienda/img/')", pruebas: ['unit'] },
  { parte: 'Candado', nombre: 'sin pausa contra fuerza bruta', archivo: 'functions/tienda/_middleware.js', buscar: 'setTimeout(listo, 800)', poner: 'setTimeout(listo, 0)', pruebas: ['unit'] },
  { parte: 'Candado', nombre: 'tienda sin noindex', archivo: 'tienda/index.html', buscar: '<meta name="robots" content="noindex, nofollow">', poner: '', pruebas: ['unit'] },
  { parte: 'Candado', nombre: 'enlace a la tienda desde el inicio', archivo: 'index.html', buscar: '<a href="#contacto">', poner: '<a href="/tienda/">Tienda</a><a href="#contacto">', pruebas: ['unit'] },
  /* Portal del cliente (intermediario de Cloudflare) */
  { parte: 'Portal', nombre: 'el token de sesión viaja en el cuerpo', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: "return json({ ok: true, nombre: datos.nombre || '', estado: datos.estado || '' }, 200, sesion(datos));", poner: "return json({ ok: true, nombre: datos.nombre || '', estado: datos.estado || '', token: datos.token }, 200, sesion(datos));", pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'verificar toma el paso que manda la página', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: "if (ruta === 'verificar') datos.pendiente = leerGalleta(request, PENDIENTE);", poner: '', pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'el secreto del pedido sale a cualquier ruta', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: "if (ruta.startsWith('tienda/') && /^", poner: 'if (/^', pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'la foto deja pasar lo que no es imagen', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: "if (!respuesta.ok || !tipo.startsWith('image/'))", poner: 'if (!respuesta.ok)', pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'acepta POST de otro sitio', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: 'if (origen && origen !== new URL(request.url).origin)', poner: 'if (false)', pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'deja pasar cualquier ruta al CRM', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: 'if (!permitida) return', poner: 'if (false) return', pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'sigue redirecciones del CRM', archivo: 'functions/tienda/mi-cuenta/api/[[ruta]].js', buscar: "redirect: 'manual'", poner: "redirect: 'follow'", pruebas: ['unit'] },
  { parte: 'Portal', nombre: 'el JS del navegador llama directo al CRM', archivo: 'tienda/mi-cuenta/cuenta.js', buscar: "var API = '/tienda/mi-cuenta/api/';", poner: "var API = 'https://portal.plasticosespinal.com/cuenta/api/';", pruebas: ['unit', 'e2e'] },
  /* Seguridad y caché */
  { parte: 'CSP', nombre: 'script embebido cambiado sin nueva huella', archivo: 'index.html', buscar: "classList.add('js');", poner: "classList.add('js') ;", pruebas: ['unit', 'e2e'] },
  { parte: 'CSP', nombre: 'se pierde el script que abre arriba', archivo: 'index.html', buscar: / {2}<script>document\.documentElement[^\n]*<\/script>\n/, poner: '', pruebas: ['unit', 'e2e'] },
  { parte: 'CSP', nombre: '_headers y .htaccess distintos', archivo: '_headers', buscar: "object-src 'none'", poner: "object-src 'self'", pruebas: ['unit'] },
  { parte: 'Caché', nombre: 'CSS cambiado sin subir ?v=', archivo: 'css/estilos.css', buscar: /$/, poner: '\n.x{color:red}\n', pruebas: ['versiones'] },
  /* Página pública */
  { parte: 'Inicio', nombre: 'imagen con nombre equivocado', archivo: 'index.html', buscar: 'img/productos/vasos.webp', poner: 'img/productos/vaso.webp', pruebas: ['unit', 'e2e'] },
  { parte: 'Inicio', nombre: '404 con rutas relativas', archivo: '404.html', buscar: 'href="/css/estilos.css', poner: 'href="css/estilos.css', pruebas: ['unit', 'e2e'] },
  { parte: 'Inicio', nombre: 'vuelve el enlace al portal del CRM', archivo: 'index.html', buscar: '<a href="#contacto">', poner: '<a href="https://portal.plasticosespinal.com">Portal</a><a href="#contacto">', pruebas: ['unit'] },
  { parte: 'Inicio', nombre: 'WhatsApp a otro número', archivo: 'index.html', buscar: 'wa.me/573183555246?text=Hola%2C%20quiero%20cotizar%20pitillos', poner: 'wa.me/573183555264?text=Hola%2C%20quiero%20cotizar%20pitillos', pruebas: ['unit', 'e2e'] },
  { parte: 'Inicio', nombre: 'error de JS (variable mal escrita)', archivo: 'js/principal.js', buscar: 'anio.textContent', poner: 'anioo.textContent', pruebas: ['js', 'e2e'] },
  { parte: 'Inicio', nombre: 'HTML mal cerrado', archivo: 'index.html', buscar: '    </section>', poner: '    </div>', pruebas: ['html'] },
  { parte: 'Inicio', nombre: 'CSS roto (llave de más)', archivo: 'css/estilos.css', buscar: '.porque__rejilla { display: grid; gap: 32px; }', poner: '.porque__rejilla { display: grid; gap: 32px; }}', pruebas: ['css'] },
];

const filtro = (process.argv[2] || '').toLowerCase();
const elegidas = MUTACIONES.filter((m) => !filtro || `${m.parte} ${m.nombre}`.toLowerCase().includes(filtro));

/* Copia del sitio (con su .git, para la prueba de versiones) */
const copia = mkdtempSync(join(tmpdir(), 'mutaciones-'));
cpSync(RAIZ, copia, { recursive: true, filter: (o) => !/[/\\](node_modules|test-results|playwright-report)$/.test(o) });
symlinkSync(join(RAIZ, 'pruebas', 'node_modules'), join(copia, 'pruebas', 'node_modules'), 'dir');
const cwd = join(copia, 'pruebas');

/** @param {string} tipo */
function corre(tipo) {
  const [cmd, args] = COMANDOS[tipo];
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, PUERTO: '4174' } });
  return r.status === 0;
}

let escaparon = 0;
const filas = [];
try {
  for (const m of elegidas) {
    const ruta = join(copia, m.archivo);
    const original = readFileSync(ruta, 'utf8');
    const cambiado = original.replace(m.buscar, m.poner);
    if (cambiado === original) { filas.push([m.parte, m.nombre, '⚠ no se pudo aplicar']); escaparon++; continue; }
    writeFileSync(ruta, cambiado);
    try {
      const atrapada = m.pruebas.filter((t) => !corre(t));
      if (atrapada.length) filas.push([m.parte, m.nombre, `✓ atrapada por ${atrapada.join(', ')}`]);
      else { filas.push([m.parte, m.nombre, '✗ NADIE LA ATRAPÓ']); escaparon++; }
    } finally {
      writeFileSync(ruta, original);
    }
    console.log(filas.at(-1)?.join(' · '));
  }
} finally {
  rmSync(copia, { recursive: true, force: true });
}

console.log(`\n${elegidas.length - escaparon} de ${elegidas.length} errores sembrados fueron atrapados.`);
process.exit(escaparon ? 1 : 0);
