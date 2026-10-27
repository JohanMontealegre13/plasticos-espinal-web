/* Módulo de ejemplo con la forma de los archivos de la tienda (tienda/llegada.js, buscar.js…):
   cuelga lo suyo de window.PE y no toca nada más. Solo lo usa lib.test.mjs. */
(function (raiz) {
  'use strict';
  function doble(n) { return n * 2; }
  raiz.PE = raiz.PE || {};
  raiz.PE.doble = doble;
})(typeof window !== 'undefined' ? window : globalThis);
