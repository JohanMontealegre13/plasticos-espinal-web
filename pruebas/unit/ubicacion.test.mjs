/* Ubicación de entrega (tienda/ubicacion.js): el enlace del mapa, la distancia a la tienda y
   cómo se juntan el enlace y las indicaciones escritas sin que el CRM (que corta a 300) lo parta. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE } from '../lib.mjs';

const { enlaceMapa, distanciaKm, unirIndicaciones, entregaValida, dentroDeEntrega } = cargarPE(['tienda/ubicacion.js']);

const TIENDA = { lat: 4.1525081, lng: -74.8828245 };
const ENTREGA = { tienda: TIENDA, radio_km: 8 };

/* ---------- enlaceMapa ---------- */
test('enlace del mapa con 5 decimales', () => assert.equal(enlaceMapa(4.152508, -74.88282), 'https://maps.google.com/?q=4.15251,-74.88282'));
test('el enlace completa con ceros hasta 5 decimales', () => assert.equal(enlaceMapa(4.15, -74.885), 'https://maps.google.com/?q=4.15000,-74.88500'));
test('sin números válidos no hay enlace', () => {
  assert.equal(enlaceMapa(NaN, -74.88), '');
  assert.equal(enlaceMapa(4.15, Infinity), '');
  assert.equal(enlaceMapa(undefined, undefined), '');
  assert.equal(enlaceMapa(null, null), '');
  assert.equal(enlaceMapa('4.15', '-74.88'), '');
});

/* ---------- distanciaKm ---------- */
test('el mismo punto está a 0 km', () => assert.equal(distanciaKm(TIENDA, TIENDA), 0));
test('un grado de latitud son unos 111,2 km', () => {
  const d = distanciaKm({ lat: 4, lng: -74 }, { lat: 5, lng: -74 });
  assert.ok(Math.abs(d - 111.19) < 0.05, String(d));
});
test('la distancia es la misma de ida y de vuelta', () => {
  const b = { lat: 4.711, lng: -74.072 };
  assert.ok(Math.abs(distanciaKm(TIENDA, b) - distanciaKm(b, TIENDA)) < 1e-9);
});
test('distancia de la tienda a un punto de El Espinal: menos de 8 km', () => {
  assert.ok(distanciaKm(TIENDA, { lat: 4.15, lng: -74.885 }) < 1);
});
test('un punto a unos 12 km de la tienda pasa de 8 km', () => {
  assert.ok(distanciaKm(TIENDA, { lat: 4.2117, lng: -74.9832 }) > 8);   /* barrio Villanueva, ~12,6 km */
});
test('Bogotá queda a más de 100 km', () => assert.ok(distanciaKm(TIENDA, { lat: 4.711, lng: -74.072 }) > 100));
test('con un dato que no es número la distancia no es un número', () => {
  assert.ok(Number.isNaN(distanciaKm({ lat: 'x', lng: 1 }, TIENDA)));
  assert.ok(Number.isNaN(distanciaKm(null, TIENDA)));
});

/* ---------- entregaValida / dentroDeEntrega ---------- */
test('entrega válida: la tienda y un radio mayor que cero', () => {
  assert.equal(entregaValida(ENTREGA), true);
  assert.equal(entregaValida({ tienda: TIENDA, radio_km: 0.5 }), true);
});
test('entrega que falta o viene dañada no es válida', () => {
  for (const mala of [undefined, null, {}, 'x', [], { radio_km: 8 }, { tienda: TIENDA },
    { tienda: TIENDA, radio_km: 0 }, { tienda: TIENDA, radio_km: -3 }, { tienda: TIENDA, radio_km: '8' },
    { tienda: { lat: 4.15 }, radio_km: 8 }, { tienda: { lat: 'a', lng: 'b' }, radio_km: 8 },
    { tienda: { lat: 95, lng: -74 }, radio_km: 8 }, { tienda: { lat: 4, lng: -190 }, radio_km: 8 }]) {
    assert.equal(entregaValida(mala), false, JSON.stringify(mala));
  }
});
test('dentro del radio de la tienda sí, Bogotá no', () => {
  assert.equal(dentroDeEntrega(4.15, -74.885, ENTREGA), true);
  assert.equal(dentroDeEntrega(4.711, -74.072, ENTREGA), false);
});
test('el borde del radio cuenta como dentro', () => {
  const d = distanciaKm(TIENDA, { lat: 4.2117, lng: -74.9832 });
  assert.equal(dentroDeEntrega(4.2117, -74.9832, { tienda: TIENDA, radio_km: d }), true);
  assert.equal(dentroDeEntrega(4.2117, -74.9832, { tienda: TIENDA, radio_km: d - 0.001 }), false);
});
test('sin entrega válida o con un punto dañado nada queda dentro', () => {
  assert.equal(dentroDeEntrega(4.15, -74.885, null), false);
  assert.equal(dentroDeEntrega(4.15, -74.885, { tienda: TIENDA, radio_km: 'ocho' }), false);
  assert.equal(dentroDeEntrega(NaN, -74.885, ENTREGA), false);
  assert.equal(dentroDeEntrega(undefined, undefined, ENTREGA), false);
});

