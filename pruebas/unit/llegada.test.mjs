/* Hora de llegada de un pedido hecho ahora, según el horario de tienda/catalogo.json.
   Las pruebas usan una copia congelada del horario (fixtures/horario.json): Johan puede cambiar el de
   verdad sin que se pongan rojas. Que el de verdad esté bien escrito lo revisa catalogo.test.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE, leer } from '../lib.mjs';

const { llegada, limiteHoy } = cargarPE(['tienda/llegada.js']);
const H = JSON.parse(leer('pruebas/unit/fixtures/horario.json'));
const en = (/** @type {string} */ iso) => llegada(new Date(iso), H);

test('jueves 10:00 llega hoy a las 11:00', () => {
  assert.deepEqual(en('2026-10-22T10:00:00-05:00'), { texto: 'Llega hoy antes de las 11:00 a. m.', fecha: '2026-10-22', hora: '11:00' });
});
test('al almuerzo solo cuentan los minutos abiertos', () => {
  assert.equal(en('2026-10-22T12:00:00-05:00').texto, 'Llega hoy antes de las 2:30 p. m.');
});
test('a las 18:20 pasa a mañana', () => {
  assert.equal(en('2026-10-22T18:20:00-05:00').texto, 'Llega mañana antes de las 8:50 a. m.');
});
test('sábado de noche llega el domingo', () => {
  assert.equal(en('2026-10-24T20:00:00-05:00').texto, 'Llega mañana antes de las 9:00 a. m.');
});
test('domingo 12:30 se termina el lunes', () => {
  assert.equal(en('2026-10-25T12:30:00-05:00').texto, 'Llega mañana antes de las 8:30 a. m.');
});
test('festivo usa el horario de domingo', () => {
  assert.equal(en('2026-11-02T12:30:00-05:00').texto, 'Llega mañana antes de las 8:30 a. m.');
});
test('la una se dice «la 1»', () => {
  assert.equal(en('2026-10-25T12:00:00-05:00').texto, 'Llega hoy antes de la 1:00 p. m.');
});
test('redondea a 10 minutos sin pasar el cierre', () => {
  assert.equal(en('2026-10-22T09:03:00-05:00').hora, '10:10');
  assert.equal(en('2026-10-22T17:25:00-05:00').hora, '18:30');
});
test('llegada usa hora de Colombia aunque el equipo esté en otra zona', () => {
  assert.equal(en('2026-10-22T15:00:00Z').hora, '11:00');   /* 15:00 UTC = 10:00 en Colombia */
});
test('sin ningún tramo abierto devuelve null', () => {
  assert.equal(llegada(new Date('2026-10-22T10:00:00-05:00'), { alistar_min: 60, dias: {}, festivos: [] }), null);
});

/* ---- Bordes que la regla fija ---- */

