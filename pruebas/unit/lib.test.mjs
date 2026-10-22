/* Pruebas de las utilidades compartidas (lib.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE } from '../lib.mjs';

test('cargarPE devuelve lo que el archivo cuelga de window.PE, en un contexto nuevo cada vez', () => {
  const a = cargarPE(['pruebas/unit/fixtures/pe-ejemplo.js']);
  assert.equal(a.doble(4), 8);
  a.doble.marca = 1;
  a.sucio = 1;   /* algo que el archivo no define: solo sobrevive si el window se comparte */
  const b = cargarPE(['pruebas/unit/fixtures/pe-ejemplo.js']);
  assert.notStrictEqual(a, b);
  assert.equal(b.sucio, undefined);
  assert.equal(b.doble.marca, undefined);
});
