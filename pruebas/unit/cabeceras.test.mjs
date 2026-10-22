/* Cabeceras de seguridad de la tienda: la ubicación se puede pedir, lo demás sigue cerrado. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer, cabecerasPara } from '../lib.mjs';

const ESPERADA = 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()';

test('la tienda puede pedir la ubicación; cámara y micrófono siguen cerrados', () => {
  const pp = cabecerasPara('/tienda/')['Permissions-Policy'];
  assert.match(pp, /geolocation=\(self\)/);
  assert.match(pp, /camera=\(\)/);
});
test('solo la ubicación se abre: el resto de permisos sigue cerrado', () => {
  assert.equal(cabecerasPara('/tienda/')['Permissions-Policy'], ESPERADA);
});
test('el resto del sitio usa la misma política', () => {
  assert.equal(cabecerasPara('/')['Permissions-Policy'], ESPERADA);
});
test('.htaccess (por si se vuelve a Apache) dice lo mismo que _headers', () => {
  const m = leer('.htaccess').match(/Permissions-Policy\s+"([^"]+)"/);
  assert.ok(m, 'falta Permissions-Policy en .htaccess');
  assert.equal(m[1], ESPERADA);
});
