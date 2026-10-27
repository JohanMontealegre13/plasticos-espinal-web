/* Plásticos Espinal · tienda en línea: buscar y ordenar productos.
   Módulo puro (no toca la página): lo usa tienda.js para la vitrina y se prueba
   en Node (pruebas/unit/buscar.test.mjs).

   Qué entiende el buscador:
   · mayúsculas, tildes y signos no importan («Contenedores», «CONTENEDÓR»);
   · el plural es lo mismo que el singular («vasos» = «vaso», «contenedores» = «contenedor»);
   · las palabras van en cualquier orden y TODAS tienen que estar en el producto;
   · una palabra a medio escribir sirve («deter» encuentra el detergente);
   · un número es el código del producto, o el comienzo de un número del nombre;
   · una letra de más, de menos o dos seguidas cambiadas de sitio se perdonan en
     palabras de 5 letras o más («servileta», «pitiillo»);
   · los sinónimos de tienda/catalogo.json ("sinonimos"): quien escribe la clave
     también ve los productos con cualquiera de sus valores. Va en UN solo sentido
     (para que valga en los dos se escribe dos veces) y claves y valores se
     comparan por su raíz, así que «pitillos» y «pitillo» son lo mismo ahí también.
     Un valor con varias palabras cuenta como alternativas, no como una frase.

   Las palabras de relleno («de», «para», «con»…) no cuentan mientras quede alguna
   otra; si lo escrito es SOLO relleno se busca como cualquier palabra (así «con»,
   camino a «contenedor», no muestra toda la tienda).

   Orden de lo que sale: el código exacto, luego los que EMPIEZAN por lo primero
   que se escribió, luego los que hay antes que los agotados, luego los «Más pedidos»
   y al final por nombre. */
