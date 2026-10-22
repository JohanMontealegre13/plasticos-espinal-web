/* Lo que la tienda guarda en el celular (tienda/guardados.js): favoritos, vistos y el último pedido.
   Nada de esto puede romper la tienda: sin almacenamiento, con datos dañados o con productos
   que ya no están, la respuesta es siempre un valor usable. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE } from '../lib.mjs';

const { guardado, alFrente, paraLaCanasta } = cargarPE(['tienda/guardados.js']);

/** Un almacenamiento de mentira que se comporta como localStorage. */
function almacenFalso(/** @type {Record<string, string>} */ inicial = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (/** @type {string} */ k) => (k in datos ? datos[k] : null),
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => { datos[k] = String(v); },
  };
}

/* ---------- alFrente ---------- */

test('alFrente pone de primero, sin repetir, y corta', () => {
  assert.deepEqual(alFrente([3, 2, 1], 2, 3), [2, 3, 1]);
  assert.deepEqual(alFrente([3, 2, 1], 9, 3), [9, 3, 2]);
});
test('alFrente sobre una lista vacía o dañada', () => {
  assert.deepEqual(alFrente([], 5, 12), [5]);
  assert.deepEqual(alFrente(null, 5, 12), [5]);
  assert.deepEqual(alFrente('hola', 5, 12), [5]);
});
test('alFrente quita todas las repeticiones y no cambia la lista original', () => {
  const lista = [4, 7, 4, 1, 4];
  assert.deepEqual(alFrente(lista, 4, 10), [4, 7, 1]);
  assert.deepEqual(lista, [4, 7, 4, 1, 4]);
});
test('alFrente con tope de uno deja solo el nuevo; sin tope válido no corta', () => {
  assert.deepEqual(alFrente([1, 2, 3], 9, 1), [9]);
  assert.deepEqual(alFrente([1, 2, 3], 9, 0), []);
  assert.deepEqual(alFrente([1, 2, 3], 9, undefined), [9, 1, 2, 3]);
});
test('alFrente: el 12 de «vistos» y el 100 de «favoritos» se cumplen', () => {
  const vistos = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.equal(alFrente(vistos, 99, 12).length, 12);
  assert.equal(alFrente(vistos, 99, 12)[0], 99);
  assert.equal(alFrente(vistos, 99, 12).includes(12), false);
});

/* ---------- guardado ---------- */

test('guardado sin almacenamiento no lanza y recuerda en memoria', () => {
  const roto = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const g = guardado(roto, 'pe-prueba', []);
  assert.deepEqual(g.leer(), []);
  g.escribir([1]);
  assert.deepEqual(g.leer(), [1]);
});
test('guardado con JSON dañado devuelve el valor por defecto', () => {
  const m = { getItem: () => '{roto', setItem() {} };
  assert.deepEqual(guardado(m, 'pe-prueba', []).leer(), []);
});
test('guardado con almacenamiento nulo (sin localStorage) recuerda en memoria', () => {
  const g = guardado(null, 'pe-prueba', []);
  assert.deepEqual(g.leer(), []);
  g.escribir([7, 8]);
  assert.deepEqual(g.leer(), [7, 8]);
  assert.doesNotThrow(() => guardado(undefined, 'k', {}).escribir({ a: 1 }));
});
test('guardado escribe JSON bajo su clave y lo vuelve a leer', () => {
  const a = almacenFalso();
  const g = guardado(a, 'pe-favoritos-v1', []);
  g.escribir([141, 131]);
  assert.equal(a.datos['pe-favoritos-v1'], '[141,131]');
  assert.deepEqual(guardado(a, 'pe-favoritos-v1', []).leer(), [141, 131]);   /* otra "visita" */
});
test('guardado sin nada guardado devuelve el valor por defecto', () => {
  assert.deepEqual(guardado(almacenFalso(), 'k', []).leer(), []);
  assert.deepEqual(guardado(almacenFalso(), 'k', { a: 1 }).leer(), { a: 1 });
});
test('guardado entrega una copia del valor por defecto: cambiarla no daña la siguiente lectura', () => {
  const g = guardado(almacenFalso(), 'k', []);
  g.leer().push(5);
  assert.deepEqual(g.leer(), []);
});
test('guardado con datos de otra forma (objeto donde va una lista, texto, número, null) usa el valor por defecto', () => {
  for (const crudo of ['{"a":1}', '"hola"', '5', 'null', 'true', '']) {
    assert.deepEqual(guardado(almacenFalso({ k: crudo }), 'k', []).leer(), [], crudo);
  }
  assert.deepEqual(guardado(almacenFalso({ k: '[1]' }), 'k', {}).leer(), {});   /* lista donde va un objeto */
});
test('guardado: si getItem lanza pero antes se escribió, vale lo escrito', () => {
  let falla = false;
  const a = almacenFalso();
  const m = { getItem: (/** @type {string} */ k) => { if (falla) throw new Error('x'); return a.getItem(k); }, setItem: a.setItem };
  const g = guardado(m, 'k', []);
  g.escribir([3]);
  falla = true;
  assert.deepEqual(g.leer(), [3]);
});
test('guardado: si el almacenamiento no guarda (cuota llena), lo escrito se recuerda en memoria', () => {
  const lleno = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } };
  const g = guardado(lleno, 'k', []);
  g.escribir([1, 2]);
  assert.deepEqual(g.leer(), [1, 2]);
  g.escribir([2]);
  assert.deepEqual(g.leer(), [2]);
});
test('guardado: si una escritura falla DESPUÉS de una que sí guardó, vale la memoria (no lo viejo) hasta que otra funcione', () => {
  let lleno = false;
  const a = almacenFalso();
  const m = { getItem: a.getItem, setItem: (/** @type {string} */ k, /** @type {string} */ v) => { if (lleno) throw new Error('QuotaExceededError'); a.setItem(k, v); } };
  const g = guardado(m, 'pe-favoritos-v1', []);
  g.escribir([141]);                       /* esta sí quedó en el almacenamiento */
  lleno = true;
  g.escribir([]);                          /* quitar el favorito: el almacenamiento se quedó con [141] */
  assert.equal(a.datos['pe-favoritos-v1'], '[141]');
  assert.deepEqual(g.leer(), []);          /* manda lo último escrito, no lo viejo */
  g.escribir([131]);
  assert.deepEqual(g.leer(), [131]);
  lleno = false;
  g.escribir([5]);                         /* volvió a guardar: de nuevo vale el almacenamiento */
  assert.equal(a.datos['pe-favoritos-v1'], '[5]');
  a.datos['pe-favoritos-v1'] = '[6]';      /* p. ej. otra pestaña */
  assert.deepEqual(g.leer(), [6]);
});
test('guardado: lo que otra pestaña guardó después se lee de nuevo', () => {
  const a = almacenFalso();
  const uno = guardado(a, 'k', []), dos = guardado(a, 'k', []);
  uno.escribir([1]);
  dos.escribir([2]);
  assert.deepEqual(uno.leer(), [2]);
});

