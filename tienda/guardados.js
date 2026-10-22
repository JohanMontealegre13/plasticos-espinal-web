/* Plásticos Espinal · tienda en línea: lo que se recuerda en este celular.
   Módulo puro (no toca la página): lo usa tienda.js para los favoritos, «vistos hace poco»
   y «pedir lo de la última vez», y se prueba en Node (pruebas/unit/guardados.test.mjs).

   Nada de esto puede romper la tienda: sin almacenamiento (o si falla, o si está lleno, o si
   lo guardado está dañado) todo sigue funcionando; lo que se escribe se recuerda mientras la
   página esté abierta y solo se pierde al cerrarla.

   · guardado(almacen, clave, porDefecto) → { leer(), escribir(valor) }: JSON bajo una clave.
   · alFrente(ids, id, max): `id` de primero, sin repetir, cortado a `max`.
   · paraLaCanasta(lineas, por): de las líneas de un pedido, lo que sigue en la tienda y hay
     (con su cantidad, tope 999) y los nombres de lo que no. */
(function (raiz) {
  'use strict';

  var TOPE = 999;   /* unidades por línea de la canasta, igual que en tienda.js */

  function copia(valor) {
    try { return JSON.parse(JSON.stringify(valor)); } catch (e) { return valor; }
  }
  /* ¿Lo leído tiene la forma de lo esperado? (una lista donde va una lista, un objeto donde va un objeto) */
  function mismaForma(valor, modelo) {
    if (Array.isArray(modelo)) return Array.isArray(valor);
    if (modelo !== null && typeof modelo === 'object') return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
    return valor !== null && valor !== undefined && typeof valor === typeof modelo;
  }

  function guardado(almacen, clave, porDefecto) {
    var enMemoria, hayMemoria = false;
    function recuerdo() { return hayMemoria ? copia(enMemoria) : copia(porDefecto); }
    return {
      leer: function () {
        var crudo;
        try { crudo = almacen.getItem(clave); } catch (e) { return recuerdo(); }   /* sin almacenamiento, o no deja leer */
        if (crudo === null || crudo === undefined) return recuerdo();             /* nada guardado (o no se pudo guardar) */
        try {
          var valor = JSON.parse(crudo);
          return mismaForma(valor, porDefecto) ? valor : recuerdo();               /* dañado o de otra forma */
        } catch (e) { return recuerdo(); }
      },
      escribir: function (valor) {
        enMemoria = copia(valor); hayMemoria = true;                                /* siempre queda en memoria */
        try { almacen.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento o lleno: vale la memoria */ }
      }
    };
  }

  function alFrente(ids, id, max) {
    var fuera = [id], visto = Object.create(null);
    visto[id] = true;
    (Array.isArray(ids) ? ids : []).forEach(function (x) {
      if (visto[x]) return;
      visto[x] = true;
      fuera.push(x);
    });
    return isFinite(max) && max !== null ? fuera.slice(0, Math.max(0, Math.floor(max))) : fuera;
  }

  /* Un número escrito como número o como texto; cualquier otra cosa no cuenta */
  function numero(v) { return typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN; }

  function paraLaCanasta(lineas, por) {
    var canasta = {}, fuera = [], visto = Object.create(null);
    (Array.isArray(lineas) ? lineas : []).forEach(function (l) {
      if (!l || typeof l !== 'object') return;
      var id = numero(l.id), cantidad = Math.floor(numero(l.cantidad));
      if (!(id > 0) || id % 1 !== 0 || !isFinite(id) || !(cantidad > 0) || !isFinite(cantidad)) return;   /* línea dañada: no hay qué pedir */
      var p = por && Object.prototype.hasOwnProperty.call(por, id) ? por[id] : null;
      if (p && p.disponible) {
        canasta[id] = Math.min((canasta[id] || 0) + cantidad, TOPE);
      } else if (!visto[id]) {
        visto[id] = true;
        fuera.push(p && p.nombre ? p.nombre : 'Código ' + id);
      }
    });
    return { canasta: canasta, fuera: fuera };
  }

  raiz.PE = raiz.PE || {};
  raiz.PE.guardado = guardado;
  raiz.PE.alFrente = alFrente;
  raiz.PE.paraLaCanasta = paraLaCanasta;
})(typeof window !== 'undefined' ? window : globalThis);