/* ---------- unirIndicaciones ---------- */
test('el enlace va primero y nunca se corta', () => {
  const e = enlaceMapa(4.15251, -74.88282);
  const r = unirIndicaciones(e, 'x'.repeat(300), 300);
  assert.equal(r.length, 300);
  assert.ok(r.startsWith(e + ' · '));
});
test('si no cabe todo, se corta solo el texto y el enlace queda completo', () => {
  const e = enlaceMapa(4.15251, -74.88282);
  const r = unirIndicaciones(e, 'abcdefghij'.repeat(40), 300);
  assert.equal(r, e + ' · ' + 'abcdefghij'.repeat(40).slice(0, 300 - e.length - 3));
  assert.ok(r.includes(e));
});
test('si todo cabe, queda completo', () => {
  assert.equal(unirIndicaciones('https://maps.google.com/?q=1,2', 'Casa azul', 300), 'https://maps.google.com/?q=1,2 · Casa azul');
});
test('sin enlace queda el texto, sin texto queda el enlace', () => {
  assert.equal(unirIndicaciones('', 'Casa azul', 300), 'Casa azul');
  assert.equal(unirIndicaciones('https://maps.google.com/?q=1,2', '', 300), 'https://maps.google.com/?q=1,2');
});
test('sin enlace, el texto largo se recorta al largo', () => {
  assert.equal(unirIndicaciones('', 'x'.repeat(500), 300), 'x'.repeat(300));
});
test('sin nada queda vacío, venga lo que venga', () => {
  assert.equal(unirIndicaciones('', '', 300), '');
  assert.equal(unirIndicaciones(undefined, undefined, 300), '');
  assert.equal(unirIndicaciones(null, null, 300), '');
});
test('el texto con solo espacios cuenta como sin texto', () => {
  assert.equal(unirIndicaciones('https://maps.google.com/?q=1,2', '   ', 300), 'https://maps.google.com/?q=1,2');
});
test('el corte no deja un espacio colgando antes del final', () => {
  const e = 'https://maps.google.com/?q=1,2';
  const espacio = 40 - e.length - 3;    /* lugar que le queda al texto */
  const texto = 'a'.repeat(espacio - 1) + ' ' + 'b'.repeat(10);
  const r = unirIndicaciones(e, texto, 40);
  assert.equal(r, e + ' · ' + 'a'.repeat(espacio - 1));
});
test('si el enlace solo cabe a duras penas, va solo y completo', () => {
  const e = 'https://maps.google.com/?q=4.15000,-74.88500';
  assert.equal(unirIndicaciones(e, 'Casa azul', e.length + 3), e);   /* sin lugar para una sola letra */
  assert.equal(unirIndicaciones(e, 'Casa azul', e.length + 4), e + ' · C');
});
test('si ni el enlace cabe, no se parte', () => {
  const e = 'https://maps.google.com/?q=4.15000,-74.88500';
  assert.equal(unirIndicaciones(e, 'Casa azul', 10), e);
});
test('el corte no deja a medias un emoji (el servidor no lo aceptaría)', () => {
  const e = 'https://maps.google.com/?q=1,2';
  const largo = e.length + 3 + 3;
  const r = unirIndicaciones(e, 'ab😀cd', largo);   /* 😀 son dos unidades y la segunda no cabe */
  assert.equal(r, e + ' · ab');
  assert.equal(unirIndicaciones('', 'ab😀cd', 3), 'ab');
  for (const t of [r, unirIndicaciones('', 'ab😀cd', 3)]) assert.doesNotMatch(t, /[\ud800-\udbff]$/);
});
test('un largo que no es número no corta nada', () => {
  assert.equal(unirIndicaciones('', 'Casa azul', undefined), 'Casa azul');
  assert.equal(unirIndicaciones('https://maps.google.com/?q=1,2', 'Casa azul', NaN), 'https://maps.google.com/?q=1,2 · Casa azul');
});