(function (raiz) {
  'use strict';

  var RELLENO = ['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'y', 'x', 'por', 'un', 'una'];
  var DESDE_LETRAS = 5;                    /* desde cuántas letras (sin números) se perdona un error de dedo */

  /* minúsculas, sin tildes, y todo lo que no sea letra o número pasa a espacio */
  function normalizar(texto) {
    return String(texto == null ? '' : texto).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ');
  }

  /* Todas las palabras de un texto, ya normalizadas (las de un nombre de producto, con su relleno) */
  function dividir(texto) {
    return normalizar(texto).split(' ').filter(Boolean);
  }

  /* Las palabras de una búsqueda: sin las de relleno, salvo que todas lo sean (entonces valen todas) */
  function palabras(texto) {
    var todas = dividir(texto);
    var utiles = todas.filter(function (w) { return RELLENO.indexOf(w) < 0; });
    return utiles.length ? utiles : todas;
  }

  /* Raíz: sin la marca de plural («contenedores» → «contenedor», «vasos» → «vaso») */
  function raizDe(w) {
    var n = w.length;
    if (n > 5 && w.slice(-2) === 'es' && 'rnldj'.indexOf(w.charAt(n - 3)) >= 0) return w.slice(0, -2);
    if (n > 3 && w.charAt(n - 1) === 's') return w.slice(0, -1);
    return w;
  }

  /* ¿Se parecen con un solo error: una letra cambiada, de más, de menos o dos seguidas al revés? */
  function aUnError(a, b) {
    var la = a.length, lb = b.length, i = 0;
    if (a === b) return true;
    if (Math.abs(la - lb) > 1) return false;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
    if (la === lb) {
      return a.slice(i + 1) === b.slice(i + 1) ||
        (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2));
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  }

  /* Lo que se pide de cada palabra escrita: su raíz, las raíces de sus sinónimos y si es un número.
     Se arma UNA vez por búsqueda; los productos solo se comparan contra esto. */
  function pedidoDe(consulta, sinonimos) {
    var claves = Object.create(null);                       /* raíz de la clave -> raíces de sus sinónimos */
    if (sinonimos && typeof sinonimos === 'object') {
      Object.keys(sinonimos).forEach(function (clave) {
        if (!Array.isArray(sinonimos[clave])) return;
        var r = palabras(clave).map(raizDe);
        if (r.length !== 1) return;                         /* la clave es una sola palabra */
        var lista = claves[r[0]] || (claves[r[0]] = []);
        sinonimos[clave].forEach(function (v) {
          if (typeof v === 'string') palabras(v).forEach(function (w) { lista.push(raizDe(w)); });
        });
      });
    }
    return palabras(consulta).map(function (w) {
      var r = raizDe(w), numero = /^[0-9]+$/.test(w);
      return {
        palabra: w,
        raiz: r,
        numero: numero,
        sinonimos: claves[r] || [],
        perdona: !/[0-9]/.test(r) && r.length >= DESDE_LETRAS      /* una medida como 25x35 no se confunde con 25x25 */
      };
    });
  }

  /* ¿Casa esta palabra pedida con alguna de las raíces del nombre? */
  function casa(pedida, p, nombre) {
    var i, j, n, r;
    if (pedida.numero && pedida.palabra === String(p.id)) return true;
    for (i = 0; i < nombre.length; i++) {
      n = nombre[i];
      if (n.indexOf(pedida.raiz) === 0) return true;
      for (j = 0; j < pedida.sinonimos.length; j++) if (n.indexOf(pedida.sinonimos[j]) === 0) return true;
      if (pedida.perdona) {
        r = pedida.raiz;
        if (aUnError(r, n) || aUnError(r, n.slice(0, r.length))) return true;
      }
    }
    return false;
  }

  function comparar(a, b) { return String(a || '').localeCompare(String(b || ''), 'es'); }

  /* Los productos que casan con lo escrito, del más al menos parecido. Lista nueva.
     Sin nada que buscar (vacío, espacios o puro relleno) devuelve todos, como llegaron. */
  function buscar(productos, consulta, sinonimos) {
    var pedido = pedidoDe(consulta, sinonimos);
    if (!pedido.length) return productos.slice();
    var primera = pedido[0].raiz;
    var hallados = [];
    productos.forEach(function (p, orden) {
      var nombre = dividir(p.nombre).map(raizDe);
      for (var k = 0; k < pedido.length; k++) if (!casa(pedido[k], p, nombre)) return;
      hallados.push({
        p: p,
        orden: orden,
        codigo: pedido.some(function (w) { return w.numero && w.palabra === String(p.id); }),
        empieza: nombre.length > 0 && nombre[0].indexOf(primera) === 0,
        hay: !!p.disponible
      });
    });
    hallados.sort(function (a, b) {
      return (b.codigo - a.codigo) || (b.empieza - a.empieza) || (b.hay - a.hay) ||
        (!!b.p.destacado - !!a.p.destacado) || comparar(a.p.nombre, b.p.nombre) || (a.orden - b.orden);
    });
    return hallados.map(function (h) { return h.p; });
  }

  /* Ordena la vitrina. Lista nueva: los que hay siempre antes que los agotados y, dentro de
     cada grupo, 'pedidos' (los destacados y luego por nombre), 'menor' o 'mayor' precio, o 'nombre'. */
  function ordenar(lista, modo) {
    var precio = function (p) { return Number(p.precio) || 0; };
    return lista.map(function (p, orden) { return { p: p, orden: orden }; }).sort(function (a, b) {
      var x = a.p, y = b.p, d = !x.disponible - !y.disponible;
      if (d) return d;
      if (modo === 'menor') d = precio(x) - precio(y);
      else if (modo === 'mayor') d = precio(y) - precio(x);
      else if (modo !== 'nombre') d = !!y.destacado - !!x.destacado;
      return d || comparar(x.nombre, y.nombre) || (a.orden - b.orden);
    }).map(function (h) { return h.p; });
  }

  raiz.PE = raiz.PE || {};
  raiz.PE.buscar = buscar;
  raiz.PE.ordenar = ordenar;
  raiz.PE.palabrasBuscadas = palabras;   /* para que la página sepa si hay algo que buscar (solo espacios = nada) */
})(typeof window !== 'undefined' ? window : globalThis);
