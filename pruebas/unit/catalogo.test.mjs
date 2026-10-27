/* La forma de tienda/catalogo.json, el archivo que Johan cambia a mano: WhatsApp, horario y festivos,
   sinónimos del buscador, punto de entrega y quién vende. Las demás pruebas usan copias congeladas
   (fixtures/ y SITIO_FIJO de e2e/ayudas.js); esta es la ÚNICA que lee el de verdad, y dice en palabras
   qué quedó mal escrito antes de que se publique. Lo que revisa es la forma, nunca los valores de hoy:
   cambiar una hora, quitar un festivo o agregar un sinónimo no la pone roja. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarPE, leer, WHATSAPP } from '../lib.mjs';

const { entregaValida } = cargarPE(['tienda/ubicacion.js']);
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const CAMPOS_VENDEDOR = ['nombre', 'documento', 'direccion', 'telefono', 'correo'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const esObjeto = (/** @type {unknown} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const minutos = (/** @type {string} */ h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
/** ¿Es una fecha AAAA-MM-DD que existe? (2027-02-30 no) */
function fechaReal(/** @type {unknown} */ t) {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(t + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/**
 * Lo que está mal escrito, en palabras para quien edita el archivo; [] si todo está bien.
 * @param {any} sitio
 * @returns {string[]}
 */
function revisar(sitio) {
  /** @type {string[]} */
  const mal = [];
  if (!esObjeto(sitio)) return ['El archivo entero tiene que ir entre llaves { … }.'];

  if (typeof sitio.whatsapp !== 'string' || !/^57\d{10}$/.test(sitio.whatsapp)) {
    mal.push('"whatsapp": el número entre comillas, solo dígitos y con el 57 adelante, como "573001234567".');
  }

  const h = sitio.horario;
  if (!esObjeto(h)) {
    mal.push('"horario" falta o no va entre llaves { … }.');
  } else {
    if (typeof h.alistar_min !== 'number' || !(h.alistar_min >= 0)) {
      mal.push('"alistar_min": los minutos que tarda en alistar un pedido, un número sin comillas, como 60.');
    }
    if (!esObjeto(h.dias)) {
      mal.push('"dias" falta o no va entre llaves { … } con los días de la semana.');
    } else {
      for (const [dia, tramos] of Object.entries(h.dias)) {
        if (!DIAS.includes(dia) && dia !== h.festivo) {
          mal.push(`"${dia}" no es un día: escriba ${DIAS.join(', ')} (en minúscula y sin tildes).`);
          continue;
        }
        if (!Array.isArray(tramos)) {
          mal.push(`"${dia}": va una lista de tramos entre corchetes, como [["08:00", "12:30"]], o [] si ese día no abre.`);
          continue;
        }
        tramos.forEach((t, i) => {
          if (!Array.isArray(t) || t.length !== 2 || !t.every((x) => typeof x === 'string' && HORA.test(x))) {
            mal.push(`"${dia}", tramo ${i + 1}: escriba ["HH:MM", "HH:MM"] en hora de 24, como ["14:00", "18:30"].`);
          } else if (minutos(t[0]) >= minutos(t[1])) {
            mal.push(`"${dia}", tramo ${i + 1}: la hora de abrir (${t[0]}) tiene que ser antes que la de cerrar (${t[1]}).`);
          }
        });
      }
    }
    if (!Array.isArray(h.festivos)) {
      mal.push('"festivos": una lista de fechas entre corchetes, como ["2026-12-25", "2027-01-01"] ([] si no hay).');
    } else {
      h.festivos.forEach((/** @type {unknown} */ f) => {
        if (!fechaReal(f)) mal.push(`"festivos": ${JSON.stringify(f)} no es una fecha AAAA-MM-DD que exista, como "2026-12-25".`);
      });
    }
    if ('festivo' in h && (typeof h.festivo !== 'string' || !esObjeto(h.dias) || !Array.isArray(h.dias[h.festivo]))) {
      mal.push('"festivo": el día de "dias" con el que se atiende en festivo, entre comillas, como "domingo".');
    }
  }

  const s = sitio.sinonimos;
  if (s !== undefined && !esObjeto(s)) {
    mal.push('"sinonimos" va entre llaves { … }: "palabra": ["otra", "otra más"].');
  } else if (s) {
    for (const [clave, valores] of Object.entries(s)) {
      if (!/^[\p{L}\p{N}]+$/u.test(clave)) {
        mal.push(`"sinonimos": "${clave}" tiene que ser una sola palabra (con espacios o signos el buscador la ignora).`);
      }
      if (!Array.isArray(valores) || !valores.length || !valores.every((v) => typeof v === 'string' && v.trim() !== '')) {
        mal.push(`"sinonimos": después de "${clave}" va una lista de palabras entre corchetes, como ["contenedor", "coca"].`);
      }
    }
  }

  if (!entregaValida(sitio.entrega)) {
    mal.push('"entrega": el punto de la tienda y hasta dónde llega, con números sin comillas: { "tienda": { "lat": 4.15, "lng": -74.88 }, "radio_km": 8 }.');
  }

  const v = sitio.vendedor;
  if (!esObjeto(v)) {
    mal.push(`"vendedor" falta o no va entre llaves { … } con ${CAMPOS_VENDEDOR.join(', ')}.`);
  } else {
    for (const k of CAMPOS_VENDEDOR) {
      if (typeof v[k] !== 'string') mal.push(`"vendedor": "${k}" va entre comillas ("" si todavía no se sabe).`);
    }
  }
  return mal;
}

/* ---------- el archivo de verdad ---------- */

test('tienda/catalogo.json está bien escrito', () => {
  let sitio;
  try {
    sitio = JSON.parse(leer('tienda/catalogo.json'));
  } catch (e) {
    assert.fail(`tienda/catalogo.json no se puede leer (${/** @type {Error} */ (e).message}). Revise comas, comillas y corchetes cerca de ahí.`);
  }
  const mal = revisar(sitio);
  assert.deepEqual(mal, [], 'Corrija en tienda/catalogo.json:\n  · ' + mal.join('\n  · '));
});

test('el WhatsApp de tienda/catalogo.json es el del negocio (el mismo de los enlaces del sitio)', () => {
  /* Si el negocio cambia de número, se cambia aquí (WHATSAPP en pruebas/lib.mjs) y en los enlaces de las páginas */
  assert.equal(JSON.parse(leer('tienda/catalogo.json')).whatsapp, WHATSAPP);
});

/* ---------- la revisión encuentra los errores de escribir a mano ---------- */

const BUENO = {
  whatsapp: '573183555246',
  horario: JSON.parse(leer('pruebas/unit/fixtures/horario.json')),
  sinonimos: JSON.parse(leer('pruebas/unit/fixtures/sinonimos.json')),
  entrega: { tienda: { lat: 4.1525081, lng: -74.8828245 }, radio_km: 8 },
  vendedor: { nombre: '', documento: '', direccion: 'Calle 7 #5-35', telefono: '318 355 5246', correo: '' },
};
/** Una copia de BUENO con un cambio */
const con = (/** @type {(s: any) => void} */ cambiar) => { const s = structuredClone(BUENO); cambiar(s); return revisar(s); };
/** La revisión dice algo, y todo lo que dice nombra esto */
const dice = (/** @type {string[]} */ mal, /** @type {RegExp} */ que) => {
  assert.ok(mal.length > 0, 'la revisión no encontró nada');
  for (const m of mal) assert.match(m, que);
};

test('un archivo bien escrito no tiene nada que corregir, con o sin «festivo» y sin sinónimos', () => {
  assert.deepEqual(revisar(BUENO), []);
  assert.deepEqual(con((s) => { delete s.horario.festivo; }), []);
  assert.deepEqual(con((s) => { delete s.sinonimos; }), []);
  assert.deepEqual(con((s) => { s.horario.festivos = []; s.horario.dias.domingo = []; }), []);
});
test('festivos que no son una lista (el error que tumbaba la tienda)', () => {
  for (const malo of [{}, 2026, '2026-11-02, 2026-11-16', null]) dice(con((s) => { s.horario.festivos = malo; }), /"festivos": una lista/);
});
test('una fecha de festivo que no existe o mal escrita', () => {
  dice(con((s) => { s.horario.festivos.push('2027-02-30'); }), /"2027-02-30" no es una fecha/);
  dice(con((s) => { s.horario.festivos.push('25/12/2027'); }), /no es una fecha AAAA-MM-DD/);
});
test('un día con tilde o mal escrito', () => {
  dice(con((s) => { s.horario.dias['miércoles'] = s.horario.dias.miercoles; delete s.horario.dias.miercoles; }), /"miércoles" no es un día.*sin tildes/);
});
test('un tramo al revés, sin cero o que no es lista', () => {
  dice(con((s) => { s.horario.dias.lunes = [['18:30', '14:00']]; }), /"lunes", tramo 1: la hora de abrir \(18:30\) tiene que ser antes/);
  dice(con((s) => { s.horario.dias.martes = [['8:00', '12:30']]; }), /"martes", tramo 1: escriba \["HH:MM", "HH:MM"\]/);
  dice(con((s) => { s.horario.dias.jueves = ['08:00', '12:30']; }), /"jueves", tramo \d: escriba/);   /* sin los corchetes de adentro */
  dice(con((s) => { s.horario.dias.viernes = '08:00 a 18:30'; }), /"viernes": va una lista de tramos/);
});
test('alistar_min entre comillas', () => dice(con((s) => { s.horario.alistar_min = '60'; }), /"alistar_min"/));
test('«festivo» que no nombra un día de «dias»', () => {
  dice(con((s) => { s.horario.festivo = 'feriado'; }), /"festivo": el día de "dias"/);
  dice(con((s) => { s.horario.festivo = [['08:00', '13:00']]; }), /"festivo"/);
});
test('un sinónimo sin lista o con una clave de varias palabras', () => {
  dice(con((s) => { s.sinonimos.espuma = 'icopor'; }), /después de "espuma" va una lista/);
  dice(con((s) => { s.sinonimos['bolsa de basura'] = ['talego']; }), /"bolsa de basura" tiene que ser una sola palabra/);
  dice(con((s) => { s.sinonimos.vaso = []; }), /después de "vaso"/);
});
test('entrega con números entre comillas o sin radio', () => {
  dice(con((s) => { s.entrega.radio_km = '8'; }), /"entrega"/);
  dice(con((s) => { delete s.entrega.tienda; }), /"entrega"/);
});
test('un dato del vendedor que no es texto', () => {
  dice(con((s) => { s.vendedor.documento = 900123456; }), /"documento" va entre comillas/);
  dice(con((s) => { delete s.vendedor; }), /"vendedor" falta/);
});
test('un WhatsApp con espacios, con + o sin comillas', () => {
  for (const malo of ['+57 318 355 5246', '3183555246', 573183555246]) dice(con((s) => { s.whatsapp = malo; }), /"whatsapp"/);
});
