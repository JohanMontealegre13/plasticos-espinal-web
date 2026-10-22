/* Pruebas de las utilidades compartidas (lib.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE } from '../lib.mjs';

test('cargarPE devuelve lo que el archivo cuelga de window.PE, en un contexto nuevo cada vez', () => {
  const a = cargarPE(['pruebas/unit/fixtures/pe-ejemplo.js']);
  assert.equal(a.doble(4), 8);
  a.doble.marca = 1;
  const b = cargarPE(['pruebas/unit/fixtures/pe-ejemplo.js']);
  assert.equal(b.doble.marca, undefined);
});