test('terminar justo al cierre del tramo se queda en ese tramo (no pasa al día siguiente)', () => {
  assert.deepEqual(en('2026-10-25T12:00:00-05:00'), { texto: 'Llega hoy antes de la 1:00 p. m.', fecha: '2026-10-25', hora: '13:00' });
});
test('una hora que ya cae en múltiplo de 10 no se mueve', () => {
  assert.equal(en('2026-10-22T09:10:00-05:00').hora, '10:10');
  assert.equal(en('2026-10-22T09:20:00-05:00').hora, '10:20');
});
test('se dice «las 12:20 p. m.» al mediodía y la fecha trae ceros', () => {
  assert.deepEqual(en('2026-10-22T11:20:00-05:00'), { texto: 'Llega hoy antes de las 12:20 p. m.', fecha: '2026-10-22', hora: '12:20' });
  assert.deepEqual(en('2026-10-22T18:20:00-05:00'), { texto: 'Llega mañana antes de las 8:50 a. m.', fecha: '2026-10-23', hora: '08:50' });
});
test('con la tienda cerrada de noche cuenta desde que abre', () => {
  assert.equal(en('2026-10-22T03:00:00-05:00').texto, 'Llega hoy antes de las 9:00 a. m.');
});
test('durante el almuerzo cuenta desde que reabre', () => {
  assert.equal(en('2026-10-22T13:00:00-05:00').texto, 'Llega hoy antes de las 3:00 p. m.');
});
test('unos segundos después del minuto no regalan un minuto', () => {
  assert.equal(en('2026-10-22T10:00:30-05:00').hora, '11:10');
});
test('a dos o más días dice «el» y el nombre del día', () => {
  const soloMiercoles = { alistar_min: 60, dias: { miercoles: [['08:00', '12:00']] }, festivos: [] };
  assert.deepEqual(llegada(new Date('2026-10-22T10:00:00-05:00'), soloMiercoles),
    { texto: 'Llega el miércoles antes de las 9:00 a. m.', fecha: '2026-10-28', hora: '09:00' });
});
test('un festivo sin horario de festivo deja la tienda cerrada ese día', () => {
  const sinFestivo = { alistar_min: 60, dias: { jueves: [['08:00', '18:00']], viernes: [['08:00', '18:00']] }, festivos: ['2026-10-22'] };
  assert.equal(llegada(new Date('2026-10-22T10:00:00-05:00'), sinFestivo).fecha, '2026-10-23');
});
test('solo mira 14 días adelante', () => {
  /* Solo abre los jueves; hoy es jueves 22 pasada la hora de cierre */
  const jueves = (/** @type {string[]} */ festivos) => ({ alistar_min: 60, dias: { jueves: [['08:00', '18:00']] }, festivos });
  const noche = new Date('2026-10-22T19:00:00-05:00');
  assert.equal(llegada(noche, jueves([])).fecha, '2026-10-29');
  assert.equal(llegada(noche, jueves(['2026-10-29'])).fecha, '2026-11-05');   /* justo 14 días adelante */
  assert.equal(llegada(noche, jueves(['2026-10-29', '2026-11-05'])), null);   /* el siguiente ya queda a 21 */
});
test('festivos que no son una lista (error al editar a mano) se ignoran, sin romper', () => {
  const festivo = new Date('2026-11-02T10:00:00-05:00');   /* lunes festivo */
  const sinFestivos = llegada(festivo, { ...H, festivos: [] });
  assert.equal(sinFestivos.texto, 'Llega hoy antes de las 11:00 a. m.');   /* lunes normal */
  for (const festivos of [{}, { '2026-11-02': true }, 2026, true, null, '2026-11-02, 2026-11-16']) {
    assert.deepEqual(llegada(festivo, { ...H, festivos }), sinFestivos, JSON.stringify(festivos));
  }
});
test('un horario que falta o está mal escrito devuelve null, sin romper', () => {
  const ahora = new Date('2026-10-22T10:00:00-05:00');
  assert.equal(llegada(ahora, undefined), null);
  assert.equal(llegada(ahora, null), null);
  assert.equal(llegada(ahora, {}), null);
  assert.equal(llegada(ahora, { alistar_min: 'mucho', dias: H.dias, festivos: [] }), null);
  assert.equal(llegada(ahora, { alistar_min: 60, dias: { jueves: 'siempre' } }), null);
  assert.equal(llegada(new Date('no es una fecha'), H), null);
});

/* ---- Hasta qué hora se puede pedir para que llegue hoy (la ficha lo muestra cuando faltan pocas horas) ---- */
const limite = (/** @type {string} */ iso) => limiteHoy(new Date(iso), H);
test('jueves 16:00: pidiendo antes de las 5:30 llega hoy, faltan 90 minutos', () => {
  assert.deepEqual(limite('2026-10-22T16:00:00-05:00'), { texto: 'Pidiendo antes de las 5:30 p. m., llega hoy', hora: '17:30', minutos: 90 });
});
test('el límite es justo: a las 17:30 todavía llega hoy y a las 17:31 ya no', () => {
  assert.equal(llegada(new Date('2026-10-22T17:30:00-05:00'), H).fecha, '2026-10-22');
  assert.equal(llegada(new Date('2026-10-22T17:31:00-05:00'), H).fecha, '2026-10-23');
  assert.equal(limite('2026-10-22T17:30:00-05:00').minutos, 0);
  assert.equal(limite('2026-10-22T17:31:00-05:00'), null);
});
test('unos segundos pasados del minuto no regalan tiempo: los minutos se redondean hacia abajo', () => {
  assert.equal(limite('2026-10-22T17:28:30-05:00').minutos, 1);
  assert.equal(limite('2026-10-22T17:28:30-05:00').hora, '17:30');
});
test('en la mañana el límite salta el almuerzo: lo que se pide a las 12:00 llega a las 2:30', () => {
  assert.equal(limite('2026-10-22T10:00:00-05:00').hora, '17:30');
  assert.equal(limite('2026-10-22T10:00:00-05:00').minutos, 450);
});
test('domingo el límite es a las 12:00 (cierra a la 1)', () => {
  assert.equal(limite('2026-10-25T11:00:00-05:00').hora, '12:00');
  assert.equal(limite('2026-10-25T11:00:00-05:00').texto, 'Pidiendo antes de las 12:00 p. m., llega hoy');
});
test('si ya no llega hoy no hay límite', () => {
  assert.equal(limite('2026-10-22T19:00:00-05:00'), null);   /* llega mañana */
  assert.equal(limite('2026-10-24T20:00:00-05:00'), null);   /* sábado de noche */
});
test('el límite usa hora de Colombia aunque el equipo esté en otra zona', () => {
  assert.equal(limite('2026-10-22T21:00:00Z').hora, '17:30');   /* 21:00 UTC = 16:00 en Colombia */
});
test('sin horario no hay límite, sin romper', () => {
  assert.equal(limiteHoy(new Date('2026-10-22T16:00:00-05:00'), undefined), null);
  assert.equal(limiteHoy(new Date('no es una fecha'), H), null);
});
