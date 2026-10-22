/* Quién vende (tienda/vendedor.js) y los términos de la tienda (tienda/terminos/): la línea del pie,
   cómo se pintan los datos del vendedor en la página y que el texto legal tenga lo que pide la ley. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE, leer } from '../lib.mjs';

const { lineaVendedor, pintarVendedor } = cargarPE(['tienda/vendedor.js']);

const COMPLETO = {
  nombre: 'Ana Pérez', documento: 'NIT 900.000.000-1', direccion: 'Calle 7 #5-35', telefono: '318 355 5246', correo: 'hola@ejemplo.co',
};

/* ---------- lineaVendedor ---------- */
test('línea del vendedor salta lo vacío', () => {
  assert.equal(
    lineaVendedor({ nombre: 'Ana Pérez', documento: 'NIT 123', direccion: 'Calle 7', telefono: '', correo: '' }),
    'Vende: Ana Pérez · NIT 123 · Calle 7');
});
test('sin nombre no hay línea', () => assert.equal(lineaVendedor({ nombre: '', documento: 'NIT 1' }), ''));
test('con los cinco datos van en este orden', () => {
  assert.equal(lineaVendedor(COMPLETO), 'Vende: Ana Pérez · NIT 900.000.000-1 · Calle 7 #5-35 · 318 355 5246 · hola@ejemplo.co');
});
test('solo el nombre basta', () => assert.equal(lineaVendedor({ nombre: 'Ana Pérez' }), 'Vende: Ana Pérez'));
test('los campos que faltan se saltan, no salen como «undefined»', () => {
  assert.equal(lineaVendedor({ nombre: 'Ana', correo: 'a@b.co' }), 'Vende: Ana · a@b.co');
});
test('los espacios sobrantes se limpian y un campo en blanco cuenta como vacío', () => {
  assert.equal(lineaVendedor({ nombre: '  Ana  ', documento: '   ', direccion: ' Calle 7 ' }), 'Vende: Ana · Calle 7');
  assert.equal(lineaVendedor({ nombre: '   ', documento: 'NIT 1' }), '');
});
test('lo que no es texto no se pinta', () => {
  assert.equal(lineaVendedor({ nombre: 'Ana', documento: 123, direccion: null, telefono: { x: 1 } }), 'Vende: Ana');
  assert.equal(lineaVendedor({ nombre: 42 }), '');
});
test('sin vendedor no hay línea ni error', () => {
  assert.equal(lineaVendedor(undefined), '');
  assert.equal(lineaVendedor(null), '');
  assert.equal(lineaVendedor('Ana'), '');
});

/* ---------- pintarVendedor (con un documento de mentira: nodos con textContent, hidden y getAttribute) ---------- */
function nodo(atributos = {}) {
  return { textContent: '', hidden: true, getAttribute: (n) => (n in atributos ? atributos[n] : null) };
}
/** Un «document» que solo sabe responder querySelectorAll con los nodos que se le dieron por selector. */
function docFalso(porSelector) {
  return { consultas: [], querySelectorAll(sel) { this.consultas.push(sel); return porSelector[sel] || []; } };
}

