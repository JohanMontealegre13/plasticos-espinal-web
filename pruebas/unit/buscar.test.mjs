/* Buscador de la tienda (tienda/buscar.js): plurales, tildes, sinónimos, errores de dedo y orden. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE, leer } from '../lib.mjs';

const { buscar, ordenar, palabrasBuscadas } = cargarPE(['tienda/buscar.js']);
const P = JSON.parse(leer('pruebas/e2e/catalogo-crm.json')).productos;
const S = JSON.parse(leer('tienda/catalogo.json')).sinonimos;
const ids = (/** @type {{id: number}[]} */ l) => l.map((p) => p.id);
const prod = (/** @type {number} */ id, /** @type {string} */ nombre, /** @type {object} */ otros = {}) =>
  ({ id, nombre, categoria: 'c1', precio: 1000, disponible: true, destacado: false, foto: '', fotos: [], ...otros });

test('plural, tildes y mayúsculas', () => assert.deepEqual(ids(buscar(P, 'CONTENEDORES', S)), [141]));
test('palabras sueltas en otro orden', () => assert.deepEqual(ids(buscar(P, 'blanco vaso', S)), [210]));
test('sinónimo', () => assert.deepEqual(ids(buscar(P, 'portacomidas', S)), [141]));
test('un error de dedo', () => assert.deepEqual(ids(buscar(P, 'servileta', S)), [191]));
test('el código exacto va primero', () => assert.equal(buscar(P, '141', S)[0].id, 141));
test('comienzo de palabra mientras escribe', () => assert.deepEqual(ids(buscar(P, 'deter', S)), [520]));
test('lo que no está no sale', () => assert.deepEqual(buscar(P, 'manguera', S), []));
test('consulta vacía o de puros espacios devuelve todo', () => assert.equal(buscar(P, '   ', S).length, 8));
test('menor precio con el agotado al final', () => {
  const l = ids(ordenar(P, 'menor'));
  assert.deepEqual(l.slice(0, 2), [228, 210]);
  assert.equal(l.at(-1), 398);
});
test('ordenar no cambia la lista original', () => {
  const antes = ids(P); ordenar(P, 'mayor'); assert.deepEqual(ids(P), antes);
});

/* ---------- lo que la firma no dice ---------- */

