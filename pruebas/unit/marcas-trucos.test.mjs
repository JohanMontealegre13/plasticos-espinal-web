/* Trucos de las fichas 3D de la cinta de marcas (Johan, 11-nov-2026).
   Los logos son de otras empresas: se puede mostrarlos para informar que los vendemos, pero no
   deformarlos. Estas pruebas leen estilos.css y principal.js y exigen que ningún truco estire,
   aplaste ni tuerza la ficha, y que cada truco que pide principal.js tenga su animación. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer } from '../lib.mjs';

const css = leer('css/estilos.css');
const js = leer('js/principal.js');

/** @returns {Map<string, string>} nombre → cuerpo de cada @keyframes marca-* */
function animaciones() {
  const mapa = new Map();
  for (const m of css.matchAll(/@keyframes (marca-[\w-]+)\s*\{/g)) {
    let i = (m.index ?? 0) + m[0].length;
    let hondo = 1;
    const desde = i;
    while (hondo && i < css.length) {
      if (css[i] === '{') hondo++;
      else if (css[i] === '}') hondo--;
      i++;
    }
    mapa.set(m[1], css.slice(desde, i - 1));
  }
  return mapa;
}

const trucos = [...new Set([...js.matchAll(/\{ n: '([\w-]+)', ms: \d+/g)].map((m) => m[1]))];

test('principal.js trae al menos 25 trucos distintos', () => {
  assert.ok(trucos.length >= 25, `solo hay ${trucos.length}`);
});

test('cada truco tiene su clase y su animación en estilos.css', () => {
  const lista = animaciones();
  for (const n of trucos) {
    assert.match(css, new RegExp(`\\.hace-${n} \\.marca__truco \\{[^}]*animation-name: marca-${n};`), `falta .hace-${n}`);
    assert.ok(lista.has('marca-' + n), `falta @keyframes marca-${n}`);
  }
});

test('ningún movimiento de la cinta estira, aplasta ni tuerce el logo', () => {
  for (const [nombre, cuerpo] of animaciones()) {
    assert.doesNotMatch(cuerpo, /scale[XYZ3]|skew|matrix/i, `${nombre} deforma la ficha`);
    for (const m of cuerpo.matchAll(/scale\(([^)]*)\)/g)) assert.doesNotMatch(m[1], /,/, `${nombre}: scale con dos medidas deforma`);
  }
  assert.doesNotMatch(css.slice(css.indexOf('Fichas 3D'), css.indexOf('11. Carrusel')), /skew|scale[XY]\(/, 'las fichas no se deforman');
});