test('pintarVendedor escribe la línea y cada campo con textContent', () => {
  const linea = nodo(), nombre = nodo(), telefono = nodo();
  const doc = docFalso({
    '[data-vendedor-linea]': [linea],
    '[data-vendedor="nombre"]': [nombre],
    '[data-vendedor="telefono"]': [telefono],
  });
  pintarVendedor(doc, COMPLETO);
  assert.equal(linea.textContent, 'Vende: Ana Pérez · NIT 900.000.000-1 · Calle 7 #5-35 · 318 355 5246 · hola@ejemplo.co');
  assert.equal(nombre.textContent, 'Ana Pérez');
  assert.equal(telefono.textContent, '318 355 5246');
  assert.equal(linea.hidden, false);
  assert.equal(nombre.hidden, false);
  assert.equal(telefono.hidden, false);
});
test('un campo vacío deja su nodo escondido', () => {
  const doc1 = nodo(), doc2 = nodo();
  const doc = docFalso({ '[data-vendedor="documento"]': [doc1], '[data-vendedor="correo"]': [doc2] });
  pintarVendedor(doc, { nombre: 'Ana', documento: '', correo: '   ' });
  assert.equal(doc1.hidden, true);
  assert.equal(doc2.hidden, true);
  assert.equal(doc1.textContent, '');
  assert.equal(doc2.textContent, '');
});
test('si no hay línea (sin nombre) el nodo de la línea queda escondido y vacío', () => {
  const linea = nodo();
  linea.textContent = 'texto viejo';
  pintarVendedor(docFalso({ '[data-vendedor-linea]': [linea] }), { nombre: '', documento: 'NIT 1' });
  assert.equal(linea.hidden, true);
  assert.equal(linea.textContent, '');
});
test('volver a pintar con datos nuevos muestra lo que antes estaba escondido', () => {
  const correo = nodo();
  const doc = docFalso({ '[data-vendedor="correo"]': [correo] });
  pintarVendedor(doc, { nombre: 'Ana', correo: '' });
  assert.equal(correo.hidden, true);
  pintarVendedor(doc, { nombre: 'Ana', correo: 'a@b.co' });
  assert.equal(correo.hidden, false);
  assert.equal(correo.textContent, 'a@b.co');
});
test('la etiqueta va en el mismo nodo que el dato: si el dato falta, se esconde con ella', () => {
  const lleno = nodo({ 'data-etiqueta': 'Documento' }), vacio = nodo({ 'data-etiqueta': 'Correo' });
  const doc = docFalso({ '[data-vendedor="documento"]': [lleno], '[data-vendedor="correo"]': [vacio] });
  pintarVendedor(doc, { nombre: 'Ana', documento: 'NIT 1', correo: '' });
  assert.equal(lleno.textContent, 'Documento: NIT 1');
  assert.equal(lleno.hidden, false);
  assert.equal(vacio.textContent, '');          /* ni «Correo:» suelto */
  assert.equal(vacio.hidden, true);
});
test('el mismo dato puede salir en varios lugares', () => {
  const a = nodo(), b = nodo({ 'data-etiqueta': 'En el mostrador' });
  pintarVendedor(docFalso({ '[data-vendedor="direccion"]': [a, b] }), { nombre: 'Ana', direccion: 'Calle 7' });
  assert.equal(a.textContent, 'Calle 7');
  assert.equal(b.textContent, 'En el mostrador: Calle 7');
});
test('sin vendedor no falla: lo que es del vendedor queda escondido', () => {
  const linea = nodo(), nombre = nodo();
  const doc = docFalso({ '[data-vendedor-linea]': [linea], '[data-vendedor="nombre"]': [nombre] });
  assert.doesNotThrow(() => pintarVendedor(doc, undefined));
  assert.doesNotThrow(() => pintarVendedor(doc, null));
  assert.equal(linea.hidden, true);
  assert.equal(nombre.hidden, true);
});
test('un documento sin querySelectorAll tampoco rompe', () => {
  assert.doesNotThrow(() => pintarVendedor(null, COMPLETO));
  assert.doesNotThrow(() => pintarVendedor({}, COMPLETO));
});

/* ---------- datos y páginas ---------- */
test('catalogo.json trae los cinco campos del vendedor como texto', () => {
  const v = JSON.parse(leer('tienda/catalogo.json')).vendedor;
  for (const k of ['nombre', 'documento', 'direccion', 'telefono', 'correo']) assert.equal(typeof v[k], 'string', k);
});
test('catalogo.json ya trae la dirección y el teléfono de la tienda', () => {
  const v = JSON.parse(leer('tienda/catalogo.json')).vendedor;
  assert.equal(v.direccion, 'Calle 7 #5-35, Centro, El Espinal, Tolima');
  assert.equal(v.telefono, '318 355 5246');
});
test('los términos nombran el retracto de 5 días hábiles y no nombran Chicoral', () => {
  const t = leer('tienda/terminos/index.html');
  assert.match(t, /retracto/i); assert.match(t, /5 días hábiles/); assert.doesNotMatch(t, /Chicoral/i);
});