test('el sinónimo es de un solo sentido: «icopor» encuentra el contenedor, «espuma» no', () => {
  assert.deepEqual(ids(buscar(P, 'icopor', S)), [141]);
  assert.deepEqual(buscar(P, 'espuma', S), []);
});
test('un sinónimo con plural llega a la misma raíz', () => {
  const l = [prod(1, 'Pajilla negra x100 und'), prod(2, 'Vaso x50 und')];
  assert.deepEqual(ids(buscar(l, 'pitillos', { pitillo: ['pajilla'] })), [1]);
  assert.deepEqual(ids(buscar(l, 'pitillo', { Pitíllos: ['PAJILLAS'] })), [1]);
});
test('«talego» encuentra la bolsa y «cubiertos» el tenedor', () => {
  assert.deepEqual(ids(buscar(P, 'talego', S)), [305]);
  assert.deepEqual(ids(buscar(P, 'cubiertos', S)), [131]);
});
test('todas las palabras tienen que casar', () => {
  assert.deepEqual(buscar(P, 'vaso negro', S), []);
  assert.deepEqual(ids(buscar(P, 'vaso 7 oz', S)), [210]);
});
test('las palabras de relleno no cuentan', () => {
  assert.deepEqual(ids(buscar(P, 'vaso de 7 oz para el café', S)), []);   /* «café» no está */
  assert.deepEqual(ids(buscar(P, 'vaso de 7 oz', S)), [210]);
  assert.deepEqual(ids(buscar(P, 'bolsa x kraft', S)), [305]);
});
test('consulta de puras palabras de relleno devuelve todo', () => {
  assert.equal(buscar(P, 'de la el', S).length, 8);
  assert.equal(buscar(P, '', S).length, 8);
  assert.deepEqual(palabrasBuscadas('  de la  '), []);
  assert.deepEqual(palabrasBuscadas('Vasos DE Papel'), ['vasos', 'papel']);
});
test('consulta vacía devuelve una copia, en el mismo orden', () => {
  const todo = buscar(P, '', S);
  assert.notEqual(todo, P);
  assert.deepEqual(ids(todo), ids(P));
});
test('un número solo casa con el código exacto o con una palabra que empiece igual', () => {
  assert.deepEqual(ids(buscar(P, '14', S)), []);       /* «14» no es el código 141 ni empieza ninguna palabra */
  assert.deepEqual(ids(buscar(P, '25', S)), [191]);    /* «25x25» empieza por 25 */
  assert.deepEqual(ids(buscar(P, '7', S)), [210]);     /* la palabra «7» de «Vaso 7 oz» */
});
test('un error de número no casa con otro número', () => {
  const l = [prod(1, 'Caja 12345 und')];
  assert.deepEqual(buscar(l, '12346', S), []);
});
test('una letra de menos, de más o dos cambiadas de sitio cuentan como un error', () => {
  assert.deepEqual(ids(buscar(P, 'pitilo', S)), [228]);      /* le falta una «l» */
  assert.deepEqual(ids(buscar(P, 'pitiillo', S)), [228]);    /* una «i» de más */
  assert.deepEqual(ids(buscar(P, 'pitilol', S)), [228]);     /* «ol» en vez de «lo» */
  assert.deepEqual(ids(buscar(P, 'blosa', S)), [305]);       /* «bolsa» con la «o» y la «l» cambiadas */
});
test('dos errores en la misma palabra ya no casan', () => {
  assert.deepEqual(buscar(P, 'pitolla', S), []);
});
test('el error de dedo vale también contra el comienzo de una palabra larga', () => {
  assert.deepEqual(ids(buscar(P, 'detergete', S)), [520]);   /* le falta una «n» a «detergente» */
  assert.deepEqual(ids(buscar(P, 'deterbe', S)), [520]);     /* «deterge» con la «g» cambiada por «b» */
  assert.deepEqual(buscar(P, 'deterbo', S), []);             /* dos cambios contra «deterge» */
});
test('una palabra corta no admite errores', () => {
  assert.deepEqual(buscar(P, 'vasa', S), []);                /* «vaso» con la «o» cambiada, pero son 4 letras */
  assert.deepEqual(ids(buscar(P, 'bols', S)), [305]);        /* eso sí: como comienzo de «bolsa» */
});
test('el orden: código, luego el que empieza por la primera palabra, luego destacado, luego nombre', () => {
  const l = [
    prod(10, 'Zapatilla vaso x10', { destacado: true }),
    prod(20, 'Vaso grande x10'),
    prod(30, 'Pitillo para vaso x10'),
    prod(40, 'Vaso mediano x10', { destacado: true }),
    prod(5, 'Tapa de vaso x10'),
  ];
  assert.deepEqual(ids(buscar(l, 'vaso', {})), [40, 20, 10, 30, 5]);
  assert.deepEqual(ids(buscar(l, '5', {})), [5]);
  assert.deepEqual(ids(buscar([prod(7, 'Vaso 7 oz'), prod(8, 'Bolsa 7 kilos', { destacado: true }), prod(7000, 'Caja 7 cm')], '7', {})), [7, 8, 7000]);
});
test('el nombre se compara en español (la ñ y las tildes no desordenan)', () => {
  const l = [prod(1, 'Zapato vaso'), prod(2, 'Ñame vaso'), prod(3, 'Ánfora vaso'), prod(4, 'Nube vaso')];
  assert.deepEqual(ids(buscar(l, 'vaso', {})), [3, 4, 2, 1]);
});
test('no cambia la lista ni los productos que recibe', () => {
  const antes = JSON.stringify(P);
  buscar(P, 'vaso', S); buscar(P, '', S);
  assert.equal(JSON.stringify(P), antes);
});
test('sin sinónimos (o con basura) busca igual', () => {
  assert.deepEqual(ids(buscar(P, 'tenedor', undefined)), [131]);
  assert.deepEqual(ids(buscar(P, 'tenedor', null)), [131]);
  assert.deepEqual(ids(buscar(P, 'tenedor', { tenedor: 'cuchara', vaso: null, bolsa: [1, 'bolsa'] })), [131]);
});
test('un producto sin nombre no rompe la búsqueda', () => {
  const l = [{ id: 1, precio: 5, disponible: true }, prod(2, 'Vaso')];
  assert.deepEqual(ids(buscar(l, 'vaso', {})), [2]);
  assert.equal(buscar(l, '', {}).length, 2);
});

/* ---------- ordenar ---------- */

test('mayor precio con el agotado al final', () => {
  const l = ids(ordenar(P, 'mayor'));
  assert.deepEqual(l.slice(0, 2), [305, 520]);
  assert.equal(l.at(-1), 398);
});
test('nombre A-Z con el agotado al final', () => {
  const l = ids(ordenar(P, 'nombre'));
  assert.deepEqual(l, [305, 141, 520, 228, 191, 131, 210, 398]);
});
test('más pedidos: los destacados primero, luego por nombre, el agotado al final', () => {
  const l = ids(ordenar(P, 'pedidos'));
  assert.deepEqual(l, [141, 131, 210, 305, 520, 228, 191, 398]);
});
test('un agotado destacado va después de los disponibles', () => {
  const l = [prod(1, 'Aro', { disponible: false, destacado: true }), prod(2, 'Zeta')];
  assert.deepEqual(ids(ordenar(l, 'pedidos')), [2, 1]);
});
test('precios iguales se desempatan por nombre', () => {
  const l = [prod(1, 'Zeta', { precio: 5 }), prod(2, 'Alfa', { precio: 5 }), prod(3, 'Beta', { precio: 3 })];
  assert.deepEqual(ids(ordenar(l, 'menor')), [3, 2, 1]);
  assert.deepEqual(ids(ordenar(l, 'mayor')), [2, 1, 3]);
});
test('un modo desconocido se trata como «más pedidos»', () => {
  assert.deepEqual(ids(ordenar(P, 'cualquiera')), ids(ordenar(P, 'pedidos')));
});
test('ordenar devuelve una lista nueva aunque no cambie nada', () => {
  const una = [prod(1, 'A')];
  assert.notEqual(ordenar(una, 'nombre'), una);
});
