/* Plásticos Espinal · tienda en línea (versión de prueba, detrás de contraseña).
   Los productos salen del CRM (precio y si hay o no; nunca cuántas quedan).
   /tienda/catalogo.json solo trae lo de la página: QR, WhatsApp, fotos, horario, sinónimos, entrega y
   quién vende. Todo eso es opcional: si falta, viene mal escrito o no carga, la tienda sigue sin ello.
   «Pedir ya» → datos de entrega → el pedido entra al CRM «Por confirmar»
   (por el intermediario /tienda/mi-cuenta/api/tienda/…) → medio de pago (QR
   Bre-B o efectivo) → pantalla del pedido, que pregunta cada tanto en qué va.
   El pedido en curso (código + secreto) queda en este celular. Cada producto tiene
   su ficha (<dialog>) con dirección propia, #p=ID, para compartir. También en este
   celular: favoritos (el corazón), lo visto hace poco y el último pedido enviado,
   para pedirlo otra vez en un toque (PE.guardado: tienda/guardados.js). En los datos de
   entrega, «Usar mi ubicación actual» suma el punto del GPS si cae en El Espinal
   (tienda/ubicacion.js). Datos de la base: siempre textContent. */
(function () {
  'use strict';

  var CLAVE = 'pe-canasta-v1';
  var CLAVE_DATOS = 'pe-cliente-v1';   /* datos de entrega, solo en este celular */
  var CLAVE_PEDIDO = 'pe-pedido-v1';   /* pedido en curso: código + secreto */
  var CLAVE_FAVORITOS = 'pe-favoritos-v1', MAX_FAVORITOS = 100;   /* ids, el último guardado primero */
  var CLAVE_VISTOS = 'pe-vistos-v1', MAX_VISTOS = 12;             /* ids de lo que se abrió en ficha, lo último primero */
  var CLAVE_ULTIMO = 'pe-ultimo-v1';   /* líneas { id, cantidad } del último pedido enviado desde este celular */
  var API = '/tienda/mi-cuenta/api/tienda/pedido';
  var CATALOGO = '/tienda/mi-cuenta/api/tienda/catalogo';
  var CADA = 5000;                     /* cada cuánto pregunta en qué va el pedido */
  var MAX_INDICACIONES = 300;          /* el CRM corta las indicaciones a esto: el enlace del mapa va primero */
  /* Barrios de El Espinal para sugerir (lista parcial: el cliente puede escribir otro) */
  var BARRIOS = ['Arkabal', 'Balkanes', 'Belén', 'Betania', 'Betania Campestre', 'Bosques de Roa',
    'Caballero y Góngora', 'Cafasur', 'El Centro', 'Entre Ríos', 'Fátima', 'Isaías Olivar',
    'La Cascada', 'La Esperanza', 'Libertador', 'Nacional', 'Primero de Mayo', 'Rondón',
    'San Rafael', 'Santa Margarita María', 'Talura', 'Villa Catalina', 'Villa Ceiba',
    'Villa Laura', 'Villa Lorena', 'Villa Paz'];
  var CAMPOS = { nombre: 'd-nombre', tipo: 'd-tipo', documento: 'd-doc', celular: 'd-cel',
    barrio: 'd-barrio', direccion: 'd-dir', extra: 'd-extra' };   /* dato -> campo */
  var cat = null;                 /* catálogo */
  var por = {};                   /* id -> producto */
  var cats = {};                  /* id -> categoría */
  var canasta = leer();           /* { id: cantidad } */
  var filtro = { cat: '', q: '', todo: false };
  var pedido = leerPedido();     /* { codigo, secreto, estado… } o null */
  var reloj = null, relojQr = null;
  var franjaBase = null, conHora = false;   /* franja de arriba: lo que trae el HTML y si ya dice la hora */
  var ficha = { id: null, empujada: false, desde: null, alto: null };   /* ficha abierta: cuál, si un toque empujó su entrada del historial, quién la abrió y dónde estaba la vitrina al abrirla */
  var guardados = null;           /* { favoritos, vistos, ultimo }; null si guardados.js no cargó (sin corazones ni secciones) */
  var buscando = false;           /* hay algo escrito en el buscador: favoritos y vistos se esconden */
  var enlaceUbicacion = '';       /* enlace del mapa de ESTE pedido; solo en memoria, nunca en pe-cliente-v1 */
  var busquedaGps = 0;            /* número de la búsqueda de ubicación en curso; subirlo descarta la respuesta que llegue tarde */

  var $ = function (i) { return document.getElementById(i); };
  var formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  function pesos(n) { return '$' + formato.format(Math.round(n)); }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  /* Lo que es un extra (hora de llegada, favoritos, ubicación, la ficha de la dirección…) no tumba la tienda:
     si lanza, se anota en la consola y se sigue con lo demás. Devuelve lo que devuelva fn, o undefined. */
  function intentar(fn) {
    try { return fn(); } catch (e) {
      try { if (window.console && console.warn) console.warn('Tienda: se sigue sin esto:', e); } catch (e2) { /* sin consola */ }
      return undefined;
    }
  }

  /* ---------- Guardado en el navegador (si falla, la canasta vive solo en memoria) ---------- */
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(canasta)); } catch (e) { /* sin almacenamiento */ } }
  function leerDatos() { try { return JSON.parse(localStorage.getItem(CLAVE_DATOS)) || {}; } catch (e) { return {}; } }
  function guardarDatos(d) { try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } }
  function leerPedido() { try { return JSON.parse(localStorage.getItem(CLAVE_PEDIDO)) || null; } catch (e) { return null; } }
  function guardarPedido(p) {
    try { if (p) localStorage.setItem(CLAVE_PEDIDO, JSON.stringify(p)); else localStorage.removeItem(CLAVE_PEDIDO); } catch (e) { /* sin almacenamiento */ }
  }

  /* La foto propia del producto la trae el CRM (por el intermediario, mismo sitio);
     sin ella, la de su categoría o la de la bodega. */
  var FOTOS = '/tienda/mi-cuenta/api/tienda/foto/';
  function foto(p) {
    if (p.foto) return FOTOS + encodeURIComponent(p.foto);
    return (cats[p.categoria] || {}).imagen || '/img/productos/bodega.webp';
  }

  /* Con dos o más fotos del CRM (la principal y la del producto en uso), la
     tarjeta las pasa con el dedo o con los puntos de abajo. */
  function carrusel(f, fotos) {
    var tira = el('div', 'tira'), puntos = el('div', 'puntos');
    fotos.forEach(function (nombre, n) {
      var i = el('img');
      i.src = FOTOS + encodeURIComponent(nombre); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
      tira.appendChild(i);
      var b = el('button', 'punto');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ver foto ' + (n + 1) + ' de ' + fotos.length);
      b.setAttribute('aria-current', String(n === 0));
      b.addEventListener('click', function () { tira.scrollTo({ left: n * tira.clientWidth, behavior: 'smooth' }); });
      puntos.appendChild(b);
    });
    tira.addEventListener('scroll', function () {
      var n = Math.round(tira.scrollLeft / Math.max(1, tira.clientWidth));
      Array.prototype.forEach.call(puntos.children, function (b, k) { b.setAttribute('aria-current', String(k === n)); });
    }, { passive: true });
    f.append(tira, puntos);
  }

  /* ---------- Hora de llegada (PE.llegada, según el horario de tienda/catalogo.json) ---------- */
  /* La franja de arriba y la canasta dicen cuándo llega un pedido hecho ahora. Sin horario
     (o si llegada.js no cargó, o no abre en 14 días) queda el texto que trae el HTML. */
  function pintarLlegada() {
    var franja = $('franjaLlegada'), nota = $('llegada');
    var r = cat && cat.horario && window.PE && window.PE.llegada
      ? intentar(function () { return window.PE.llegada(new Date(), cat.horario); }) || null : null;
    if (!franjaBase) franjaBase = Array.prototype.map.call(franja.childNodes, function (n) { return n.cloneNode(true); });
    if (r) {
      if (franja.textContent !== '🛵 ' + r.texto) franja.textContent = '🛵 ' + r.texto;
      conHora = true;
    } else if (conHora) {
      franja.textContent = '';
      franjaBase.forEach(function (n) { franja.appendChild(n.cloneNode(true)); });
      conHora = false;
    }
    if (nota.textContent !== (r ? r.texto : '')) nota.textContent = r ? r.texto : '';
    nota.hidden = !r;
  }

  /* ---------- Cuentas ---------- */
  function cuentas() {
    var n = 0, s = 0;
    Object.keys(canasta).forEach(function (id) { n += canasta[id]; s += canasta[id] * por[id].precio; });
    var d = s === 0 || s >= cat.domicilio.gratis_desde ? 0 : cat.domicilio.tarifa;
    return { n: n, s: s, d: d, t: s + d };
  }
  function cambiar(id, d) { poner(id, (canasta[id] || 0) + d); }
  function poner(id, n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) delete canasta[id]; else canasta[id] = Math.min(n, 999);
    guardar(); refrescar(id); pintarCanasta();
  }
  /* Solo cambia el botón de ESE producto (en la vitrina y en su ficha): la vitrina no se
     vuelve a pintar entera (las fotos no parpadean ni la página salta) */
  function refrescar(id) {
    document.querySelectorAll('#grilla [data-ctrl="' + id + '"], #ficha [data-ctrl="' + id + '"]').forEach(function (v) {
      var nuevo = control(por[id]), enFicha = !!v.closest('#ficha');
      var tenia = enFicha && v.contains(document.activeElement) ? document.activeElement : null;
      nuevo.dataset.ctrl = id;
      v.replaceWith(nuevo);
      /* Dentro de la ficha el foco no se pierde al cambiar el botón: sigue en el lado que se tocó */
      if (tenia && tenia.tagName === 'BUTTON') {
        var botones = nuevo.querySelectorAll('button');
        var vuelve = tenia.textContent === '−' ? botones[0] : botones[botones.length - 1];
        if (vuelve) vuelve.focus();
      }
    });
  }

  /* ---------- Selector − n + ---------- */
  function control(p) {
    var n = canasta[p.id] || 0, w = el('div');
    if (!n) {
      var b = el('button', 'mas', '+ Agregar');
      b.type = 'button';
      if (!p.disponible) {
        b.textContent = 'Agotado'; b.disabled = true; b.className = 'mas agotado';
        w.appendChild(b);
        return w;
      }
      b.setAttribute('aria-label', 'Agregar ' + p.nombre + ' a la canasta');
      b.addEventListener('click', function () { cambiar(p.id, 1); });
      w.appendChild(b);
      return w;
    }
    var c = el('div', 'cant'), m = el('button', null, '−'), o = el('input'), s = el('button', null, '+');
    m.type = s.type = 'button';
    m.setAttribute('aria-label', 'Quitar uno de ' + p.nombre);
    s.setAttribute('aria-label', 'Agregar uno más de ' + p.nombre);
    /* La cantidad también se escribe con el teclado de números */
    o.type = 'text'; o.inputMode = 'numeric'; o.pattern = '[0-9]*'; o.maxLength = 3;
    o.autocomplete = 'off'; o.value = String(n);
    o.setAttribute('aria-label', 'Cantidad de ' + p.nombre);
    o.addEventListener('focus', function () { o.select(); });
    o.addEventListener('input', function () { o.value = o.value.replace(/\D/g, '').slice(0, 3); });
    o.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); o.blur(); } });
    o.addEventListener('change', function () { poner(p.id, o.value); });
    m.addEventListener('click', function () { cambiar(p.id, -1); });
    s.addEventListener('click', function () { cambiar(p.id, 1); });
    c.append(m, o, s);
    w.appendChild(c);
    return w;
  }

  /* ---------- Categorías y vitrina ---------- */
  function pintarCategorias() {
    cat.categorias.forEach(function (c) {
      if (!cat.productos.some(function (p) { return p.categoria === c.id; })) return;
      var b = el('button', 'cat');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.cat = c.id;
      var i = el('img'); i.src = c.imagen || '/img/productos/bodega.webp'; i.alt = '';
      b.append(i, el('span', null, c.nombre));
      $('cats').appendChild(b);
    });
  }

  /* Qué se ve y en qué orden. Buscando con «Más pedidos» manda lo más parecido a lo escrito
     (PE.buscar: el código exacto va primero); con otro orden, el que escogió la persona. */
  function listar() {
    var PE = window.PE || {}, consulta = filtro.q.trim(), modo = $('orden').value;   /* PE: tienda/buscar.js */
    var base = cat.productos.filter(function (p) {
      if (filtro.cat && p.categoria !== filtro.cat) return false;
      return filtro.todo || p.destacado;
    });
    if (!PE.buscar || !PE.ordenar || !PE.palabrasBuscadas) {
      /* buscar.js no cargó: la tienda sigue, con la búsqueda simple de antes y sin orden */
      var q = norm(consulta);
      return { lista: q ? base.filter(function (p) { return norm(p.nombre).indexOf(q) >= 0; }) : base, consulta: consulta, buscando: !!q };
    }
    var buscando = PE.palabrasBuscadas(consulta).length > 0;   /* solo espacios no es buscar */
    if (!buscando) return { lista: PE.ordenar(base, modo), consulta: consulta, buscando: false };
    var lista = PE.buscar(base, consulta, cat.sinonimos);
    return { lista: modo === 'pedidos' ? lista : PE.ordenar(lista, modo), consulta: consulta, buscando: true };
  }

  function pintar() {
    var g = $('grilla'), r = listar(), lista = r.lista, favs = guardados ? idsDe(guardados.favoritos) : [];
    g.textContent = '';
    buscando = r.buscando; verGuardados();
    var titulo = filtro.cat ? (cats[filtro.cat] || {}).nombre
      : (r.buscando ? 'Resultados para «' + r.consulta + '»' : (filtro.todo ? 'Todos los productos' : 'Lo más pedido'));
    $('tituloVitrina').textContent = titulo;
    $('limpiar').hidden = !(filtro.cat || r.buscando);
    $('avisoFicha').hidden = true;
    document.querySelectorAll('.cat').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cat === filtro.cat)); });
    $('estado').textContent = lista.length ? '' : 'No lo encontramos. Escríbanos por WhatsApp y se lo conseguimos.';
    /* Buscó y no hay nada: el pedido se lo llevamos nosotros, con lo que escribió */
    var pedirlo = $('pedirloWa'), sinNada = r.buscando && !lista.length && !!cat.whatsapp;
    pedirlo.hidden = !sinNada;
    if (sinNada) pedirlo.href = 'https://wa.me/' + cat.whatsapp + '?text=' + encodeURIComponent('Hola, busco: ' + r.consulta);
    lista.forEach(function (p) {
      var li = el('li'), a = el('article', 'prod'), f = el('div', p.foto ? 'foto propia' : 'foto');
      if (p.fotos && p.fotos.length > 1) carrusel(f, p.fotos);
      else {
        var i = el('img');
        i.src = foto(p); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
        f.appendChild(i);
      }
      if (!p.disponible) f.appendChild(el('span', 'sello agotado', 'Agotado'));
      else if (p.destacado) f.appendChild(el('span', 'sello', 'Más pedido'));
      if (guardados) f.appendChild(corazon(p.id, favs.indexOf(p.id) >= 0));
      var c = el('div', 'cuerpo');
      var ctrl = control(p);
      ctrl.dataset.ctrl = p.id;
      /* El nombre abre la ficha (botón dentro del h3: el texto del h3 sigue siendo solo el nombre);
         su toque se estira a toda la tarjeta y la foto también la abre */
      var h3 = el('h3'), nombre = el('button', 'nombre', p.nombre);
      nombre.type = 'button'; nombre.dataset.ficha = p.id;
      nombre.addEventListener('click', function () { abrirFicha(p.id, true); });
      h3.appendChild(nombre);
      f.addEventListener('click', function (e) { if (!e.target.closest('.puntos, .fav')) abrirFicha(p.id, true); });
      c.append(h3, el('span', 'unidad', 'Código ' + p.id), el('span', 'precio', pesos(p.precio)), ctrl);
      a.append(f, c);
      li.appendChild(a);
      g.appendChild(li);
    });
  }

  /* ---------- Ficha del producto (<dialog id="ficha">, con su dirección #p=ID para compartir) ---------- */
  /* Otros productos de la misma categoría: primero los que hay, luego los más pedidos; máximo `max` */
  function parecidos(p, max) {
    if (!p.categoria) return [];
    var n = function (o, k) { return o[k] ? 1 : 0; };
    return cat.productos
      .filter(function (o) { return o.categoria === p.categoria && o.id !== p.id; })
      .map(function (o, i) { return { o: o, i: i }; })
      .sort(function (a, b) { return (n(b.o, 'disponible') - n(a.o, 'disponible')) || (n(b.o, 'destacado') - n(a.o, 'destacado')) || (a.i - b.i); })
      .slice(0, max)
      .map(function (x) { return x.o; });
  }

  function pintarFicha(p) {
    var f = $('fichaFotos');
    f.textContent = '';
    f.className = p.foto ? 'foto propia' : 'foto';
    if (p.fotos && p.fotos.length > 1) carrusel(f, p.fotos);
    else {
      var i = el('img');
      i.src = foto(p); i.alt = ''; i.decoding = 'async';
      f.appendChild(i);
    }
    $('fichaCat').textContent = (cats[p.categoria] || {}).nombre || '';
    $('fichaNombre').textContent = p.nombre;
    $('fichaCodigo').textContent = 'Código ' + p.id;
    $('fichaPrecio').textContent = pesos(p.precio);
    var disp = $('fichaDisp');
    disp.textContent = p.disponible ? 'Disponible' : 'Agotado';
    disp.className = 'ficha-disp ' + (p.disponible ? 'hay' : 'no-hay');
    var ctrl = control(p);
    ctrl.dataset.ctrl = p.id;
    $('fichaControl').textContent = '';
    $('fichaControl').appendChild(ctrl);
    var fav = $('fichaFav');
    fav.hidden = !guardados; fav.dataset.fav = p.id; pintarCorazon(fav, esFavorito(p.id));
    var ul = $('parecidos'), lista = parecidos(p, 6);
    ul.textContent = '';
    $('parecidosCaja').hidden = !lista.length;
    lista.forEach(function (o) {
      var li = el('li'), b = el('button', 'parecido'), im = el('img', o.foto ? 'propia' : null);
      b.type = 'button';
      im.src = foto(o); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      b.append(im, el('span', 'nm', o.nombre), el('span', 'pr', pesos(o.precio)));
      if (!o.disponible) b.appendChild(el('span', 'ag', 'Agotado'));
      /* Abre la ficha de ese producto en el mismo lugar: no apila historial */
      b.addEventListener('click', function () { abrirFicha(o.id, false); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* Abre la ficha. Con `empujar` (un toque) suma una entrada al historial: el «atrás» del celular
     la cierra sin salir de la tienda. Sin él (entrar por el enlace, o saltar a un producto parecido)
     solo cambia la dirección de la entrada en la que ya está. `desde` es la tarjeta chica de favoritos
     o vistos que la abrió (a ella vuelve el foco al cerrar). Cada ficha que se abre queda en «vistos». */
  function abrirFicha(id, empujar, desde) {
    var p = por[id], d = $('ficha');
    if (!p || typeof d.showModal !== 'function') return;
    var yaAbierta = d.open;
    $('avisoFicha').hidden = true;
    pintarFicha(p);
    ficha.id = p.id;
    if (!yaAbierta) {
      ficha.alto = $('vitrina').getBoundingClientRect().top;
      /* El foco vuelve a la tarjeta que la abrió: la chica de favoritos o vistos si vino de ahí; si no, al nombre
         de su tarjeta de la vitrina (también si se tocó la foto o se entró por el enlace) */
      ficha.desde = desde || document.querySelector('#grilla [data-ficha="' + p.id + '"]');
      d.showModal();
      document.documentElement.classList.add('con-ficha');
    } else {
      d.querySelector('.ficha-cuerpo').scrollTop = 0;
      $('fichaNombre').focus({ preventScroll: true });
    }
    try {
      if (empujar && !yaAbierta) { history.pushState({ ficha: p.id }, '', '#p=' + p.id); ficha.empujada = true; }
      else {
        if (!yaAbierta) ficha.empujada = false;
        history.replaceState({ ficha: p.id }, '', '#p=' + p.id);
      }
    } catch (e) { /* sin historial: la ficha abre igual */ }
    recordarVisto(p.id);
  }

  /* Cierra el diálogo y devuelve el foco, sin tocar el historial */
  function soltarFicha() {
    var d = $('ficha'), desde = ficha.desde, id = ficha.id;
    ficha.id = null; ficha.desde = null; ficha.empujada = false;
    document.documentElement.classList.remove('con-ficha');
    if (d.open) d.close();
    ['fichaFotos', 'fichaControl', 'parecidos'].forEach(function (i) { $(i).textContent = ''; });
    /* Favoritos y vistos se vuelven a pintar al abrir una ficha: el foco va a la tarjeta nueva del mismo producto */
    if (desde && !desde.isConnected && desde.dataset.zona) desde = document.querySelector('#' + desde.dataset.zona + ' [data-ficha="' + id + '"]');
    if (desde && desde.isConnected) { try { desde.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
  }
  function limpiarDireccion() {
    try { if (/^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ }
  }
  /* ✕, Escape, tocar fuera o «atrás». Si un toque la abrió, la entrada que sumó se quita con
     history.back(); si se entró por el enlace no hay entrada que quitar (back sacaría de la
     tienda): se cierra y se limpia la dirección. */
  function cerrarFicha() {
    if (ficha.id === null) return;
    var empujada = ficha.empujada;
    soltarFicha();
    if (empujada) { try { history.back(); } catch (e) { limpiarDireccion(); reponerLugar(); } }   /* con history.back() el lugar se repone en su popstate */
    else { limpiarDireccion(); reponerLugar(); }
  }
  /* Con la ficha abierta, arriba de la vitrina pudo aparecer «vistos» o «favoritos»: al cerrarla, la vitrina
     queda donde estaba. (Con history.back() el navegador devuelve su propio scroll DESPUÉS del popstate:
     por eso se repone un cuadro más tarde.) */
  function reponerLugar() {
    var antes = ficha.alto;
    if (ficha.id !== null || antes === null) return;
    ficha.alto = null;
    var dif = $('vitrina').getBoundingClientRect().top - antes;
    if (dif && window.scrollY > 0) window.scrollBy(0, dif);
  }

  /* La dirección manda: #p=ID abre la ficha; un id que ya no existe avisa y deja la tienda normal */
  function fichaDeLaDireccion() {
    var m = /^#p=([^&]*)$/.exec(location.hash);
    if (!m) { if (ficha.id !== null) soltarFicha(); return; }
    var id = m[1];
    if (/^\d{1,9}$/.test(id) && Object.prototype.hasOwnProperty.call(por, id)) {
      if (ficha.id !== Number(id)) abrirFicha(Number(id), false);
      return;
    }
    if (ficha.id !== null) soltarFicha();
    var aviso = $('avisoFicha');
    aviso.textContent = 'Ese producto ya no está en la tienda.';
    aviso.hidden = false;
    limpiarDireccion();
  }

  /* Compartir: el menú del teléfono si lo hay; si no, WhatsApp con el nombre y el enlace */
  function compartir(p) {
    var url = location.origin + '/tienda/#p=' + p.id;
    function porWhatsApp() { window.open('https://wa.me/?text=' + encodeURIComponent(p.nombre + ' ' + url), '_blank', 'noopener'); }
    if (!navigator.share) { porWhatsApp(); return; }
    navigator.share({ title: p.nombre, text: p.nombre + ' · ' + pesos(p.precio), url: url }).catch(function (e) {
      if (!e || e.name !== 'AbortError') porWhatsApp();   /* cancelar el menú no es un error */
    });
  }

  function eventosFicha() {
    var d = $('ficha');
    $('fichaCerrar').addEventListener('click', cerrarFicha);
    d.addEventListener('click', function (e) { if (e.target === d) cerrarFicha(); });   /* el fondo oscuro */
    d.addEventListener('cancel', function (e) { e.preventDefault(); cerrarFicha(); });   /* Escape y el «atrás» de Android */
    d.addEventListener('close', function () { if (!d.open) cerrarFicha(); });   /* si el navegador la cerró por su cuenta */
    $('compartir').addEventListener('click', function () { if (ficha.id !== null) compartir(por[ficha.id]); });
    $('fichaFav').insertBefore(iconoCorazon(), $('fichaFav').firstChild);
    $('fichaFav').addEventListener('click', function () { if (ficha.id !== null) alternarFavorito(ficha.id); });
    window.addEventListener('popstate', function () { fichaDeLaDireccion(); requestAnimationFrame(reponerLugar); });
  }

  /* ---------- Favoritos, vistos hace poco y lo de la última vez (se recuerdan en este celular) ---------- */
  /* Si guardados.js no cargó (o no hay localStorage) la tienda sigue igual: sin corazones ni secciones,
     o con ellos mientras la página esté abierta. Lo guardado puede estar viejo o dañado: solo vale lo
     que hoy sigue en la tienda, y nada de esto entra a la canasta sin pasar por PE.paraLaCanasta. */
  function abrirGuardados() {
    var PE = window.PE || {}, a = null;
    if (!PE.guardado || !PE.alFrente || !PE.paraLaCanasta) return null;
    try { a = window.localStorage; } catch (e) { /* bloqueado: se recuerda solo mientras la página esté abierta */ }
    return { favoritos: PE.guardado(a, CLAVE_FAVORITOS, []), vistos: PE.guardado(a, CLAVE_VISTOS, []), ultimo: PE.guardado(a, CLAVE_ULTIMO, []) };
  }
  /* Los ids de una lista guardada: solo números enteros, sin repetir (si no se puede leer, ninguno) */
  function idsDe(g) {
    var visto = {}, lista = intentar(function () { return g.leer(); });
    return (Array.isArray(lista) ? lista : []).filter(function (x) {
      if (typeof x !== 'number' || !(x > 0) || x % 1 !== 0 || visto[x]) return false;
      visto[x] = true;
      return true;
    });
  }
  function esFavorito(id) { return !!guardados && idsDe(guardados.favoritos).indexOf(id) >= 0; }

  var SVG = 'http://www.w3.org/2000/svg';
  function iconoCorazon() {
    var s = document.createElementNS(SVG, 'svg'), t = document.createElementNS(SVG, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    t.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
    s.appendChild(t);
    return s;
  }
  /* El corazón dice si ya es favorito (aria-pressed) y lo que hará al tocarlo (su nombre) */
  function pintarCorazon(b, si) {
    var texto = si ? 'Quitar de favoritos' : 'Guardar en favoritos', t = b.querySelector('.fav-txt');
    b.setAttribute('aria-pressed', String(si));
    b.setAttribute('aria-label', texto);
    if (t) t.textContent = texto;
  }
  function corazon(id, si) {
    var b = el('button', 'fav');
    b.type = 'button'; b.dataset.fav = id;
    b.appendChild(iconoCorazon());
    pintarCorazon(b, si);
    b.addEventListener('click', function () { alternarFavorito(id); });
    return b;
  }
  function alternarFavorito(id) {
    if (!guardados) return;
    var ids = idsDe(guardados.favoritos), i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids = window.PE.alFrente(ids, id, MAX_FAVORITOS);
    guardados.favoritos.escribir(ids);
    /* la tarjeta de la vitrina y el corazón de la ficha son el mismo favorito */
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (b) { pintarCorazon(b, i < 0); });
    pintarGuardados();
  }
  function recordarVisto(id) {
    if (!guardados) return;
    guardados.vistos.escribir(window.PE.alFrente(idsDe(guardados.vistos), id, MAX_VISTOS));
    pintarGuardados();
  }

  /* Tarjeta chica de favoritos y vistos: foto, nombre, precio y el sello si se agotó. Tocarla abre su ficha;
     agregar se hace desde la ficha (así no se repiten los botones de la vitrina). */
  function mini(p, zona) {
    var li = el('li'), b = el('button', 'parecido mini'), f = el('span', 'mini-foto'), i = el('img', p.foto ? 'propia' : null);
    b.type = 'button'; b.dataset.ficha = p.id; b.dataset.zona = zona;
    i.src = foto(p); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
    f.appendChild(i);
    if (!p.disponible) f.appendChild(el('span', 'sello', 'Agotado'));
    b.append(f, el('span', 'nm', p.nombre), el('span', 'pr', pesos(p.precio)));
    b.addEventListener('click', function () { abrirFicha(p.id, true, b); });
    li.appendChild(b);
    return li;
  }
  /* Con algo escrito en el buscador se esconden: los resultados quedan arriba */
  function verGuardados() {
    ['favoritos', 'vistos'].forEach(function (z) { $(z).hidden = buscando || !Number($(z).dataset.n); });
  }
  function pintarGuardados() {
    if (!guardados) return;
    /* Si quien mira ya bajó por la página, la vitrina se queda donde está aunque arriba aparezca o crezca una sección
       (con la ficha abierta no: eso lo repone reponerLugar al cerrarla) */
    var v = $('vitrina'), antes = v.getBoundingClientRect().top;
    [['favoritos', guardados.favoritos], ['vistos', guardados.vistos]].forEach(function (z) {
      var ul = $(z[0]).querySelector('ul'), hay = idsDe(z[1]).filter(function (id) { return por[id]; });   /* solo lo que sigue en la tienda */
      ul.textContent = '';
      hay.forEach(function (id) { ul.appendChild(mini(por[id], z[0])); });
      $(z[0]).dataset.n = hay.length;
    });
    verGuardados();
    var dif = v.getBoundingClientRect().top - antes;
    if (dif && window.scrollY > 0 && ficha.id === null) window.scrollBy(0, dif);
  }

  /* «Pedir lo de la última vez» sale si de ese pedido hoy queda algo que se vende */
  function lineasUltimo() { return guardados ? guardados.ultimo.leer() : []; }
  function pintarUltimaVez() {
    $('ultima').hidden = !guardados || !Object.keys(window.PE.paraLaCanasta(lineasUltimo(), por).canasta).length;
  }
  function recordarUltimo(lineas) {
    /* Es un extra: pase lo que pase aquí, el pedido que ya llegó a la tienda no se frena */
    try { if (guardados) { guardados.ultimo.escribir(lineas); pintarUltimaVez(); } } catch (e) { /* sin guardar */ }
  }
  /* Suma lo disponible a lo que ya hay en la canasta y la abre; lo que no está hoy se avisa arriba de las líneas */
  function pedirLoDeLaUltimaVez() {
    if (!guardados) return;
    var r = window.PE.paraLaCanasta(lineasUltimo(), por), ids = Object.keys(r.canasta);
    ids.forEach(function (id) { canasta[id] = Math.min((canasta[id] || 0) + r.canasta[id], 999); });
    guardar(); ids.forEach(refrescar); pintarCanasta();
    vista('canasta'); abrir();
    avisarNoEstan(r.fuera.length ? 'No están hoy: ' + r.fuera.join(', ') : '');
  }
  function avisarNoEstan(texto) {
    var no = $('noEstan');
    no.textContent = texto;
    no.hidden = !texto || vistaActual() !== 'canasta';
  }

  /* ---------- Pantallas del panel ---------- */
  function vista(cual) {
    $('items').hidden = cual !== 'canasta';
    $('resumen').hidden = cual !== 'canasta';
    $('vacio').hidden = cual !== 'canasta' || cuentas().n > 0;
    $('vaciar').hidden = cual !== 'canasta' || !cuentas().n;
    $('noEstan').hidden = cual !== 'canasta' || !$('noEstan').textContent;
    $('datos').hidden = cual !== 'datos';
    $('pago').hidden = cual !== 'pago';
    $('pqr').hidden = cual !== 'qr';
    $('final').hidden = cual !== 'final';
    if (cual !== 'qr') clearTimeout(relojQr);
    $('panelTitulo').textContent = { canasta: 'Su canasta', datos: 'Datos de entrega', pago: 'Medio de pago', qr: 'Pague con QR', final: 'Su pedido' }[cual];
    $('panel').dataset.vista = cual;
    $('panel').scrollTop = 0;
  }
  function vistaActual() { return $('panel').dataset.vista || 'canasta'; }

  /* ---------- Datos de entrega ---------- */
  function soloDigitos(t) { return String(t || '').replace(/\D/g, ''); }
  function celular10(t) { var n = soloDigitos(t); if (n.length === 12 && n.indexOf('57') === 0) n = n.slice(2); return n; }
  function leerFormulario() {
    var d = {};
    Object.keys(CAMPOS).forEach(function (k) { d[k] = ($(CAMPOS[k]).value || '').trim(); });
    return d;
  }
  function validar(d) {
    var malos = [];
    function mal(id, texto) { malos.push([id, texto]); }
    if (d.nombre.length < 3) mal('d-nombre', 'Escriba el nombre de quien recibe.');
    var doc = soloDigitos(d.documento.split('-')[0]);
    if (doc.length < 5 || doc.length > 15) mal('d-doc', 'El número de documento no parece completo.');
    var cel = celular10(d.celular);
    if (!/^3\d{9}$/.test(cel)) mal('d-cel', 'El celular debe tener 10 dígitos y empezar por 3.');
    if (d.barrio.length < 3) mal('d-barrio', 'Elija o escriba su barrio.');
    if (d.direccion.length < 5) mal('d-dir', 'Escriba la dirección con el detalle.');
    if (!$('d-acepto').checked) mal('d-acepto', 'Falta autorizar el uso de sus datos.');
    ['d-nombre', 'd-doc', 'd-cel', 'd-barrio', 'd-dir', 'd-acepto'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    malos.forEach(function (m) { $(m[0]).setAttribute('aria-invalid', 'true'); });
    var e = $('errores');
    e.textContent = malos.map(function (m) { return m[1]; }).join(' ');
    e.hidden = !malos.length;
    if (malos.length) $(malos[0][0]).focus();
    if (!malos.length) d.celular = cel.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    return !malos.length;
  }
  function pasoDatos() {
    var d = leerDatos();
    $('d-nombre').value = d.nombre || ''; $('d-tipo').value = d.tipo || 'CC';
    $('d-doc').value = d.documento || ''; $('d-cel').value = d.celular || '';
    $('d-barrio').value = d.barrio || '';
    $('d-dir').value = d.direccion || ''; $('d-extra').value = d.extra || '';
    $('d-acepto').checked = !!d.acepto;
    $('errores').hidden = true;
    vista('datos');
    /* Con los datos ya guardados, el botón queda a la vista para pedir en un toque */
    if (d.nombre) $('enviar').focus(); else $('d-nombre').focus();
  }

  /* ---------- Ubicación de entrega (PE.dentroDeEntrega, tienda/ubicacion.js) ---------- */
  /* «Usar mi ubicación actual» adjunta el punto del GPS a las indicaciones, solo si cae dentro del
     radio de catalogo.json ("entrega"). Sin GPS en el navegador, sin "entrega" o sin ubicacion.js el
     botón no sale y todo sigue como siempre. Si el GPS se niega o no responde, se puede pedir igual.
     Un resultado nuevo (error, fuera del radio) borra el enlace anterior: nunca viaja un punto viejo. */
  function ubicacionDisponible() {
    var P = window.PE, g = navigator.geolocation;
    return !!(P && P.entregaValida && P.dentroDeEntrega && P.enlaceMapa && P.entregaValida(cat && cat.entrega) &&
      g && typeof g.getCurrentPosition === 'function');
  }
  function pintarUbicado(texto, estado) {
    $('ubicado').textContent = texto;
    if (estado) $('ubicado').dataset.estado = estado; else delete $('ubicado').dataset.estado;
  }
  function tomarUbicacion() {
    var boton = $('ubicar'), mia = ++busquedaGps, teniaFoco = document.activeElement === boton;
    enlaceUbicacion = '';
    boton.disabled = true;
    pintarUbicado('Buscando su ubicación…', 'buscando');
    function terminar(texto, estado) {
      pintarUbicado(texto, estado);
      boton.disabled = false;
      if (teniaFoco && (!document.activeElement || document.activeElement === document.body)) boton.focus();
    }
    function noPudo() {
      if (mia === busquedaGps) terminar('No pudimos tomar su ubicación. Escriba la dirección y siga.', 'error');
    }
    try {
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (mia !== busquedaGps) return;   /* el pedido ya salió: esta respuesta llegó tarde */
        var c = pos && pos.coords, enlace = c ? window.PE.enlaceMapa(c.latitude, c.longitude) : '';
        if (!enlace) return noPudo();
        if (!window.PE.dentroDeEntrega(c.latitude, c.longitude, cat.entrega)) {
          return terminar('Esa ubicación queda fuera de El Espinal. Escriba la dirección donde lo recibe.', 'fuera');
        }
        enlaceUbicacion = enlace;
        terminar('Ubicación lista ✓', 'ok');
      }, noPudo, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    } catch (e) { noPudo(); }
  }
  /* El pedido llegó a la tienda: la ubicación era de ese pedido */
  function soltarUbicacion() {
    enlaceUbicacion = ''; busquedaGps++;
    pintarUbicado('');
    $('ubicar').disabled = false;
  }

  /* ---------- Hablar con la tienda ---------- */
  function llamar(ruta, metodo, cuerpo) {
    var cab = { Accept: 'application/json' };
    if (cuerpo) cab['Content-Type'] = 'application/json';
    if (pedido && pedido.secreto) cab['X-Pedido-Secreto'] = pedido.secreto;
    return fetch(API + ruta, { method: metodo, headers: cab, body: cuerpo ? JSON.stringify(cuerpo) : undefined, credentials: 'same-origin' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || !d.ok) { var e = new Error(d.error || 'No pudimos hablar con la tienda. Intente otra vez o escríbanos por WhatsApp al 318 355 5246.'); e.estado = r.status; throw e; }
          return d;
        });
      });
  }
  function ocupado(boton, si, texto) {
    boton.disabled = si;
    if (si) { boton.dataset.texto = boton.textContent; boton.textContent = texto || 'Un momento…'; }
    else if (boton.dataset.texto) boton.textContent = boton.dataset.texto;
  }

  function enviarPedido(d) {
    var lineas = Object.keys(canasta).map(function (id) {
      return { id: Number(id), cantidad: canasta[id] };   /* precio y nombre los pone el CRM */
    });
    /* El enlace del mapa va primero (ubicacion.js); sin ese módulo, o si falla, van las indicaciones tal cual */
    var P = window.PE || {};
    var indicaciones = P.unirIndicaciones ? intentar(function () { return P.unirIndicaciones(enlaceUbicacion, d.extra, MAX_INDICACIONES); }) : d.extra;
    if (typeof indicaciones !== 'string') indicaciones = d.extra;
    ocupado($('enviar'), true, 'Enviando su pedido…');
    llamar('', 'POST', {
      nombre: d.nombre, tipo: d.tipo, documento: d.documento, celular: d.celular,
      barrio: d.barrio, direccion: d.direccion, indicaciones: indicaciones,
      lineas: lineas
    }).then(function (r) {
      pedido = r;
      guardarPedido(pedido);
      /* El pedido ya está en la tienda: la canasta queda vacía para la próxima y lo PRIMERO es el paso de pago.
         Lo demás es repintar y recordar: si algo de eso falla, el pago ya está a la vista (si no, el cliente
         vería la canasta vacía sin pago y pediría otra vez). */
      canasta = {}; guardar();
      pasoPago();
      intentar(function () { recordarUltimo(lineas); });   /* para «Pedir lo de la última vez»; solo si el pedido llegó */
      intentar(soltarUbicacion);
      intentar(pintar);
      intentar(pintarCanasta);
    }).catch(function (e) {
      $('errores').textContent = e.message; $('errores').hidden = false;
    }).then(function () { ocupado($('enviar'), false); });
  }

  /* ---------- Medio de pago ---------- */
  function pasoPago() {
    $('pCodigo').textContent = pedido.codigo;
    $('pTotal').textContent = pesos(pedido.total);
    $('errPago').hidden = true;
    marcarMedio('');
    pintarBilletes();
    vista('pago');
  }
  function marcarMedio(m) {
    document.querySelectorAll('.medio').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.medio === m)); });
    $('bEfe').hidden = m !== 'efectivo';
  }
  function elegirMedio(m) {
    marcarMedio(m);
    if (m === 'qr') pasoQr();
  }
  /* Pantalla del QR: entra con animación, el código aparece despacio
     y el botón «PAGO CONFIRMADO» sale a los 5 segundos */
  var ESPERA_BOTON = 5000;
  function pasoQr() {
    $('qrTotal').textContent = pesos(pedido.total);
    $('qCodigo').textContent = pedido.codigo;
    $('errQr').hidden = true;
    pintarQr();
    $('yaPague').hidden = true;
    $('qrEspera').hidden = false;
    vista('qr');
    var p = $('pqr');
    p.classList.remove('entra'); void p.offsetWidth; p.classList.add('entra');
    clearTimeout(relojQr);
    relojQr = setTimeout(function () {
      $('qrEspera').hidden = true;
      $('yaPague').hidden = false;
    }, ESPERA_BOTON);
  }
  function pintarQr() {
    var pago = (cat && cat.pago) || {};
    $('qrImg').hidden = !pago.qr;
    $('qrFalta').hidden = !!pago.qr;
    $('yaPague').disabled = !pago.qr;
    if (pago.qr) $('qrImg').src = pago.qr;
    $('qrLlave').hidden = !pago.llave;
    $('qrLlave').textContent = pago.llave ? 'Llave Bre-B: ' + pago.llave : '';
  }
  /* Billetes que alcanzan para el total: exacto y los siguientes redondos */
  function pintarBilletes() {
    var t = pedido.total, caja = $('billetes'), vistos = {};
    caja.textContent = '';
    var opciones = [t];
    [10000, 20000, 50000, 100000].forEach(function (b) { opciones.push(Math.ceil(t / b) * b); });
    opciones.filter(function (v) { if (vistos[v]) return false; vistos[v] = 1; return true; }).slice(0, 4).forEach(function (v, i) {
      var b = el('button', 'billete', i === 0 ? 'Exacto ' + pesos(v) : pesos(v));
      b.type = 'button'; b.dataset.valor = v;
      b.setAttribute('aria-pressed', 'false');
      caja.appendChild(b);
    });
    $('pagaCon').value = '';
  }
  function pagar(datos, boton, err) {
    err = $(err || 'errPago');
    err.hidden = true;
    ocupado(boton, true);
    llamar('/' + pedido.codigo + '/pago', 'POST', datos).then(function (r) {
      Object.assign(pedido, r); guardarPedido(pedido);
      pasoFinal();
    }).catch(function (e) {
      err.textContent = e.message; err.hidden = false;
      if (e.estado === 404) { guardarPedido(null); }
    }).then(function () { ocupado(boton, false); });
  }

  /* ---------- Pedido por confirmar (se actualiza solo) ---------- */
  var ICONOS = { POR_CONFIRMAR: '⏳', POR_ALISTAR: '✅', EN_CAMINO: '🛵', ENTREGADO: '🎉', NO_ENTREGADO: '⚠️' };
  var ORDEN = ['POR_CONFIRMAR', 'POR_ALISTAR', 'EN_CAMINO', 'ENTREGADO'];
  function pintarFinal() {
    $('fIcono').textContent = ICONOS[pedido.estado] || '⏳';
    $('fTitulo').textContent = pedido.titulo || 'Pedido por confirmar';
    $('fDetalle').textContent = pedido.detalle || '';
    $('fCodigo').textContent = pedido.codigo;
    var pago = pedido.medio === 'qr' ? 'QR Bre-B · ' + pesos(pedido.total)
      : 'Efectivo · ' + pesos(pedido.total) + (pedido.paga_con > pedido.total ? ' (paga con ' + pesos(pedido.paga_con) + ')' : '');
    $('fPago').textContent = pago;
    var actual = ORDEN.indexOf(pedido.estado);
    document.querySelectorAll('#fPasos li').forEach(function (li) {
      var i = ORDEN.indexOf(li.dataset.paso);
      li.className = actual < 0 ? '' : (i < actual ? 'hecho' : (i === actual ? 'ahora' : ''));
    });
    $('fPasos').hidden = pedido.estado === 'NO_ENTREGADO';
    $('fMotivo').hidden = !pedido.motivo;
    $('fMotivo').textContent = pedido.motivo ? 'Motivo: ' + pedido.motivo : '';
    pintarAviso();
  }
  function pasoFinal() { pintarFinal(); vista('final'); vigilar(); }
  function vigilar() {
    clearTimeout(reloj);
    if (!pedido || pedido.final) return;
    reloj = setTimeout(function () {
      if (document.hidden) { vigilar(); return; }
      llamar('/' + pedido.codigo, 'GET').then(function (r) {
        Object.assign(pedido, r); guardarPedido(pedido);
        pintarFinal();
      }).catch(function (e) {
        if (e.estado === 404) { pedido = null; guardarPedido(null); pintarAviso(); }
      }).then(vigilar);
    }, CADA);
  }
  /* Cinta del pedido en curso sobre la tienda: vuelve a su pantalla en un toque */
  function pintarAviso() {
    var a = $('avisoPedido');
    if (!pedido || !pedido.codigo) { a.hidden = true; return; }
    $('avisoTexto').textContent = pedido.codigo + ' · ' + (pedido.titulo || 'Pedido por confirmar');
    a.hidden = false;
  }
  function abrirPedido() {
    abrir();
    if (!pedido.medio) pasoPago(); else pasoFinal();
  }

  /* ---------- Canasta ---------- */
  function pintarCanasta() {
    var c = cuentas(), ul = $('items'), gratis = cat.domicilio.gratis_desde;
    ul.textContent = '';
    Object.keys(canasta).forEach(function (id) {
      var p = por[id], li = el('li'), i = el('img', p.foto ? 'propia' : null), mid = el('div');
      i.src = foto(p); i.alt = '';
      mid.append(el('div', 'nm', p.nombre), control(p).firstChild);
      li.append(i, mid, el('span', 'v', pesos(p.precio * canasta[id])));
      ul.appendChild(li);
    });
    var vacia = c.n === 0;
    $('n').hidden = vacia; $('n').textContent = c.n;
    $('barra').hidden = vacia;
    document.body.classList.toggle('con-barra', !vacia);
    $('barraN').textContent = c.n + (c.n === 1 ? ' producto' : ' productos');
    $('barraT').textContent = pesos(c.t);
    $('dom').textContent = vacia ? '$0' : (c.d ? pesos(c.d) : 'Gratis');
    $('falta').textContent = !vacia && c.s < gratis ? '· gratis si agrega ' + pesos(gratis - c.s) : '';
    $('tot').textContent = pesos(c.t);
    $('seguir').disabled = vacia;
    $('tot2').textContent = pesos(c.t);
    if (vistaActual() === 'canasta') { $('vacio').hidden = !vacia; $('vaciar').hidden = vacia; }
    if (vacia && vistaActual() === 'datos') vista('canasta');
    pintarLlegada();
  }

  /* ---------- Panel ---------- */
  function abrir() { avisarNoEstan(''); $('panel').hidden = false; $('velo').hidden = false; $('cerrar').focus(); }
  function cerrar() {
    /* El pedido en curso no se pierde: queda la cinta de arriba para volver */
    $('panel').hidden = true; $('velo').hidden = true;
    vista('canasta');
  }
  function verTodo() { filtro = { cat: '', q: '', todo: true }; $('q').value = ''; pintar(); }

  function eventos() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) { filtro = { cat: b.dataset.cat, q: '', todo: true }; $('q').value = ''; pintar(); $('vitrina').scrollIntoView({ behavior: 'smooth' }); }
      var combo = e.target.closest('[data-combo]');
      if (combo) {
        combo.dataset.combo.split(',').forEach(function (id) { if (por[id] && por[id].disponible) canasta[id] = (canasta[id] || 0) + 1; });
        guardar(); pintar(); pintarCanasta(); vista('canasta'); abrir();
      }
      if (e.target.closest('[data-abrir]')) { vista('canasta'); abrir(); }
      var medio = e.target.closest('.medio');
      if (medio) elegirMedio(medio.dataset.medio);
      var billete = e.target.closest('.billete');
      if (billete) {
        document.querySelectorAll('.billete').forEach(function (x) { x.setAttribute('aria-pressed', String(x === billete)); });
        $('pagaCon').value = '';
      }
    });
    $('verTodo').addEventListener('click', function () { verTodo(); $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('ultimaVez').addEventListener('click', pedirLoDeLaUltimaVez);
    $('limpiar').addEventListener('click', function (e) { e.preventDefault(); verTodo(); });
    $('q').addEventListener('input', function () { filtro = { cat: '', q: this.value, todo: true }; pintar(); });
    $('orden').addEventListener('change', pintar);
    $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('btnq').addEventListener('click', function () { $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('cerrar').addEventListener('click', cerrar);
    $('velo').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    $('vaciar').addEventListener('click', function () { canasta = {}; guardar(); pintar(); pintarCanasta(); cerrar(); });
    $('seguir').addEventListener('click', pasoDatos);
    $('ubicar').addEventListener('click', tomarUbicacion);
    $('volver').addEventListener('click', function () { vista('canasta'); });
    $('datos').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = leerFormulario();
      if (!cuentas().n || !validar(d)) return;
      d.acepto = true;
      guardarDatos(d);
      enviarPedido(d);
    });
    $('yaPague').addEventListener('click', function () { pagar({ medio: 'qr', pagado: true }, this, 'errQr'); });
    $('volverPago').addEventListener('click', function () { marcarMedio(''); vista('pago'); });
    $('pagaCon').addEventListener('input', function () {
      document.querySelectorAll('.billete').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    });
    $('listoEfe').addEventListener('click', function () {
      var elegido = document.querySelector('.billete[aria-pressed="true"]');
      var valor = elegido ? Number(elegido.dataset.valor) : Number(soloDigitos($('pagaCon').value));
      pagar({ medio: 'efectivo', paga_con: valor || 0 }, this);
    });
    $('otraCompra').addEventListener('click', function () {
      if (pedido && pedido.final) { pedido = null; guardarPedido(null); pintarAviso(); }
      cerrar();
    });
    $('avisoPedido').addEventListener('click', abrirPedido);
  }

  /* ---------- Carga ---------- */
  /* Foto de la categoría: la del sitio cuyo nombre se parece (Platos, Vasos…). Una entrada de catalogo.json
     sin nombre o sin imagen se salta. */
  function fotoCategoria(nombre, fotos) {
    var n = norm(nombre), hallada = '';
    fotos.forEach(function (f) {
      if (!f || typeof f.nombre !== 'string' || typeof f.imagen !== 'string') return;
      var clave = norm(f.nombre).split(' ')[0];
      if (!hallada && clave && n.indexOf(clave.replace(/s$/, '')) >= 0) hallada = f.imagen;
    });
    return hallada;
  }
  function json(url) {
    return fetch(url, { cache: 'no-cache', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  /* Lo de catalogo.json es opcional: si no carga o el JSON está roto, la tienda sigue con {} */
  Promise.all([json('/tienda/catalogo.json').catch(function () { return {}; }), json(CATALOGO)])
    .then(function (r) {
      var sitio = r[0] && typeof r[0] === 'object' && !Array.isArray(r[0]) ? r[0] : {}, crm = r[1];
      if (!crm.ok) throw new Error('crm');
      if (!crm.productos || !crm.productos.length) { var v = new Error('vacío'); v.vacio = true; throw v; }
      cat = {
        domicilio: crm.domicilio, pago: sitio.pago, whatsapp: sitio.whatsapp, horario: sitio.horario,
        sinonimos: sitio.sinonimos, entrega: sitio.entrega,
        categorias: crm.categorias.map(function (c) {
          return { id: c.id, nombre: c.nombre, imagen: fotoCategoria(c.nombre, Array.isArray(sitio.categorias) ? sitio.categorias : []) };
        }),
        productos: crm.productos
      };
      /* Si nada sale como «Más pedido», la portada muestra todo */
      if (!cat.productos.some(function (p) { return p.destacado; })) filtro.todo = true;
      cat.categorias.forEach(function (c) { cats[c.id] = c; });
      cat.productos.forEach(function (p) { por[p.id] = p; });
      /* Lo que ya no está o se agotó sale de la canasta guardada */
      Object.keys(canasta).forEach(function (id) { if (!por[id] || !por[id].disponible || !(canasta[id] > 0)) delete canasta[id]; });
      guardar();
      /* El combo solo se ofrece si todos sus productos están y hay */
      document.querySelectorAll('[data-combo]').forEach(function (b) {
        var ok = b.dataset.combo.split(',').every(function (id) { return por[id] && por[id].disponible; });
        var caja = b.closest('.combo');
        if (!ok && caja) caja.hidden = true;
      });
      BARRIOS.forEach(function (b) { var o = el('option'); o.value = b; $('barrios').appendChild(o); });
      /* Lo que es un extra va con intentar: si falla, los productos se ven igual (nunca «No pudimos cargar») */
      $('ubicarCaja').hidden = !intentar(ubicacionDisponible);
      guardados = intentar(abrirGuardados) || null;
      pintarCategorias();
      eventos();
      eventosFicha();
      pintar();
      intentar(pintarGuardados);   /* favoritos y vistos, solo lo que sigue en la tienda */
      intentar(pintarUltimaVez);
      pintarCanasta();   /* también pinta la hora de llegada (que se cuida sola) */
      vista('canasta');
      pintarAviso();
      vigilar();
      intentar(fichaDeLaDireccion);   /* un enlace con #p=ID abre esa ficha */
      setInterval(pintarLlegada, 60000);   /* la hora de llegada corre sola mientras la página está abierta */
    })
    .catch(function (e) {
      document.querySelectorAll('.combo').forEach(function (c) { c.hidden = true; });
      $('estado').textContent = e && e.vacio
        ? 'Estamos subiendo los productos a la tienda. Mientras tanto, escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.'
        : 'No pudimos cargar los productos. Escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.';
    });
})();
