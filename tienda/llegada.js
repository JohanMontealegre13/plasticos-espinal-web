/* Plásticos Espinal · tienda en línea: cuándo llega un pedido hecho ahora.
   Módulo puro (no toca la página): lo usa tienda.js para la franja de arriba y
   la canasta, y se prueba en Node (pruebas/unit/llegada.test.mjs).

   La regla: se pasa `ahora` a hora de Colombia (ahora − 5 h, leída con getUTC*,
   NUNCA con getHours(): el celular puede tener otra zona o la hora corrida) y
   desde ese minuto se van gastando `alistar_min` minutos SOLO dentro de los
   tramos en que la tienda está abierta, día tras día, hasta 14 días adelante.
   Un día festivo usa los tramos de `horario.festivo`. La hora que sale sube al
   siguiente múltiplo de 10 minutos sin pasar el cierre de su tramo.

   El horario vive en tienda/catalogo.json ("horario"): Johan lo cambia ahí. */
(function (raiz) {
  'use strict';

  var COLOMBIA_MIN = 5 * 60;             /* Colombia es UTC-5, sin horario de verano */
  var DIA_MS = 24 * 60 * 60000;
  var HASTA_DIAS = 14;                   /* hoy y los 14 días siguientes */
  var CLAVES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  /* "08:30" -> 510 minutos desde la medianoche, o NaN si no es una hora */
  function aMinutos(texto) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(texto));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }

  /* Tramos abiertos de un día como [[desde, hasta], …] en minutos, en orden.
     Lo que no se entiende (un tramo roto, un día que no es lista) se ignora. */
  function tramosDe(horario, fecha, claveDia) {
    var festivos = horario.festivos || [];
    var esFestivo = festivos.indexOf(fecha) >= 0;
    /* Festivo sin `festivo` en el horario = cerrado ese día */
    var lista = esFestivo ? (horario.festivo ? horario.dias[horario.festivo] : null) : horario.dias[claveDia];
    if (!Array.isArray(lista)) return [];
    var fuera = [];
    lista.forEach(function (t) {
      if (!Array.isArray(t)) return;
      var desde = aMinutos(t[0]), hasta = aMinutos(t[1]);
      if (desde < hasta) fuera.push([desde, hasta]);   /* NaN también se descarta */
    });
    return fuera.sort(function (a, b) { return a[0] - b[0]; });
  }

  function hora12(minutos) {
    var h = Math.floor(minutos / 60), m = minutos % 60, h12 = h % 12 || 12;
    var cuando = h < 12 ? 'a. m.' : 'p. m.';
    return (h12 === 1 ? 'la ' : 'las ') + h12 + ':' + dos(m) + ' ' + cuando;
  }

  /* ¿Cuándo llega un pedido hecho en `ahora`? { texto, fecha: 'AAAA-MM-DD', hora: 'HH:MM' }
     o null si no se puede decir (falta el horario o no abre en 14 días). */
  function llegada(ahora, horario) {
    if (!(ahora instanceof Date) || isNaN(ahora.getTime())) return null;
    if (!horario || typeof horario !== 'object' || !horario.dias || typeof horario.dias !== 'object') return null;
    var gastar = horario.alistar_min;
    if (typeof gastar !== 'number' || !isFinite(gastar) || gastar < 0) return null;

    var col = new Date(ahora.getTime() - COLOMBIA_MIN * 60000);   /* sus getUTC* ya son hora de Colombia */
    var hoy = Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate());
    /* Unos segundos pasados del minuto ya cuentan como el minuto siguiente */
    var desdeAhora = col.getUTCHours() * 60 + col.getUTCMinutes() + (col.getUTCSeconds() || col.getUTCMilliseconds() ? 1 : 0);

    for (var k = 0; k <= HASTA_DIAS; k++) {
      var dia = new Date(hoy + k * DIA_MS);
      var fecha = dia.getUTCFullYear() + '-' + dos(dia.getUTCMonth() + 1) + '-' + dos(dia.getUTCDate());
      var tramos = tramosDe(horario, fecha, CLAVES[dia.getUTCDay()]);
      for (var i = 0; i < tramos.length; i++) {
        var hasta = tramos[i][1];
        var desde = k === 0 ? Math.max(tramos[i][0], desdeAhora) : tramos[i][0];
        if (desde >= hasta) continue;                     /* ya pasó o no cabe nada */
        if (gastar > hasta - desde) { gastar -= hasta - desde; continue; }
        /* Termina en este tramo (justo en su cierre también cuenta): sube al múltiplo de 10 */
        var fin = Math.min(Math.ceil((desde + gastar) / 10) * 10, hasta);
        return {
          texto: 'Llega ' + (k === 0 ? 'hoy' : k === 1 ? 'mañana' : 'el ' + NOMBRES[dia.getUTCDay()]) + ' antes de ' + hora12(fin),
          fecha: fecha,
          hora: dos(Math.floor(fin / 60)) + ':' + dos(fin % 60)
        };
      }
    }
    return null;
  }

  raiz.PE = raiz.PE || {};
  raiz.PE.llegada = llegada;
})(typeof window !== 'undefined' ? window : globalThis);