const TERMINOS = leer('tienda/terminos/index.html');
const SECCIONES = [
  'Quién vende', 'Precios', 'Domicilio', 'Tiempos', 'Pagos', 'Cambios y garantía',
  'Derecho de retracto', 'Reversión del pago', 'Peticiones, quejas y reclamos',
];
test('los términos tienen las nueve secciones, en orden', () => {
  const encabezados = [...TERMINOS.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
  assert.deepEqual(encabezados, SECCIONES.map((s, i) => `${i + 1}. ${s}`));
});
test('los términos citan los artículos de la ley y los plazos de la ley', () => {
  assert.match(TERMINOS, /Ley 1480 de 2011/);
  assert.match(TERMINOS, /artículo 47/);
  assert.match(TERMINOS, /artículo 51/);
  assert.match(TERMINOS, /30 días calendario/);
  assert.match(TERMINOS, /15 días hábiles/);
  assert.match(TERMINOS, /perecederos, de uso personal o hechos a la medida/);
});
test('los términos no fijan cifras que cambian (pesos, horas): eso lo muestra la tienda', () => {
  assert.doesNotMatch(TERMINOS, /\$\s*\d/);
  assert.doesNotMatch(TERMINOS, /\b\d{1,2}:\d{2}\b/);
});
test('los términos hablan de usted', () => {
  assert.match(TERMINOS, /\busted\b/i);
  assert.doesNotMatch(TERMINOS, /(^|[^\p{L}])(tú|tienes|puedes|tu pedido|tus datos)([^\p{L}]|$)/iu);
});
test('los términos pintan los cinco datos del vendedor, cada uno con su dato y su etiqueta en el mismo nodo', () => {
  for (const campo of ['nombre', 'documento', 'direccion', 'telefono', 'correo']) {
    const nodos = [...TERMINOS.matchAll(new RegExp(`<[a-z0-9]+[^>]*\\bdata-vendedor="${campo}"[^>]*>`, 'g'))];
    assert.ok(nodos.length >= 1, `falta data-vendedor="${campo}"`);
    for (const [n] of nodos) assert.match(n, /\bhidden\b/, `data-vendedor="${campo}" debe empezar escondido`);
  }
  /* El nombre va sin etiqueta: es el primer renglón y su prueba espera solo el nombre */
  assert.doesNotMatch(TERMINOS, /data-vendedor="nombre"[^>]*data-etiqueta/);
  assert.equal([...TERMINOS.matchAll(/data-vendedor="nombre"/g)].length, 1);
});
test('el enlace a la Superintendencia abre en otra pestaña con rel noopener', () => {
  const a = TERMINOS.match(/<a[^>]*href="https:\/\/www\.sic\.gov\.co"[^>]*>/);
  assert.ok(a, 'falta el enlace a https://www.sic.gov.co');
  assert.match(a[0], /rel="noopener"/);
});
test('los términos se cargan con la misma hoja de estilo, vendedor.js con defer y sin scripts en línea', () => {
  assert.match(TERMINOS, /<html lang="es">/);
  assert.match(TERMINOS, /<meta name="description" content="[^"]+">/);
  assert.match(TERMINOS, /<script src="\/tienda\/vendedor\.js\?v=\d+" defer><\/script>/);
  assert.match(TERMINOS, /<link rel="stylesheet" href="\/tienda\/tienda\.css\?v=\d+">/);
  assert.doesNotMatch(TERMINOS, /<script(?![^>]*\ssrc=)/i);
  assert.doesNotMatch(TERMINOS, /\sonclick=/i);
});

const TIENDA = leer('tienda/index.html');
const PRIVACIDAD = leer('tienda/privacidad/index.html');
for (const [nombre, html] of [['la tienda', TIENDA], ['la política de datos', PRIVACIDAD], ['los términos', TERMINOS]]) {
  test(`el pie de ${nombre} lleva el enlace a los términos y la línea de quién vende (escondida hasta tener datos)`, () => {
    const pie = html.match(/<footer class="pie">[\s\S]*?<\/footer>/);
    assert.ok(pie, 'falta <footer class="pie">');
    assert.match(pie[0], /<a href="\/tienda\/terminos\/">Términos, cambios y retracto<\/a>/);
    assert.match(pie[0], /<p class="vendedor" data-vendedor-linea hidden><\/p>/);
  });
}
test('«Seguir al pago» lleva al lado la aceptación de los términos (en otra pestaña, para no perder el pedido)', () => {
  const cierre = TIENDA.match(/<div class="cierre">[\s\S]*?<\/div>\s*<\/form>/);
  assert.ok(cierre, 'falta el cierre del formulario');
  assert.match(cierre[0], /Seguir al pago/);
  assert.match(cierre[0], /Al pedir acepta los <a href="\/tienda\/terminos\/" target="_blank" rel="noopener">términos de la tienda<\/a>\./);
});
test('vendedor.js se carga con defer, después de ubicacion.js y antes de tienda.js', () => {
  const orden = [...TIENDA.matchAll(/<script src="\/tienda\/([\w-]+)\.js\?v=\d+" defer>/g)].map((m) => m[1]);
  assert.deepEqual(orden.slice(0, 6), ['llegada', 'buscar', 'guardados', 'ubicacion', 'vendedor', 'tienda']);
  assert.match(PRIVACIDAD, /<script src="\/tienda\/vendedor\.js\?v=\d+" defer><\/script>/);
});
test('vendedor.js pinta con textContent: nunca innerHTML, ni eval, ni scripts', () => {
  const js = leer('tienda/vendedor.js');
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.match(js, /textContent/);
});
