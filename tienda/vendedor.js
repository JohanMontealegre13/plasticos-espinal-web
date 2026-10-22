/* Plásticos Espinal · tienda en línea: quién vende.
   La Ley 1480 de 2011 (art. 50) pide a quien vende en línea mostrar quién es: nombre, documento,
   dirección, teléfono y correo. Esos datos viven en tienda/catalogo.json ("vendedor") y de ahí se
   pintan en el pie de cada página y en los términos (tienda/terminos/). Cuando la tienda pase a otra
   razón social se cambia allá y nada más.

   Módulo puro en lo que importa (se prueba en Node, pruebas/unit/vendedor.test.mjs); lo único que
   hace por su cuenta es, al cargar en el navegador, pedir catalogo.json y pintar. Si falla, no hace
   nada: la página queda con su texto fijo.

   · lineaVendedor(v) → «Vende: nombre · documento · dirección · teléfono · correo», saltando lo vacío;
     sin nombre no hay línea ('').
   · pintarVendedor(doc, v) → escribe esa línea en cada [data-vendedor-linea] y cada dato en cada
     [data-vendedor="campo"] (textContent, nunca HTML). Lo que queda vacío se esconde (hidden), y si el
     nodo trae data-etiqueta («Documento») la etiqueta se escribe con el dato en el mismo nodo, así
     nunca queda una etiqueta suelta sin nada. */
(function (raiz) {
  'use strict';

  var CAMPOS = ['nombre', 'documento', 'direccion', 'telefono', 'correo'];
  var SEPARADOR = ' · ';

  /* El dato ya limpio, o '' si falta o no es texto */
  function dato(v, campo) {
    var t = v && typeof v === 'object' ? v[campo] : '';
    return typeof t === 'string' ? t.trim() : '';
  }

  function lineaVendedor(v) {
    if (!dato(v, 'nombre')) return '';
    var partes = [];
    CAMPOS.forEach(function (c) { var t = dato(v, c); if (t) partes.push(t); });
    return 'Vende: ' + partes.join(SEPARADOR);
  }

  function escribir(nodo, texto) {
    nodo.textContent = texto;
    nodo.hidden = texto === '';
  }

  function pintarVendedor(doc, v) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    var linea = lineaVendedor(v);
    Array.prototype.forEach.call(doc.querySelectorAll('[data-vendedor-linea]'), function (nodo) { escribir(nodo, linea); });
    CAMPOS.forEach(function (campo) {
      var t = dato(v, campo);
      Array.prototype.forEach.call(doc.querySelectorAll('[data-vendedor="' + campo + '"]'), function (nodo) {
        var etiqueta = typeof nodo.getAttribute === 'function' ? nodo.getAttribute('data-etiqueta') : null;
        escribir(nodo, t && etiqueta ? etiqueta + ': ' + t : t);
      });
    });
  }

  raiz.PE = raiz.PE || {};
  raiz.PE.lineaVendedor = lineaVendedor;
  raiz.PE.pintarVendedor = pintarVendedor;

  /* En el navegador: pedir catalogo.json una vez y pintar. En Node (pruebas) no hay document ni se hace nada. */
  if (raiz.document && typeof raiz.fetch === 'function') {
    raiz.fetch('/tienda/catalogo.json', { cache: 'no-cache', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (sitio) {
        /* Sin "vendedor" (o roto) la página se queda como está */
        if (sitio && sitio.vendedor && typeof sitio.vendedor === 'object') pintarVendedor(raiz.document, sitio.vendedor);
      })
      .catch(function () { /* sin datos: el texto fijo de la página basta */ });
  }
})(typeof window !== 'undefined' ? window : globalThis);
