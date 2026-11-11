/* Plásticos Espinal · catálogo público (sin precios: decisión de Johan, 9-nov-2026).
   Lo usa /productos/ ([data-catalogo]): categorías como pestañas, buscador, filtros plegables
   (marca, medida, color, contenido y lo que hay), orden y la ficha de cada producto (?p=ID)
   con fotos, pestañas de descripción y características, y productos parecidos.
   El inicio ya no lo carga: sus tarjetas «Así se ven en su negocio» van escritas en index.html
   (Johan, 10-nov-2026), así que el inicio no depende del CRM.
   Los datos salen de /api/catalogo (functions/api/catalogo.js, que habla con el CRM). Cada
   producto se pide por WhatsApp. Si el catálogo no carga, la página lo dice y ofrece WhatsApp. */
(function () {
  'use strict';

  var API = '/api/catalogo';
  var FOTOS = '/api/foto/';
  var WA = '573183555246';
  var TIENDA = 'https://tienda.plasticosespinal.com/';
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

  /** @typedef {{ id: number, nombre: string, categoria: string, sub?: string, disponible: boolean, destacado: boolean, foto: string,
   *   fotos: string[], contenido?: { cantidad: number, unidad: string }, descripcion?: string,
   *   detalles?: { nombre: string, valor: string }[] }} Producto */
  /** @typedef {{ id: string, nombre: string, slug: string, n: number }} Categoria */

  /** @type {{ categorias: Categoria[], productos: Producto[], por: Record<string, Producto>, cats: Record<string, Categoria>, alias: Record<string, Categoria> }} */
  var cat = { categorias: [], productos: [], por: {}, cats: {}, alias: {} };

  /* ---------- Datos ---------- */
  function cargar() {
    return fetch(API, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.productos) || !d.productos.length) throw new Error('vacío');
        cat.productos = d.productos.filter(function (/** @type {any} */ p) { return p && p.id && p.nombre; });
        cat.productos.forEach(function (p) { cat.por[String(p.id)] = p; });
        agrupar(Array.isArray(d.categorias) ? d.categorias : []);
      });
  }

  /* Familias de categorías: el CRM a veces parte una en varias («Aluminio» y «Papel Aluminio»,
     «Vasos» y «Vasos Gold», «Bolsas», «Bolsas Manija» y «Bolsas de Papel»). La que tiene todas
     sus palabras dentro de otra se la lleva: el cliente ve una sola pestaña con todos sus productos.
     Cada producto queda con la categoría de su familia; la del CRM se guarda en «sub». La que junta
     varias cosas con «y» o comas («Vasos y platos») no entra en otra. */
  var VACIAS = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'para', 'con', 'en', 'por', 'a'];
  /** @param {string} nombre */
  function palabrasDe(nombre) {
    return slug(nombre).split('-').filter(function (w) { return w && VACIAS.indexOf(w) < 0; }).map(raiz);
  }
  /** @param {any[]} crudas */
  function agrupar(crudas) {
    var lista = crudas.map(function (/** @type {any} */ c) {
      var id = String(c.id);
      return { id: id, nombre: String(c.nombre), palabras: palabrasDe(String(c.nombre)),
        n: cat.productos.filter(function (p) { return p.categoria === id; }).length };
    });
    /** @type {Record<string, string>} */
    var familiaDe = {};
    lista.forEach(function (c) {
      /* Una que junta varias cosas («Vasos y platos») es su propia familia: no se la lleva ninguna */
      if (/\s(y|e)\s|,/i.test(c.nombre)) { familiaDe[c.id] = c.id; return; }
      /* Las que caben en esta (ella incluida): manda la más corta; empate, la de más productos */
      var dentro = lista.filter(function (o) {
        return o.palabras.length > 0 && o.palabras.every(function (w) { return c.palabras.indexOf(w) >= 0; });
      }).sort(function (a, b) {
        return (a.palabras.length - b.palabras.length) || (b.n - a.n) || a.nombre.localeCompare(b.nombre, 'es');
      });
      familiaDe[c.id] = (dentro[0] || c).id;
    });
    cat.alias = {};
    cat.productos.forEach(function (p) {
      if (!familiaDe[p.categoria]) return;
      p.sub = p.categoria;
      p.categoria = familiaDe[p.categoria];
    });
    cat.categorias = lista.filter(function (c) { return familiaDe[c.id] === c.id; }).map(function (c) {
      var n = cat.productos.filter(function (p) { return p.categoria === c.id; }).length;
      return { id: c.id, nombre: c.nombre, slug: slug(c.nombre), n: n };
    }).filter(function (c) { return c.n > 0; });
    cat.categorias.forEach(function (c) { cat.cats[c.id] = c; });
    /* Los enlaces viejos a una parte (?categoria=papel-aluminio) abren su familia */
    lista.forEach(function (c) { var f = cat.cats[familiaDe[c.id]]; if (f) cat.alias[slug(c.nombre)] = f; });
  }

  /* La foto «en uso» de un producto es la segunda que manda el CRM: una escena hecha con IA a partir
     del producto. Va de primera en la tarjeta y en la ficha (Johan, 10-nov-2026: la página «tiene que
     ser muy visual» y «que incite a comprar»); la principal, el producto con su medida, queda de
     segunda. En estos códigos la segunda es otra cara del paquete, no una escena: siguen con la
     principal de primera hasta que tengan su foto en uso en el CRM. */
  var SIN_FOTO_EN_USO = [118, 398, 856];
  /** @param {Producto} p */
  function tieneEnUso(p) { return !!p.fotos && p.fotos.length > 1 && SIN_FOTO_EN_USO.indexOf(p.id) < 0; }
  /** Las fotos del producto, en el orden en que se muestran @param {Producto} p */
  function fotosDe(p) {
    var lista = (p.fotos && p.fotos.length ? p.fotos.slice() : (p.foto ? [p.foto] : []));
    if (tieneEnUso(p)) lista.unshift(lista.splice(1, 1)[0]);
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
  /** Una característica del producto (marca, medida, color, contenido), o '' @param {Producto} p @param {string} clave */
  function valorDe(p, clave) {
    var d = (p.detalles || []).filter(function (x) { return norm(x.nombre) === clave; })[0];
    if (d) return String(d.valor).trim();
    if (clave === 'contenido' && p.contenido) return 'x' + p.contenido.cantidad + ' ' + p.contenido.unidad;
    return '';
  }
  /** «30K» y «30k» son el mismo valor @param {string} v */
  function llaveDe(v) { return norm(v).replace(/\s+/g, ' ').trim(); }
  /** @param {Producto} p */
  function enlaceWa(p) {
    var texto = 'Hola, Plásticos Espinal 👋 Tengo una pregunta sobre: ' + p.nombre + ' (código ' + p.id + ').';
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto);
  }
  /** @param {string} texto */
  function waTexto(texto) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(texto); }
  /** @param {number} id */
  function urlFicha(id) { return '/productos/?p=' + id; }

  /* ---------- Tarjeta de producto (catálogo y parecidos) ---------- */
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
    /* Sin botón de WhatsApp en cada tarjeta (Johan, 10-nov-2026: «le estamos vendiendo demasiado»): toda
       la tarjeta abre la ficha, que explica el producto y tiene el único «Pedir por WhatsApp» */
    var ver = el('span', 'tarjeta-prod__ver', 'Ver detalles');
    ver.setAttribute('aria-hidden', 'true');
    ver.appendChild(icono('i-flecha', 'icono'));
    cuerpo.appendChild(ver);
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

  /* ---------- Pestañas accesibles (ficha) ---------- */
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
     /productos/: listado con filtros y ficha
     ====================================================================== */
  /* Filtros de la columna: salen de las características que manda el CRM. En uno se pueden
     marcar varios valores (cualquiera de ellos sirve); entre filtros, tienen que cumplirse todos. */
  var FACETAS = [
    { clave: 'marca', titulo: 'Marca', natural: false },
    { clave: 'medida', titulo: 'Medida', natural: true },
    { clave: 'color', titulo: 'Color', natural: false },
    { clave: 'contenido', titulo: 'Contenido', natural: true }
  ];
  var VISIBLES = 6;   /* valores que se ven antes de «Ver más» */
  /** @returns {Record<string, string[]>} */
  function sinFiltros() { var f = /** @type {Record<string, string[]>} */ ({}); FACETAS.forEach(function (x) { f[x.clave] = []; }); return f; }
  var estado = { categoria: '', q: '', filtros: sinFiltros(), hay: false, orden: 'pedidos' };
  /* Qué bloques están abiertos y cuáles muestran todos sus valores (sobrevive a cada repintada) */
  var abiertos = /** @type {Record<string, boolean>} */ ({ marca: true, hay: true });
  var todosVisibles = /** @type {Record<string, boolean>} */ ({});
  /** @type {{ primera: () => void } | null} */
  var pestanasFicha = null;

  /** La categoría de ?categoria=…: igual al nombre, o que lo contenga (vasos → «Vasos y platos») @param {string} pedido */
  function categoriaDe(pedido) {
    var s = slug(pedido);
    if (!s) return null;
    var exacta = cat.categorias.filter(function (c) { return c.slug === s; })[0] || cat.alias[s];
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
    estado.filtros = sinFiltros(); estado.hay = false;
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

  /** ¿Pasa el producto los filtros puestos? Sin contar uno (para contar sus valores) @param {Producto} p @param {string} [menos] */
  function pasa(p, menos) {
    if (estado.hay && !p.disponible && menos !== 'hay') return false;
    return FACETAS.every(function (f) {
      var sel = estado.filtros[f.clave];
      return f.clave === menos || !sel.length || sel.indexOf(llaveDe(valorDe(p, f.clave))) >= 0;
    });
  }
  function cuantosFiltros() {
    return FACETAS.reduce(function (n, f) { return n + estado.filtros[f.clave].length; }, 0) + Number(estado.hay);
  }

  /** Un bloque plegable de la columna @param {{ clave: string, titulo: string, natural: boolean }} f @param {Producto[]} l */
  function bloqueFaceta(f, l) {
    var sel = estado.filtros[f.clave];
    /* Cada valor cuenta los productos que quedarían con los demás filtros puestos */
    var cuenta = /** @type {Record<string, { v: string, n: number }>} */ ({});
    l.forEach(function (p) {
      if (!pasa(p, f.clave)) return;
      var v = valorDe(p, f.clave), k = llaveDe(v);
      if (!k) return;
      if (!cuenta[k]) cuenta[k] = { v: v, n: 0 };
      cuenta[k].n++;
    });
    sel.forEach(function (k) { if (!cuenta[k]) cuenta[k] = { v: k, n: 0 }; });   /* lo marcado nunca se esconde */
    var llaves = Object.keys(cuenta);
    if (llaves.length < 2 && !sel.length) return null;
    var limpio = function (/** @type {string} */ v) { return v.replace(/^[^0-9a-z]+/i, ''); };
    llaves.sort(function (a, b) {
      return f.natural ? limpio(cuenta[a].v).localeCompare(limpio(cuenta[b].v), 'es', { numeric: true, sensitivity: 'base' })
        : (cuenta[b].n - cuenta[a].n) || cuenta[a].v.localeCompare(cuenta[b].v, 'es');
    });

    var bloque = el('div', 'filtro-bloque');
    bloque.id = 'bloque-' + f.clave;
    var cuerpo = el('div', 'filtro-bloque__cuerpo');
    cuerpo.id = 'faceta-' + f.clave;
    cuerpo.hidden = !abiertos[f.clave];
    bloque.append(cabezaBloque(f.clave, f.titulo, sel.length, cuerpo.id), cuerpo);

    var ul = el('ul', 'filtro-lista');
    ul.id = 'lista-' + f.clave;
    var todos = !!todosVisibles[f.clave], escondidos = 0;
    llaves.forEach(function (k, i) {
      var li = el('li'), lab = el('label', 'casilla'), inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.type = 'checkbox'; inp.value = k; inp.checked = sel.indexOf(k) >= 0;
      inp.addEventListener('change', function () {
        estado.filtros[f.clave] = inp.checked ? sel.concat(k) : sel.filter(function (x) { return x !== k; });
        pintarListado();
        var otra = /** @type {HTMLInputElement | null} */ (document.querySelector('#lista-' + f.clave + ' input[value="' + CSS.escape(k) + '"]'));
        if (otra) otra.focus();
      });
      lab.append(inp, el('span', null, cuenta[k].v), el('small', 'casilla__n', String(cuenta[k].n)));
      li.appendChild(lab);
      if (!todos && i >= VISIBLES && !inp.checked) { li.hidden = true; escondidos++; }
      ul.appendChild(li);
    });
    cuerpo.appendChild(ul);
    if (escondidos || (todos && llaves.length > VISIBLES)) {
      var mas = /** @type {HTMLButtonElement} */ (el('button', 'filtro-bloque__mas', todos ? 'Ver menos' : 'Ver ' + escondidos + ' más'));
      mas.type = 'button';
      mas.setAttribute('aria-controls', ul.id);
      mas.addEventListener('click', function () {
        todosVisibles[f.clave] = !todos;
        pintarListado();
        var b = document.querySelector('#bloque-' + f.clave + ' .filtro-bloque__mas');
        if (b) /** @type {HTMLElement} */ (b).focus();
      });
      cuerpo.appendChild(mas);
    }
    return bloque;
  }

  /** El título de un bloque: un botón que lo abre y lo cierra @param {string} clave @param {string} titulo @param {number} n @param {string} controla */
  function cabezaBloque(clave, titulo, n, controla) {
    var h = el('h2', 'filtro-bloque__cabeza');
    var b = /** @type {HTMLButtonElement} */ (el('button', 'filtro-bloque__titulo'));
    b.type = 'button';
    b.dataset.plegar = clave;
    b.setAttribute('aria-expanded', String(!!abiertos[clave]));
    b.setAttribute('aria-controls', controla);
    b.appendChild(el('span', null, titulo));
    if (n) b.appendChild(el('small', 'filtro-bloque__marcados', n + (n === 1 ? ' marcado' : ' marcados')));
    h.appendChild(b);
    return h;
  }

  function pintarListado() {
    var l = base();
    var hayAgotados = l.some(function (p) { return !p.disponible; });
    var filtrada = l.filter(function (p) { return pasa(p); });
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

    /* Filtros: solo los que tienen de dónde escoger en lo que se está mirando */
    var facetas = $('catFacetas');
    facetas.textContent = '';
    FACETAS.forEach(function (f) { var b = bloqueFaceta(f, l); if (b) facetas.appendChild(b); });
    $('bloqueHay').hidden = !hayAgotados && !estado.hay;
    /** @type {HTMLInputElement} */ ($('soloHay')).checked = estado.hay;
    var n = cuantosFiltros();
    $('quitarFiltros').hidden = !n;
    $('filtrosN').textContent = n ? String(n) : '';
    $('filtrosN').hidden = !n;
    /* Sin nada que filtrar: la rejilla usa todo el ancho y no sale el botón «Filtros» */
    var nada = !facetas.children.length && $('bloqueHay').hidden;
    $('catFiltros').hidden = nada;
    $('verFiltros').hidden = nada;
    $('catCuerpoInterno').classList.toggle('sin-filtros', nada);

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
        estado.categoria = id; estado.filtros = sinFiltros();
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
    /* La primera puede ser la foto en uso: su texto lo dice, para quien no la ve */
    var textoDe = function (/** @type {number} */ i) { return p.nombre + (i === 0 && tieneEnUso(p) ? ', en uso' : ''); };
    grande.src = fotos[0] || referencia(p);
    grande.alt = fotos.length ? textoDe(0) : 'Foto de referencia de ' + (c ? c.nombre.toLowerCase() : 'el producto');
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
        grande.src = url; grande.alt = textoDe(i);
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
    /* Se pide en la tienda (Johan, 11-nov-2026): la ficha abre el mismo producto allá; WhatsApp queda para dudas */
    var pedir = /** @type {HTMLAnchorElement} */ ($('fichaPedir'));
    pedir.href = TIENDA + '#p=' + encodeURIComponent(String(p.id));
    $('fichaPedirTexto').textContent = p.disponible ? 'Pedir en la tienda' : 'Ver en la tienda';
    var preguntar = /** @type {HTMLAnchorElement} */ ($('fichaPreguntar'));
    if (preguntar) preguntar.href = enlaceWa(p);

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
    var ul = $('fichaParecidos');   /* rejilla quieta: 6 en celular y tableta, 8 en computador */
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
          /* Buscar desde la ficha de un producto: se pasa al listado y «atrás» vuelve a esa ficha.
             Con la casilla vacía no se saca a nadie del producto que está mirando. */
          var q = buscar.value.slice(0, 80), desdeFicha = !$('ficha').hidden;
          if (desdeFicha && !q.trim()) return;
          estado.q = q;
          estado.filtros = sinFiltros();
          if (estado.q.trim()) estado.categoria = '';
          escribirDireccion(desdeFicha);
          if (desdeFicha) { verListado(); window.scrollTo({ top: 0, behavior: 'auto' }); } else pintarListado();
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
      /* Cada bloque de filtros se pliega como una lista; se acuerda mientras se navega */
      $('catFiltros').addEventListener('click', function (e) {
        var b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-plegar]'));
        if (!b) return;
        var clave = b.dataset.plegar || '', abierto = b.getAttribute('aria-expanded') !== 'true';
        abiertos[clave] = abierto;
        b.setAttribute('aria-expanded', String(abierto));
        var cuerpo = $(b.getAttribute('aria-controls') || '');
        if (cuerpo) cuerpo.hidden = !abierto;
      });
      $('quitarFiltros').addEventListener('click', function () {
        estado.filtros = sinFiltros(); estado.hay = false;
        pintarListado();
        $('catTitulo').focus({ preventScroll: true });
      });
      /* En celular y tableta los filtros van plegados detrás de un botón, para ver los productos de una */
      var ver = $('verFiltros');
      ver.addEventListener('click', function () {
        var abrir = ver.getAttribute('aria-expanded') !== 'true';
        ver.setAttribute('aria-expanded', String(abrir));
        $('catFiltros').classList.toggle('esta-abierto', abrir);
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

  catalogo();
})();
