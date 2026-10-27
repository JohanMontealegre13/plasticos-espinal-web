/* Plásticos Espinal · tienda en línea: la ubicación de entrega con el GPS.
   Módulo puro (no toca la página): lo usa tienda.js para el botón «Usar mi ubicación actual»
   y se prueba en Node (pruebas/unit/ubicacion.test.mjs).

   En El Espinal muchas direcciones son «frente a la tienda de…». Como Rappi, DiDi o Uber, el
   cliente puede adjuntar el punto de su GPS, pero solo si cae dentro del radio de entrega de
   tienda/catalogo.json ("entrega": el punto de la tienda y "radio_km"; Johan lo cambia ahí).

   · enlaceMapa(lat, lng) → enlace de Google Maps con 5 decimales (±1 m), o '' si no son números.
   · distanciaKm(a, b) → kilómetros en línea recta entre dos puntos { lat, lng } (haversine).
   · entregaValida(entrega) → ¿trae la tienda con coordenadas y un radio mayor que cero?
   · dentroDeEntrega(lat, lng, entrega) → ¿ese punto cae dentro del radio de la tienda?
   · unirIndicaciones(enlace, texto, largo) → «enlace · texto» sin pasar de `largo` (el CRM corta
     las indicaciones a 300): el enlace va PRIMERO y nunca se corta, se corta solo el texto. */
(function (raiz) {
  'use strict';

  var RADIO_TIERRA_KM = 6371;
  var SEPARADOR = ' · ';

  function numero(n) { return typeof n === 'number' && isFinite(n); }
  function radianes(grados) { return grados * Math.PI / 180; }

  function enlaceMapa(lat, lng) {
    if (!numero(lat) || !numero(lng)) return '';
    return 'https://maps.google.com/?q=' + lat.toFixed(5) + ',' + lng.toFixed(5);
  }

  function distanciaKm(a, b) {
    if (!a || !b || !numero(a.lat) || !numero(a.lng) || !numero(b.lat) || !numero(b.lng)) return NaN;
    var dLat = radianes(b.lat - a.lat), dLng = radianes(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(radianes(a.lat)) * Math.cos(radianes(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function entregaValida(entrega) {
    var t = entrega && entrega.tienda;
    return !!t && numero(t.lat) && numero(t.lng) && Math.abs(t.lat) <= 90 && Math.abs(t.lng) <= 180 &&
      numero(entrega.radio_km) && entrega.radio_km > 0;
  }

  function dentroDeEntrega(lat, lng, entrega) {
    if (!entregaValida(entrega)) return false;
    var d = distanciaKm(entrega.tienda, { lat: lat, lng: lng });
    return numero(d) && d <= entrega.radio_km;
  }

  /* Corta a `n` unidades sin dejar a medias un emoji (una mitad suelta rompe al guardar en el servidor)
     ni un espacio colgando al final. */
  function cortar(texto, n) {
    var t = texto.slice(0, n);
    if (t.length && t.length < texto.length && /[\ud800-\udbff]/.test(t.charAt(t.length - 1))) t = t.slice(0, -1);
    return t.replace(/\s+$/, '');
  }

  function unirIndicaciones(enlace, texto, largo) {
    var e = enlace ? String(enlace) : '';
    var t = texto ? String(texto).replace(/^\s+|\s+$/g, '') : '';
    var tope = numero(largo) ? Math.floor(largo) : Infinity;
    if (!e) return cortar(t, tope);
    if (!t) return e;
    var lugar = tope - e.length - SEPARADOR.length;   /* lo que le queda al texto */
    if (lugar <= 0) return e;                          /* el enlace va completo aunque no quepa nada más */
    var corto = cortar(t, lugar);
    return corto ? e + SEPARADOR + corto : e;
  }

  raiz.PE = raiz.PE || {};
  raiz.PE.enlaceMapa = enlaceMapa;
  raiz.PE.distanciaKm = distanciaKm;
  raiz.PE.entregaValida = entregaValida;
  raiz.PE.dentroDeEntrega = dentroDeEntrega;
  raiz.PE.unirIndicaciones = unirIndicaciones;
})(typeof window !== 'undefined' ? window : globalThis);
