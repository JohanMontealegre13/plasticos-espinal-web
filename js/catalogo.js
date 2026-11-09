/* Plásticos Espinal · catálogo público (sin precios: decisión de Johan, 9-nov-2026).
   Lo usan dos páginas:
   · /productos/ ([data-catalogo]): categorías como pestañas, buscador, filtros (categoría,
     marca, lo que hay), orden y la ficha de cada producto (?p=ID) con fotos, pestañas de
     descripción y características, y productos parecidos.
   · el inicio ([data-pestanas]): «Productos de la bodega» en pestañas por categoría.
   Los datos salen de /api/catalogo (functions/api/catalogo.js, que habla con el CRM). Cada
   producto se pide por WhatsApp. Si el catálogo no carga, la página lo dice y ofrece WhatsApp;
   en el inicio la sección simplemente no aparece. Sin este archivo, el inicio se ve completo. */
(function () {
  'use strict';

  var API = '/api/catalogo';
  var FOTOS = '/api/foto/';
  var WA = '573183555246';
  var REF = '/img/productos/';
  /* Foto de referencia (Pexels, ver img/productos/CREDITS.txt) para un producto sin foto propia.
     Nunca una escena hecha con IA: en una tarjeta de producto parecería el producto que se vende.
     Se busca primero en el nombre del producto y después en el de su categoría, por comienzo de
     palabra («contenedores» no es «tenedor») y la primera palabra manda. Lo de aseo no tiene foto propia: va la de la bodega. */
  var REFERENCIAS = [['plato', 'platos'], ['vaso', 'vasos'], ['bolsa', 'bolsas'], ['cubierto', 'cubiertos'],
    ['tenedor', 'cubiertos'], ['cuchara', 'cubiertos'], ['cuchillo', 'cubiertos'], ['contenedor', 'contenedores'],
    ['portacomida', 'contenedores'], ['tapa', 'tapas'], ['domo', 'tapas'], ['empaque', 'empaques'], ['caja', 'empaques'],
    ['pitillo', 'pitillos'], ['bandeja', 'bandejas'], ['servilleta', 'servilletas'], ['eco', 'eco'], ['biodegradable', 'eco']];

  var $ = function (/** @type {string} */ id) { return document.getElementById(id); };
  /** @param {string} t @param {string} [c] @param {string} [x] */
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  /** @param {string} s */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** @param {string} s */
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  /** @param {string} s */
  function raiz(s) { return s.replace(/(es|s)$/, ''); }
  var menosMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @typedef {{ id: number, nombre: string, categoria: string, disponible: boolean, destacado: boolean, foto: string,
   *   fotos: string[], contenido?: { cantidad: number, unidad: string }, descripcion?: string,
   *   detalles?: { nombre: string, valor: string }[] }} Producto */
  /** @typedef {{ id: string, nombre: string, slug: string, n: number }} Categoria */

  /** @type {{ categorias: Categoria[], productos: Producto[], por: Record<string, Producto>, cats: Record<string, Categoria> }} */
  var cat = { categorias: [], productos: [], por: {}, cats: {} };

  /* ---------- Datos ---------- */
  function cargar() {
    return fetch(API, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.productos) || !d.productos.length) throw new Error('vacío');
        cat.productos = d.productos.filter(function (/** @type {any} */ p) { return p && p.id && p.nombre; });
        cat.productos.forEach(function (p) { cat.por[String(p.id)] = p; });
        cat.categorias = (Array.isArray(d.categorias) ? d.categorias : []).map(function (/** @type {any} */ c) {
          var n = cat.productos.filter(function (p) { return p.categoria === c.id; }).length;
          return { id: String(c.id), nombre: String(c.nombre), slug: slug(c.nombre), n: n };
        }).filter(function (/** @type {Categoria} */ c) { return c.n > 0; });
        cat.categorias.forEach(function (c) { cat.cats[c.id] = c; });
      });
  }

  /** @param {Producto} p */
  function fotosDe(p) {
    var lista = (p.fotos && p.fotos.length ? p.fotos : (p.foto ? [p.foto] : []));
    return lista.map(function (f) { return FOTOS + encodeURIComponent(f); });
  }
  /** La foto de referencia de la primera palabra que tenga una («Tapa para vaso» → tapas), o '' @param {string} texto */
  function referenciaDe(texto) {
    var palabras = norm(texto).split(/[^a-z0-9]+/);
    for (var j = 0; j < palabras.length; j++) {
      for (var i = 0; i < REFERENCIAS.length; i++) {
        if (palabras[j].indexOf(REFERENCIAS[i][0]) === 0) return REF + REFERENCIAS[i][1] + '.webp';
      }
    }
    return '';
  }
  /** Foto de referencia: por el nombre del producto, si no por su categoría, si no la bodega @param {Producto} p */
  function referencia(p) {
    var c = cat.cats[p.categoria];
    return referenciaDe(p.nombre) || referenciaDe(c ? c.nombre : '') || REF + 'bodega.webp';
  }
  /** @param {Producto} p */
  function marcaDe(p) {
    var d = (p.detalles || []).filter(function (x) { return norm(x.nombre) === 'marca'; })[0];
    return d ? d.valor : '';
  }
  /** @param {Producto} p */
  function enlaceWa(p) {
    var texto = 'Hola, Plásticos Espinal 👋 Quiero pedir: ' + p.nombre + ' (código ' + p.id + '). ¿Me confirman precio y disponibilidad?';
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto);
  }
  /** @param {string} texto */
  function waTexto(texto) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto); }
  /** @param {number} id */
  function urlFicha(id) { return '/productos/?p=' + id; }

  /* ---------- Tarjeta de producto (catálogo, inicio y parecidos) ---------- */
  /** @param {Producto} p @param {{ compacta?: boolean, alAbrir?: (p: Producto) => void }} [op] */
  function tarjeta(p, op) {
    op = op || {};
    var li = el('li'), a = el('article', 'tarjeta-prod' + (op.compacta ? ' tarjeta-prod--compacta' : ''));
    var fotos = fotosDe(p);
    var foto = /** @type {HTMLAnchorElement} */ (el('a', 'tarjeta-prod__foto'));
    foto.href = urlFicha(p.id);
    foto.tabIndex = -1;                       /* el mismo destino que el nombre: una sola parada del teclado */
    foto.setAttribute('aria-hidden', 'true');
    var img = /** @type {HTMLImageElement} */ (el('img'));
    img.src = fotos[0] || referencia(p); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 400; img.height = 400;
    if (!fotos.length) foto.classList.add('es-referencia');
    foto.appendChild(img);
    if (!fotos.length) foto.appendChild(el('span', 'sello-ref', 'Foto de referencia'));
    if (!p.disponible) foto.appendChild(el('span', 'sello-prod sello-prod--agotado', 'Agotado'));
    else if (p.destacado) foto.appendChild(el('span', 'sello-prod', 'Más pedido'));
    var cuerpo = el('div', 'tarjeta-prod__cuerpo');
    var c = cat.cats[p.categoria];
    if (c && !op.compacta) cuerpo.appendChild(el('p', 'tarjeta-prod__cat', c.nombre));
    var h3 = el('h3'), nombre = /** @type {HTMLAnchorElement} */ (el('a', 'tarjeta-prod__nombre', p.nombre));
    nombre.href = urlFicha(p.id);
    h3.appendChild(nombre);
    cuerpo.append(h3, el('p', 'tarjeta-prod__codigo', 'Código ' + p.id));
    var pedir = /** @type {HTMLAnchorElement} */ (el('a', 'boton boton-wa tarjeta-prod__pedir'));
    pedir.href = enlaceWa(p); pedir.target = '_blank'; pedir.rel = 'noopener';
    pedir.append(icono('i-wa', 'icono icono-wa'), document.createTextNode(p.disponible ? 'Pedir' : 'Preguntar'), el('span', 'sr-only', ' ' + p.nombre + ' por WhatsApp'));
    cuerpo.appendChild(pedir);
    if (op.alAbrir) {
      [foto, nombre].forEach(function (x) {
        x.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;   /* abrir en otra pestaña sigue igual */
          e.preventDefault();
          op.alAbrir(p);
        });
      });
    }
    a.append(foto, cuerpo);
    li.appendChild(a);
    return li;
  }
  /** @param {string} id @param {string} clase */
  function icono(id, clase) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', clase); s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }

  /* ---------- Pestañas accesibles (inicio y ficha) ---------- */
  /** Patrón de pestañas WAI-ARIA: clic, flechas, Inicio y Fin cambian de pestaña. Las pestañas
   * escondidas (hidden) se saltan. @param {HTMLElement} lista el [role=tablist] */
  function pestanas(lista) {
    var visibles = function () {
      return /** @type {HTMLElement[]} */ (Array.prototype.slice.call(lista.querySelectorAll('[role="tab"]')))
        .filter(function (t) { return !t.hidden; });
    };
    /** @param {HTMLElement} tab @param {boolean} [enfocar] */
    function activar(tab, enfocar) {
      lista.querySelectorAll('[role="tab"]').forEach(function (/** @type {HTMLElement} */ t) {
        var si = t === tab;
        t.setAttribute('aria-selected', String(si));
        t.tabIndex = si ? 0 : -1;
        var panel = $(t.getAttribute('aria-controls') || '');
        if (panel) panel.hidden = !si;
      });
      if (enfocar) tab.focus();
    }
    lista.addEventListener('click', function (e) {
      var t = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest('[role="tab"]'));
      if (t) activar(t);
    });
    lista.addEventListener('keydown', function (e) {
      var t = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest('[role="tab"]'));
      if (!t) return;
      var v = visibles(), i = v.indexOf(t), n = v.length, j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j < 0) return;
      e.preventDefault();
      activar(v[j], true);
    });
    var primera = function () { var v = visibles(); if (v[0]) activar(v[0]); };
    primera();
    return { primera: primera };
  }

  /** Lo que hay primero; luego lo más pedido (o el nombre) @param {Producto[]} l @param {string} modo */
  function ordenar(l, modo) {
    return l.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      return (Number(!a.p.disponible) - Number(!b.p.disponible))
        || (modo === 'nombre' ? 0 : Number(!!b.p.destacado) - Number(!!a.p.destacado))
        || a.p.nombre.localeCompare(b.p.nombre, 'es') || (a.i - b.i);
    }).map(function (x) { return x.p; });
  }

  /* ======================================================================
     Inicio: «Productos de la bodega» en pestañas por categoría
     ====================================================================== */
  function inicio() {
    var caja = /** @type {HTMLElement} */ (document.querySelector('[data-pestanas]'));
    if (!caja) return;
    cargar().then(function () {
      /* Las categorías con más productos, hasta 5; en cada una, primero lo más pedido */
      var elegidas = cat.categorias.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
      if (!elegidas.length) return;
      var lista = $('pestanasLista'), paneles = $('pestanasPaneles');
      elegidas.forEach(function (c, i) {
        var tab = /** @type {HTMLButtonElement} */ (el('button', 'pestana', c.nombre));
        tab.type = 'button'; tab.id = 'pestana-' + i;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', 'panel-' + i);
        lista.appendChild(tab);
        var panel = el('div', 'pestanas__panel');
        panel.id = 'panel-' + i;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
        var ul = el('ul', 'rejilla-prod rejilla-prod--fila');
        ordenar(cat.productos.filter(function (p) { return p.categoria === c.id; }), 'pedidos').slice(0, 8)
          .forEach(function (p) { ul.appendChild(tarjeta(p, { compacta: true })); });
        var todos = /** @type {HTMLAnchorElement} */ (el('a', 'enlace-terciario pestanas__todos', 'Ver todos los productos de ' + c.nombre.toLowerCase()));
        todos.href = '/productos/?categoria=' + c.slug;
        todos.appendChild(icono('i-flecha', 'icono'));
        panel.append(ul, todos);
        paneles.appendChild(panel);
      });
      pestanas(lista);
      caja.hidden = false;
    }).catch(function () { /* sin catálogo, el inicio sigue completo sin esta sección */ });
  }

  /* ======================================================================
     /productos/: listado con filtros y ficha
     ====================================================================== */
  var estado = { categoria: '', q: '', marcas: /** @type {string[]} */ ([]), hay: false, orden: 'pedidos' };
  /** @type {{ primera: () => void } | null} */
  var pestanasFicha = null;

  /** La categoría de ?categoria=…: igual al nombre, o que lo contenga (vasos → «Vasos y platos») @param {string} pedido */
  function categoriaDe(pedido) {
    var s = slug(pedido);
    if (!s) return null;
    var exacta = cat.categorias.filter(function (c) { return c.slug === s; })[0];
    if (exacta) return exacta;
    var r = raiz(s.split('-')[0]);
    return cat.categorias.filter(function (c) { return r && c.slug.split('-').some(function (w) { return raiz(w) === r; }); })[0] || null;
  }

  function leerDireccion() {
    var u = new URLSearchParams(location.search);
    var pedida = u.get('categoria') || '', c = categoriaDe(pedida);
    estado.categoria = c ? c.id : '';
    estado.q = (u.get('q') || '').slice(0, 80);
    /* Una categoría que el CRM llama distinto (el inicio pide «vasos»): se busca por el nombre */
    if (!c && pedida && !estado.q) estado.q = pedida.replace(/-/g, ' ').slice(0, 80);
    estado.marcas = []; estado.hay = false;
    return u.get('p');
  }
  /** @param {boolean} empujar */
  function escribirDireccion(empujar) {
    var u = new URLSearchParams();
    if (estado.categoria) u.set('categoria', cat.cats[estado.categoria].slug);
    if (estado.q.trim()) u.set('q', estado.q.trim());
    var url = '/productos/' + (u.toString() ? '?' + u.toString() : '');
    if (empujar) history.pushState(null, '', url); else history.replaceState(null, '', url);
  }

  /** Lo que se mira antes de filtrar por marca o por lo que hay */
  function base() {
    var l = cat.productos.filter(function (p) { return !estado.categoria || p.categoria === estado.categoria; });
    var PE = /** @type {any} */ (window).PE;
    var q = estado.q.trim();
    if (q) {
      if (PE && PE.buscar && PE.palabrasBuscadas && PE.palabrasBuscadas(q).length) l = PE.buscar(l, q, null);
      else if (!PE || !PE.buscar) l = l.filter(function (p) { return norm(p.nombre).indexOf(norm(q)) >= 0; });
    }
    return l;
  }

  function pintarListado() {
    var l = base(), marcas = {};
    l.forEach(function (p) { var m = marcaDe(p); if (m) marcas[m] = (marcas[m] || 0) + 1; });
    var hayAgotados = l.some(function (p) { return !p.disponible; });
    var filtrada = l.filter(function (p) {
      if (estado.hay && !p.disponible) return false;
      return !estado.marcas.length || estado.marcas.indexOf(marcaDe(p)) >= 0;
    });
    if (!estado.q.trim() || estado.orden !== 'pedidos') filtrada = ordenar(filtrada, estado.orden);

    var c = cat.cats[estado.categoria];
    var titulo = c ? c.nombre : (estado.q.trim() ? 'Resultados para «' + estado.q.trim() + '»' : 'Todos los productos');
    $('catTitulo').textContent = titulo;
    document.title = titulo + ' — Plásticos Espinal';
    $('migaActual').textContent = titulo;
    $('migaActual').hidden = !c && !estado.q.trim();
    $('catConteo').textContent = filtrada.length === 1 ? '1 producto' : filtrada.length + ' productos';

    /* Pestañas de categorías (arriba) y lista de la columna: la puesta, marcada */
    document.querySelectorAll('[data-cat-id]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.catId === estado.categoria));
    });

    /* Marca: solo si hay de dónde escoger */
    var nombres = Object.keys(marcas).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    var listaM = $('listaMarcas');
    listaM.textContent = '';
    nombres.forEach(function (m) {
      var li = el('li'), lab = el('label', 'casilla'), inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'checkbox'; inp.value = m; inp.checked = estado.marcas.indexOf(m) >= 0;
      inp.addEventListener('change', function () {
        estado.marcas = inp.checked ? estado.marcas.concat(m) : estado.marcas.filter(function (x) { return x !== m; });
        pintarListado();
      });
      lab.append(inp, el('span', null, m), el('small', 'casilla__n', String(marcas[m])));
      li.appendChild(lab); listaM.appendChild(li);
    });
    $('bloqueMarcas').hidden = nombres.length < 2;
    $('bloqueHay').hidden = !hayAgotados && !estado.hay;
    /** @type {HTMLInputElement} */ ($('soloHay')).checked = estado.hay;
    /* Sin marcas ni agotados no hay qué filtrar: la rejilla usa todo el ancho */
    var sinFiltros = $('bloqueMarcas').hidden && $('bloqueHay').hidden;
    $('catFiltros').hidden = sinFiltros;
    $('catCuerpoInterno').classList.toggle('sin-filtros', sinFiltros);

    var rejilla = $('catRejilla');
    rejilla.textContent = '';
    filtrada.forEach(function (p) { rejilla.appendChild(tarjeta(p, { alAbrir: abrirFicha })); });
    var vacio = !filtrada.length;
    $('catVacio').hidden = !vacio;
    if (vacio) {
      var pedido = estado.q.trim() || (c ? c.nombre : '');
      /** @type {HTMLAnchorElement} */ ($('catVacioWa')).href = waTexto('Hola, Plásticos Espinal 👋 Busco: ' + (pedido || 'un producto') + '. ¿Lo tienen?');
    }
  }

  function pintarCategoriasCatalogo() {
    var banda = $('catPestanas');
    /** @param {string} id @param {string} nombre @param {number} n */
    function boton(id, nombre, n) {
      var b = /** @type {HTMLButtonElement} */ (el('button', 'pestana-cat'));
      b.type = 'button'; b.dataset.catId = id;
      b.append(el('span', null, nombre), el('small', 'pestana-cat__n', String(n)));
      b.addEventListener('click', function () {
        estado.categoria = id; estado.marcas = [];
        escribirDireccion(true);
        pintarListado();
        var lista2 = $('listado');
        if (lista2.getBoundingClientRect().top < 0) lista2.scrollIntoView({ behavior: menosMovimiento ? 'auto' : 'smooth' });
      });
      banda.appendChild(b);
    }
    boton('', 'Todos', cat.productos.length);
    cat.categorias.forEach(function (c) { boton(c.id, c.nombre, c.n); });
  }

  /* ---------- Ficha de un producto (?p=ID) ---------- */
  /** @param {Producto} p */
  function abrirFicha(p) {
    history.pushState({ ficha: p.id }, '', urlFicha(p.id));
    pintarFicha(p);
    window.scrollTo({ top: 0, behavior: 'auto' });
    var t = $('fichaTitulo');
    t.focus({ preventScroll: true });
  }

  /** @param {Producto} p */
  function pintarFicha(p) {
    $('listado').hidden = true;
    $('ficha').hidden = false;
    var c = cat.cats[p.categoria];
    document.title = p.nombre + ' — Plásticos Espinal';
    $('migaActual').hidden = false;
    $('migaActual').textContent = p.nombre;
    var migaCat = $('migaCategoria'), enlaceCat = /** @type {HTMLAnchorElement} */ (migaCat.querySelector('a'));
    migaCat.hidden = !c;
    if (c) { enlaceCat.textContent = c.nombre; enlaceCat.href = '/productos/?categoria=' + c.slug; }

    /* Fotos: la grande y las miniaturas */
    var fotos = fotosDe(p), grande = /** @type {HTMLImageElement} */ ($('fichaFoto')), minis = $('fichaMinis');
    grande.src = fotos[0] || referencia(p);
    grande.alt = fotos.length ? p.nombre : 'Foto de referencia de ' + (c ? c.nombre.toLowerCase() : 'el producto');
    $('fichaRef').hidden = !!fotos.length;
    minis.textContent = '';
    minis.hidden = fotos.length < 2;
    fotos.forEach(function (url, i) {
      var b = /** @type {HTMLButtonElement} */ (el('button', 'ficha-pub__mini')), im = /** @type {HTMLImageElement} */ (el('img'));
      b.type = 'button';
      b.setAttribute('aria-label', 'Ver foto ' + (i + 1) + ' de ' + fotos.length);
      b.setAttribute('aria-pressed', String(i === 0));
      im.src = url; im.alt = ''; im.loading = 'lazy'; im.width = 80; im.height = 80;
      b.appendChild(im);
      b.addEventListener('click', function () {
        grande.src = url;
        minis.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      minis.appendChild(b);
    });

    $('fichaCat').textContent = c ? c.nombre : '';
    $('fichaTitulo').textContent = p.nombre;
    $('fichaCodigo').textContent = 'Código ' + p.id;
    var disp = $('fichaDisp');
    disp.textContent = p.disponible ? 'Disponible hoy' : 'Agotado por ahora: pregúntenos cuándo llega';
    disp.classList.toggle('es-agotado', !p.disponible);
    var pedir = /** @type {HTMLAnchorElement} */ ($('fichaPedir'));
    pedir.href = enlaceWa(p);
    $('fichaPedirTexto').textContent = p.disponible ? 'Pedir por WhatsApp' : 'Preguntar por WhatsApp';

    /* Pestañas: descripción (si la hay), características (si las hay) y domicilio */
    var desc = p.descripcion || '';
    var dets = (p.detalles || []).slice();
    if (p.contenido && !dets.some(function (d) { return norm(d.nombre) === 'contenido'; })) {
      dets.push({ nombre: 'Contenido', valor: p.contenido.cantidad + ' ' + p.contenido.unidad });
    }
    $('tabDesc').hidden = !desc;
    $('fichaDesc').textContent = desc;
    $('tabCaract').hidden = !dets.length;
    var dl = $('fichaCaract');
    dl.textContent = '';
    dets.forEach(function (d) { var f = el('div'); f.append(el('dt', null, d.nombre), el('dd', null, d.valor)); dl.appendChild(f); });
    if (pestanasFicha) pestanasFicha.primera();   /* la primera pestaña que se ve queda abierta */

    /* Parecidos: misma categoría, primero los que hay y los más pedidos */
    var parecidos = ordenar(cat.productos.filter(function (o) { return o.categoria === p.categoria && o.id !== p.id; }), 'pedidos').slice(0, 8);
    var ul = $('fichaParecidos');
    ul.textContent = '';
    parecidos.forEach(function (o) { ul.appendChild(tarjeta(o, { compacta: true, alAbrir: abrirFicha })); });
    $('parecidosCaja').hidden = !parecidos.length;
    var volver = /** @type {HTMLAnchorElement} */ ($('fichaVolver'));
    volver.href = c ? '/productos/?categoria=' + c.slug : '/productos/';
    $('fichaVolverTexto').textContent = c ? 'Ver más de ' + c.nombre.toLowerCase() : 'Ver todos los productos';
  }

  function verListado() {
    $('ficha').hidden = true;
    $('listado').hidden = false;
    $('migaCategoria').hidden = true;
    pintarListado();
  }

  /** Lo que dice la dirección: una ficha o el listado */
  function segunDireccion() {
    var id = leerDireccion();
    /** @type {HTMLInputElement} */ ($('catBuscar')).value = estado.q;
    var p = id ? cat.por[String(Number(id))] : null;
    if (p) pintarFicha(p); else verListado();
  }

  function catalogo() {
    var raizCat = document.querySelector('[data-catalogo]');
    if (!raizCat) return;
    cargar().then(function () {
      $('catEstado').hidden = true;
      $('catCuerpo').hidden = false;
      pintarCategoriasCatalogo();
      var buscar = /** @type {HTMLInputElement} */ ($('catBuscar')), espera = 0;
      buscar.addEventListener('input', function () {
        clearTimeout(espera);
        espera = window.setTimeout(function () {
          estado.q = buscar.value.slice(0, 80);
          estado.marcas = [];
          if (estado.q.trim()) estado.categoria = '';
          escribirDireccion(false);
          if (!$('ficha').hidden) verListado(); else pintarListado();
        }, 150);
      });
      $('catBuscarForm').addEventListener('submit', function (e) { e.preventDefault(); buscar.blur(); });
      $('catOrden').addEventListener('change', function () {
        estado.orden = /** @type {HTMLSelectElement} */ ($('catOrden')).value;
        pintarListado();
      });
      $('soloHay').addEventListener('change', function () {
        estado.hay = /** @type {HTMLInputElement} */ ($('soloHay')).checked;
        pintarListado();
      });
      $('fichaVolver').addEventListener('click', function (e) {
        var me = /** @type {MouseEvent} */ (e);
        if (me.metaKey || me.ctrlKey || me.shiftKey) return;
        e.preventDefault();
        history.pushState(null, '', /** @type {HTMLAnchorElement} */ ($('fichaVolver')).href);
        segunDireccion();
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
      pestanasFicha = pestanas(/** @type {HTMLElement} */ ($('fichaPestanas')));
      window.addEventListener('popstate', segunDireccion);
      segunDireccion();
    }).catch(function () {
      /* Sin catálogo: el aviso y WhatsApp con lo que venía buscando */
      var u = new URLSearchParams(location.search), pedido = u.get('categoria') || u.get('q') || '';
      $('catEstado').hidden = true;
      $('catFalla').hidden = false;
      /** @type {HTMLAnchorElement} */ ($('catFallaWa')).href = waTexto('Hola, Plásticos Espinal 👋 Quiero cotizar' + (pedido ? ' ' + pedido.replace(/-/g, ' ') : ' productos') + '.');
    });
  }

  inicio();
  catalogo();
})();
