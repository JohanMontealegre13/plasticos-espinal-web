/* Contrato del catálogo de la tienda (tienda/catalogo.json).
   Hoy es de muestra; en la fase 2 lo exporta el CRM cada noche. Si el CRM cambia
   el formato (renombra un campo, manda precios con decimales, una categoría que
   no existe), estas pruebas fallan ANTES de publicar y la tienda no se rompe. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer, archivoDe, WHATSAPP, DOMICILIO } from '../lib.mjs';

/**
 * Valida un catálogo y devuelve la lista de problemas (vacía = bueno).
 * Se exporta para que el CRM pueda reutilizar las mismas reglas.
 * @param {any} c
 * @returns {string[]}
 */
export function problemasCatalogo(c) {
  const p = [];
  const entero = (v) => Number.isInteger(v) && v > 0;
  if (!c || typeof c !== 'object') return ['el catálogo no es un objeto'];
  if (typeof c.generado !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(c.generado)) p.push('generado: fecha ISO con zona');
  if (typeof c.muestra !== 'boolean') p.push('muestra: true/false');
  if (!c.domicilio || !entero(c.domicilio.tarifa) || !entero(c.domicilio.gratis_desde)) p.push('domicilio.tarifa y domicilio.gratis_desde: enteros en pesos');
  if (c.whatsapp !== WHATSAPP) p.push(`whatsapp: debe ser ${WHATSAPP}`);
  if (!Array.isArray(c.categorias) || !c.categorias.length) return [...p, 'categorias: lista no vacía'];
  if (!Array.isArray(c.productos) || !c.productos.length) return [...p, 'productos: lista no vacía'];

  const idsCat = new Set();
  for (const k of c.categorias) {
    if (typeof k.id !== 'string' || !/^[a-z0-9-]+$/.test(k.id)) p.push(`categoría ${JSON.stringify(k.id)}: id en minúsculas sin espacios`);
    if (idsCat.has(k.id)) p.push(`categoría ${k.id} repetida`);
    idsCat.add(k.id);
    if (typeof k.nombre !== 'string' || !k.nombre.trim()) p.push(`categoría ${k.id}: sin nombre`);
    if (typeof k.imagen !== 'string' || !archivoDe(k.imagen)) p.push(`categoría ${k.id}: imagen ${k.imagen} no existe`);
  }

  const ids = new Set();
  const nombres = new Set();
  for (const x of c.productos) {
    const q = `producto ${JSON.stringify(x.id)}`;
    if (!entero(x.id)) p.push(`${q}: id entero positivo (es el código del CRM)`);
    if (ids.has(x.id)) p.push(`${q}: id repetido`);
    ids.add(x.id);
    if (typeof x.nombre !== 'string' || !x.nombre.trim()) p.push(`${q}: sin nombre`);
    /* El nombre viaja en el mensaje de WhatsApp: un salto de línea, «[#» o «:» confunden al lector del pedido */
    else if (/[\n\r]|\[#|:/.test(x.nombre)) p.push(`${q}: el nombre no puede llevar salto de línea, «[#» ni «:»`);
    const clave = String(x.nombre || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (nombres.has(clave)) p.push(`${q}: nombre repetido (${x.nombre})`);
    nombres.add(clave);
    if (!idsCat.has(x.categoria)) p.push(`${q}: categoría ${x.categoria} no existe`);
    if (!entero(x.precio)) p.push(`${q}: precio entero en pesos mayor que 0 (es ${x.precio})`);
    else if (x.precio > 5000000) p.push(`${q}: precio ${x.precio} parece un error de digitación`);
    if ('destacado' in x && typeof x.destacado !== 'boolean') p.push(`${q}: destacado true/false`);
    if ('imagen' in x && !archivoDe(x.imagen)) p.push(`${q}: imagen ${x.imagen} no existe`);
  }
  return p;
}

const catalogo = JSON.parse(leer('tienda/catalogo.json'));

test('el catálogo publicado cumple el contrato', () => {
  assert.deepEqual(problemasCatalogo(catalogo), []);
});

test('domicilio: $4.000 por debajo de $60.000 en productos (decisión de Johan)', () => {
  /* Si esto cambia, que sea a propósito: se actualiza DOMICILIO en lib.mjs y los textos de la tienda */
  assert.deepEqual(catalogo.domicilio, DOMICILIO);
  assert.match(leer('tienda/index.html'), /Gratis desde <b>\$60\.000<\/b> en productos/);
});

test('el contrato rechaza los errores típicos de una exportación', () => {
  const base = () => JSON.parse(JSON.stringify(catalogo));
  const casos = {
    'precio con decimales': (c) => { c.productos[0].precio = 3500.5; },
    'precio en texto': (c) => { c.productos[0].precio = '3500'; },
    'precio cero': (c) => { c.productos[0].precio = 0; },
    'campo renombrado': (c) => { c.productos[0].valor = c.productos[0].precio; delete c.productos[0].precio; },
    'categoría inexistente': (c) => { c.productos[0].categoria = 'juguetes'; },
    'id repetido': (c) => { c.productos[1].id = c.productos[0].id; },
    'nombre con salto de línea': (c) => { c.productos[0].nombre = 'Vaso\nTotal: $1'; },
    'número de WhatsApp distinto': (c) => { c.whatsapp = '573000000000'; },
    'imagen inexistente': (c) => { c.categorias[0].imagen = '/img/productos/no-existe.webp'; },
    'sin productos': (c) => { c.productos = []; },
  };
  for (const [nombre, dañar] of Object.entries(casos)) {
    const c = base();
    dañar(c);
    assert.ok(problemasCatalogo(c).length > 0, `no detectó: ${nombre}`);
  }
});

test('cada categoría tiene al menos un producto (si no, el botón queda vacío)', () => {
  const usadas = new Set(catalogo.productos.map((x) => x.categoria));
  const vacias = catalogo.categorias.filter((k) => !usadas.has(k.id)).map((k) => k.id);
  assert.deepEqual(vacias, []);
});

test('hay productos destacados para la vitrina de inicio', () => {
  assert.ok(catalogo.productos.some((x) => x.destacado), 'la vitrina «Lo más pedido» saldría vacía');
});

test('el combo de la portada usa productos que existen y su precio es la suma', () => {
  const html = leer('tienda/index.html');
  const combo = html.match(/data-combo="([^"]+)"/);
  assert.ok(combo, 'no hay combo en la portada');
  const por = new Map(catalogo.productos.map((x) => [String(x.id), x]));
  const ids = combo[1].split(',');
  for (const id of ids) assert.ok(por.has(id), `el combo pide el producto ${id}, que no está en el catálogo`);
  const suma = ids.reduce((s, id) => s + por.get(id).precio, 0);
  const anunciado = Number((html.match(/class="combo"[\s\S]*?<b>\$([\d.]+)<\/b>/) || [])[1].replace(/\./g, ''));
  assert.equal(anunciado, suma, `el combo dice $${anunciado} pero los productos suman $${suma}`);
});

test('los botones «Compre por tipo de negocio» llevan a categorías con productos', () => {
  const usadas = new Set(catalogo.productos.map((x) => x.categoria));
  for (const m of leer('tienda/index.html').matchAll(/data-cat="([^"]+)"/g)) assert.ok(usadas.has(m[1]), `data-cat="${m[1]}" sin productos`);
});