/* ---------- paraLaCanasta ---------- */

const por = {
  141: { id: 141, nombre: 'Contenedor', disponible: true },
  131: { id: 131, nombre: 'Tenedor', disponible: true },
  398: { id: 398, nombre: 'Plato 23', disponible: false },
};

test('paraLaCanasta deja fuera lo agotado y lo que ya no está', () => {
  const por = { 141: { id: 141, nombre: 'Contenedor', disponible: true }, 398: { id: 398, nombre: 'Plato 23', disponible: false } };
  assert.deepEqual(paraLaCanasta([{ id: 141, cantidad: 2 }, { id: 398, cantidad: 1 }, { id: 777, cantidad: 4 }], por),
    { canasta: { 141: 2 }, fuera: ['Plato 23', 'Código 777'] });
});
test('paraLaCanasta pone tope de 999 por línea', () => {
  assert.deepEqual(paraLaCanasta([{ id: 141, cantidad: 5000 }], por).canasta, { 141: 999 });
});
test('paraLaCanasta suma una misma línea repetida (con tope) y nombra una sola vez lo que falta', () => {
  const r = paraLaCanasta([{ id: 141, cantidad: 2 }, { id: 141, cantidad: 3 }, { id: 398, cantidad: 1 }, { id: 398, cantidad: 2 }], por);
  assert.deepEqual(r, { canasta: { 141: 5 }, fuera: ['Plato 23'] });
  assert.deepEqual(paraLaCanasta([{ id: 141, cantidad: 600 }, { id: 141, cantidad: 600 }], por).canasta, { 141: 999 });
});
test('paraLaCanasta ignora líneas dañadas sin lanzar', () => {
  const sucias = [null, undefined, 5, 'x', [], {}, { id: 'abc', cantidad: 2 }, { id: 141 }, { id: 141, cantidad: 0 },
    { id: 141, cantidad: -3 }, { id: 141, cantidad: 'mucho' }, { id: -1, cantidad: 1 }, { id: 1.5, cantidad: 1 }, { id: 131, cantidad: 2 }];
  assert.deepEqual(paraLaCanasta(sucias, por), { canasta: { 131: 2 }, fuera: [] });
});
test('paraLaCanasta acepta id y cantidad escritos como texto de números', () => {
  assert.deepEqual(paraLaCanasta([{ id: '141', cantidad: '2' }], por).canasta, { 141: 2 });
});
test('paraLaCanasta redondea la cantidad hacia abajo', () => {
  assert.deepEqual(paraLaCanasta([{ id: 141, cantidad: 2.9 }], por).canasta, { 141: 2 });
});
test('paraLaCanasta sin líneas, sin lista o sin catálogo devuelve vacío', () => {
  assert.deepEqual(paraLaCanasta([], por), { canasta: {}, fuera: [] });
  assert.deepEqual(paraLaCanasta(null, por), { canasta: {}, fuera: [] });
  assert.deepEqual(paraLaCanasta({ 0: { id: 141, cantidad: 1 } }, por), { canasta: {}, fuera: [] });
  assert.deepEqual(paraLaCanasta([{ id: 141, cantidad: 1 }], null), { canasta: {}, fuera: ['Código 141'] });
});
test('paraLaCanasta: un producto sin «disponible» o sin nombre no entra y se nombra con su código', () => {
  const raro = { 5: { id: 5, nombre: 'Sin dato' }, 6: { id: 6, disponible: false } };
  assert.deepEqual(paraLaCanasta([{ id: 5, cantidad: 1 }, { id: 6, cantidad: 1 }], raro), { canasta: {}, fuera: ['Sin dato', 'Código 6'] });
});
test('paraLaCanasta no entra por los nombres heredados de los objetos', () => {
  assert.deepEqual(paraLaCanasta([{ id: 'constructor', cantidad: 1 }, { id: '__proto__', cantidad: 1 }], {}), { canasta: {}, fuera: [] });
});
test('paraLaCanasta no cambia lo que recibe', () => {
  const lineas = [{ id: 141, cantidad: 2 }, { id: 398, cantidad: 1 }];
  const copia = JSON.stringify(lineas), copiaPor = JSON.stringify(por);
  paraLaCanasta(lineas, por);
  assert.equal(JSON.stringify(lineas), copia);
  assert.equal(JSON.stringify(por), copiaPor);
});
