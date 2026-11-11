/* Plásticos Espinal · tienda en línea. Nadie entra sin cuenta (decisión de Johan, 10-nov-2026):
   la puerta (functions/_middleware.js) solo sirve esta página con la galleta de la sesión, y si
   el CRM dice que esa sesión ya no vale (catálogo con sesion: false), de aquí se va a la entrada.
   Los productos salen del CRM (precio, precio por cantidad y si hay o no; nunca cuántas quedan).
   /tienda/catalogo.json solo trae lo de la página: QR, WhatsApp, fotos, horario, sinónimos, entrega y
   quién vende. Todo eso es opcional: si falta, viene mal escrito o no carga, la tienda sigue sin ello.
   «Pedir ya» → datos de entrega → el pedido entra al CRM «Por confirmar»
   (por el intermediario /tienda/mi-cuenta/api/tienda/…) → medio de pago (QR
   Bre-B o efectivo) → pantalla del pedido, que pregunta cada tanto en qué va.
   El pedido en curso (código + secreto) queda en este celular. Cada producto tiene
   su ficha (<dialog>) con dirección propia, #p=ID, para compartir. También en este
   celular: favoritos (el corazón), lo visto hace poco y el último pedido enviado,
   para pedirlo otra vez en un toque (PE.guardado: tienda/guardados.js). En los datos de
   entrega, «Ubícame en el mapa» suma el punto del GPS si cae en El Espinal
   (tienda/ubicacion.js). En el celular tiene cara de app: abajo flota una pastilla con Buscar, Inicio y
   Pedidos y, aparte, la canasta en su círculo (cuántos lleva y un aro que se llena hacia el domicilio
   gratis); arriba, el círculo con la inicial de quien entró abre su cuenta. Lo que se mueve (la foto que
   vuela a la canasta, el confeti, las entradas) no corre si la persona pidió menos movimiento.
   La ficha tiene el botón y la hora de llegada en un pie que no se mueve.
   Datos de la base: siempre textContent. */
(function () {
  'use strict';

  var CLAVE = 'pe-canasta-v1';
  var CLAVE_DATOS = 'pe-cliente-v1';   /* datos de entrega, solo en este celular */
  var CLAVE_PEDIDO = 'pe-pedido-v1';   /* pedido en curso: código + secreto */
  var CLAVE_FAVORITOS = 'pe-favoritos-v1', MAX_FAVORITOS = 100;   /* ids, el último guardado primero */
  var CLAVE_VISTOS = 'pe-vistos-v1', MAX_VISTOS = 12;             /* ids de lo que se abrió en ficha, lo último primero */
  var CLAVE_ULTIMO = 'pe-ultimo-v1';   /* líneas { id, cantidad } del último pedido enviado desde este celular */
  var API = '/tienda/mi-cuenta/api/tienda/pedido';
  /* Raíz de la tienda: «/» en tienda.plasticosespinal.com, «/tienda/» en las pruebas y vistas previas */
  var RAIZ = /^\/tienda(\/|$)/.test(location.pathname) ? '/tienda/' : '/';
  var CATALOGO = '/tienda/mi-cuenta/api/tienda/catalogo';
  var YO = '/tienda/mi-cuenta/api/yo';   /* quien entró: sus datos de entrega guardados */
  var DATOS = '/tienda/mi-cuenta/api/datos';
  var FAVORITOS = '/tienda/mi-cuenta/api/favoritos';   /* los favoritos viven en la cuenta: iguales en todos sus equipos */
  var CLAVE_FAV_CUENTA = 'pe-favoritos-cuenta';   /* de quién son los favoritos de este navegador (su documento) */   /* «Mis datos»: ahí queda la dirección predeterminada */
  var CADA = 5000;                     /* cada cuánto pregunta en qué va el pedido */
  var MAX_INDICACIONES = 300;          /* el CRM corta las indicaciones a esto: el enlace del mapa va primero */
  var PRECISION_MAX_M = 200;           /* un punto del GPS con más error que esto (en metros) no se adjunta: por antena o por internet
                                          puede caer a kilómetros y confunde al domiciliario. La cifra no sale en pantalla. */
  /* Barrios de El Espinal para sugerir (lista parcial: el cliente puede escribir otro) */
  var BARRIOS = ['Arkabal', 'Balkanes', 'Belén', 'Betania', 'Betania Campestre', 'Bosques de Roa',
    'Caballero y Góngora', 'Cafasur', 'El Centro', 'Entre Ríos', 'Fátima', 'Isaías Olivar',
    'La Cascada', 'La Esperanza', 'Libertador', 'Nacional', 'Primero de Mayo', 'Rondón',
    'San Rafael', 'Santa Margarita María', 'Talura', 'Villa Catalina', 'Villa Ceiba',
    'Villa Laura', 'Villa Lorena', 'Villa Paz'];
  /* dato -> campo. El documento no se pide: el pedido queda con el de la cuenta (lo pone el CRM) */
  var CAMPOS = { nombre: 'd-nombre', celular: 'd-cel', barrio: 'd-barrio', direccion: 'd-dir', extra: 'd-extra' };
  var cat = null;                 /* catálogo */
  var cuenta = null;              /* quien entró (lo que responde «yo»); null si no se pudo leer */
  var por = {};                   /* id -> producto */
  var cats = {};                  /* id -> categoría */
  var canasta = leer();           /* { id: cantidad } */
  var filtro = { cat: '', q: '' };   /* y, si se escogen, tipo, marca, medida y color (NIVELES) */
  var pedido = leerPedido();     /* { codigo, secreto, estado… } o null */
  var reloj = null, relojQr = null;
  var franjaBase = null, conHora = false;   /* franja de arriba: lo que trae el HTML y si ya dice la hora */
  var etiquetaLlega = '';         /* «Llega hoy», «Llega mañana»…: la línea verde de cada tarjeta que hay (vacía sin horario) */
  var ficha = { id: null, empujada: false, desde: null, lugar: null };   /* ficha abierta: cuál, si un toque empujó su entrada del historial, quién la abrió y qué se miraba al abrirla (lugarDe) */
  var guardados = null;           /* { favoritos, vistos, ultimo }; null si guardados.js no cargó (sin corazones ni secciones) */
  var buscando = false;           /* hay algo escrito en el buscador: favoritos y vistos se esconden */
  var enlaceUbicacion = '';       /* enlace del mapa de ESTE pedido; solo en memoria, nunca en pe-cliente-v1 */
  var dirPorGuardar = null;       /* los datos del pedido en curso cuya dirección queda como la de la cuenta */
  var busquedaGps = 0;            /* número de la búsqueda de ubicación en curso; subirlo descarta la respuesta que llegue tarde */
  var enBuscador = false;         /* el cursor está en el buscador: abajo se marca «Buscar» */
  var soloFavoritos = false;      /* «Favoritos» de abajo: la vitrina muestra solo lo guardado con el corazón */
  var pintadoCon = null;
  var POR_PAGINA = 50, pagina = 1;   /* el catálogo va de a 50 productos por página */          /* con qué categoría, orden y modo se pintó la vitrina la última vez: si cambia, las tarjetas entran con movimiento */
  var llevaba = null, eraGratis = null;   /* lo último que mostró la canasta de abajo: salta solo si cambia y celebra solo al LLEGAR al domicilio gratis */
  /* La persona pidió menos movimiento en su celular: nada vuela, salta ni cae */
  var QUIETO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var $ = function (i) { return document.getElementById(i); };
  var formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  function pesos(n) { return '$' + formato.format(Math.round(n)); }
  var formatoCentavos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
  /* Precio por unidad junto al del paquete (como lo pide la SIC y lo muestra MercadoLibre): «$392 c/u».
     Sale de `contenido` del CRM (lo que trae el paquete, de la ficha completa); sin él, o si la unidad se
     mide (kg, ml…) o el paquete trae una sola, no sale nada. Bajo $100 lleva centavos: «$12,4 c/u».
     Devuelve { valor: '$392', corto: 'c/u', largo: 'unidad' } (con un empaque creado: 'c/rollo', 'rollo') o null. */
  function precioPorUnidad(p) {
    var c = p.contenido;
    if (!c || typeof c !== 'object' || c.se_mide || typeof c.unidad !== 'string' || !c.unidad) return null;
    var precio = precioVisto(p);
    if (typeof c.cantidad !== 'number' || !(c.cantidad > 1) || !(precio > 0)) return null;
    var v = precio / c.cantidad, und = c.unidad === 'und';
    return { valor: '$' + (v < 100 ? formatoCentavos.format(v) : formato.format(Math.round(v))),
      corto: und ? 'c/u' : 'c/' + c.unidad, largo: und ? 'unidad' : c.unidad };
  }
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
    /* Mientras la persona la toca, esa tarjeta deja de pasar sola un rato (pasarFotos) */
    var tocar = function () { tira.dataset.tocada = String(Date.now()); };
    tira.addEventListener('pointerdown', tocar, { passive: true });
    puntos.addEventListener('click', tocar);
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
    intentar(function () { pintarLlegadaFicha(r); });
    /* En las tarjetas basta el día: «Llega hoy antes de las 3:40 p. m.» → «Llega hoy» */
    var etiqueta = r ? r.texto.split(' antes de ')[0] : '';
    if (etiqueta !== etiquetaLlega) {
      etiquetaLlega = etiqueta;
      document.querySelectorAll('#grilla .llega, #rotan .llega').forEach(function (s) { s.textContent = etiqueta; s.hidden = !etiqueta; });
    }
  }
  /* En el pie de la ficha: cuándo llega (solo si el producto hay) y, si faltan pocas horas para que deje
     de llegar hoy, hasta qué hora se puede pedir. Sin horario o sin llegada.js, el pie queda solo con el botón. */
  var LIMITE_VISIBLE_MIN = 180;
  function pintarLlegadaFicha(r) {
    var caja = $('fichaLlega'), p = ficha.id !== null ? por[ficha.id] : null;
    var lim = r && p && p.disponible && window.PE && window.PE.limiteHoy
      ? intentar(function () { return window.PE.limiteHoy(new Date(), cat.horario); }) || null : null;
    var conLimite = !!lim && lim.minutos >= 1 && lim.minutos <= LIMITE_VISIBLE_MIN;
    caja.hidden = !(r && p && p.disponible);
    if ($('fichaLlegaTexto').textContent !== (r ? r.texto : '')) $('fichaLlegaTexto').textContent = r ? r.texto : '';
    $('fichaLimite').hidden = !conLimite;
    $('fichaLimite').textContent = conLimite ? lim.texto : '';
  }

  /* ---------- Cuentas ---------- */
  /* A cuánto sale cada uno llevando `n`: el precio de uno y, desde cada «desde», el de ese precio por
     cantidad. Los manda el CRM (`escalones`, los mismos del POS) y con esa misma tabla cobra el pedido:
     lo que suma la canasta es lo que llega a cobrarse. Un escalón mal formado no cuenta. */
  function precioDe(p, n) {
    var precio = p.precio;
    (Array.isArray(p.escalones) ? p.escalones : []).forEach(function (e) {
      if (e && typeof e.desde === 'number' && typeof e.precio === 'number' && e.precio > 0 && n >= e.desde) precio = e.precio;
    });
    return precio;
  }
  /* ---------- Promociones ---------- */
  /* El CRM manda `promo` ({precio, normal, porcentaje, hasta, tope}) solo mientras vale y si rebaja.
     Se revisa igual aquí: una tienda abierta desde ayer no anuncia la que ya terminó. «hasta» es el
     último día completo, en hora de Colombia. */
  function hoyColombia() { return new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10); }
  function finDe(promo) { return Date.parse(promo.hasta + 'T23:59:59.999-05:00'); }
  function promoDe(p) {
    var x = p && p.promo;
    if (!x || typeof x !== 'object' || typeof x.precio !== 'number' || !(x.precio > 0) || !(x.precio < p.precio)) return null;
    if (typeof x.hasta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.hasta) || x.hasta < hoyColombia()) return null;
    return x;
  }
  /* Lo que se ve como precio de uno: el de la promoción si hay */
  function precioVisto(p) { var x = promoDe(p); return x ? x.precio : p.precio; }
  /* Lo que cuesta llevar `n`: con promoción, sus unidades (hasta el tope) a precio de promoción, que
     gana al precio por cantidad; lo que pasa del tope, al precio normal de esa cantidad. Igual que el CRM. */
  function totalDe(p, n) {
    var x = promoDe(p);
    if (!x) return n * precioDe(p, n);
    var en = x.tope > 0 ? Math.min(n, x.tope) : n;
    return en * x.precio + (n - en) * precioDe(p, n);
  }
  /* «Hasta el 15 nov» o, el último día, cuánto falta («Termina en 3 h 12 min»). */
  var formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
  function textoFin(x) {
    var falta = finDe(x) - Date.now();
    if (x.hasta !== hoyColombia() || !(falta > 0)) return 'Hasta el ' + formatoDia.format(new Date(finDe(x))).replace(' de ', ' ').replace('.', '');
    var h = Math.floor(falta / 36e5), m = Math.floor(falta % 36e5 / 6e4), sg = Math.floor(falta % 6e4 / 1e3);
    return 'Termina en ' + (h ? h + ' h ' : '') + (h || m ? m + ' min ' : '') + (h ? '' : sg + ' s');
  }
  /* Los textos del último día corren solos (uno por segundo, solo con la pestaña a la vista) */
  var relojPromos = 0;
  function vigilarPromos() {
    if (relojPromos) return;
    relojPromos = setInterval(function () {
      if (document.hidden) return;
      var vivos = document.querySelectorAll('[data-fin-promo]');
      if (!vivos.length) { clearInterval(relojPromos); relojPromos = 0; return; }
      vivos.forEach(function (n) { var x = promoDe(por[n.dataset.finPromo]); if (x) n.textContent = textoFin(x); });
    }, 1000);
  }
  /* El precio con su promoción: «-20 %», el de promoción y el normal tachado; y, aparte, hasta cuándo */
  function pintarPrecio(nodo, p) {
    var x = promoDe(p);
    nodo.textContent = '';
    nodo.classList.toggle('con-promo', !!x);
    if (!x) { nodo.textContent = pesos(p.precio); return null; }
    var antes = el('s', 'antes', pesos(p.precio));
    antes.setAttribute('aria-label', 'Antes ' + pesos(p.precio));
    nodo.append(el('span', 'ahora', pesos(x.precio)), antes);
    var fin = el('span', 'fin-promo', textoFin(x));
    if (x.hasta === hoyColombia()) { fin.dataset.finPromo = p.id; fin.classList.add('ultimo-dia'); vigilarPromos(); }
    return fin;
  }
  function selloPromo(p) {
    var x = promoDe(p);
    return x && x.porcentaje > 0 ? el('span', 'sello promo', '-' + x.porcentaje + ' %') : null;
  }

  function cuentas() {
    var n = 0, s = 0;
    Object.keys(canasta).forEach(function (id) { n += canasta[id]; s += totalDe(por[id], canasta[id]); });
    var d = s === 0 || s >= cat.domicilio.gratis_desde ? 0 : cat.domicilio.tarifa;
    /* Con el cupón del primer domicilio, el pedido que pagaría domicilio no lo paga (el CRM hace la misma cuenta) */
    var cupon = d > 0 ? cuponDomicilio() : '';
    if (cupon) d = 0;
    return { n: n, s: s, d: d, t: s + d, cupon: cupon };
  }
  /* El código del primer cupón de domicilio que le queda a quien entró, o '' */
  function cuponDomicilio() {
    var l = cuenta && Array.isArray(cuenta.cupones) ? cuenta.cupones : [];
    for (var i = 0; i < l.length; i++) {
      if (l[i] && l[i].tipo === 'primer_domicilio' && typeof l[i].codigo === 'string' && l[i].codigo) return l[i].codigo;
    }
    return '';
  }
  /* El cupón ya se usó (o la tienda no lo aceptó): sale de esta pantalla */
  function soltarCupon(codigo) {
    if (cuenta && Array.isArray(cuenta.cupones)) cuenta.cupones = cuenta.cupones.filter(function (c) { return !c || c.codigo !== codigo; });
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
    document.querySelectorAll('#grilla [data-ctrl="' + id + '"], #rotan [data-ctrl="' + id + '"], #ficha [data-ctrl="' + id + '"]').forEach(function (v) {
      var nuevo = control(por[id]), enFicha = !!v.closest('#ficha');
      var tenia = enFicha && v.contains(document.activeElement) ? document.activeElement : null;
      nuevo.dataset.ctrl = id;
      /* «+ Agregar» se abre en − n + con un rebote; después, al cambiar la cantidad, late el número (tienda.css) */
      if (canasta[id]) nuevo.className = v.querySelector('.cant') ? 'cambia' : 'abre';
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
      b.addEventListener('click', function () { var r = b.getBoundingClientRect(); cambiar(p.id, 1); intentar(function () { volar(p.id); agregado(r); }); });
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
    s.addEventListener('click', function () { var r = s.getBoundingClientRect(); cambiar(p.id, 1); intentar(function () { volar(p.id); agregado(r); }); });
    c.append(m, o, s);
    w.appendChild(c);
    return w;
  }

  /* ---------- Filtros del catálogo, lo más pedido y el catálogo ---------- */
  /* Filtros en cascada (pedido del dueño, 11-nov-2026): una lista por nivel (categoría, tipo, marca, medida y
     color). Cada uno ofrece solo lo que queda con los de antes puestos, con cuántos productos hay, y al cambiar uno
     se sueltan los que siguen. Un nivel sale si tiene de dónde escoger (dos valores o más) o si ya tiene uno puesto.
     Los valores salen de lo que manda el CRM: la categoría, «tipo» (lo que es, de la ficha guiada) y los detalles. */
  var NIVELES = [
    { clave: 'cat', titulo: 'Categoría', todos: 'Todas' },
    { clave: 'tipo', titulo: 'Tipo', todos: 'Todos' },
    { clave: 'marca', titulo: 'Marca', todos: 'Todas' },
    { clave: 'medida', titulo: 'Medida', todos: 'Todas' },
    { clave: 'color', titulo: 'Color', todos: 'Todos' }
  ];
  /* El valor de un producto en un nivel: [llave para comparar, texto para mostrar]; '' si no tiene */
  function valorNivel(p, clave) {
    if (clave === 'cat') return p.categoria && cats[p.categoria] ? [p.categoria, cats[p.categoria].nombre] : ['', ''];
    var v;
    if (clave === 'tipo') v = typeof p.tipo === 'string' ? p.tipo : '';
    else {
      var d = (Array.isArray(p.detalles) ? p.detalles : []).filter(function (x) { return x && norm(String(x.nombre || '')) === clave; })[0];
      v = d ? String(d.valor || '') : '';
    }
    v = v.replace(/\s+/g, ' ').trim();
    if (!v) return ['', ''];
    return [norm(v), v.charAt(0).toUpperCase() + v.slice(1)];
  }
  /* ¿Pasa el producto los niveles puestos antes de `hasta` (todos si no se dice)? */
  function pasaNiveles(p, hasta) {
    for (var i = 0; i < NIVELES.length && NIVELES[i].clave !== hasta; i++) {
      var k = NIVELES[i].clave;
      if (filtro[k] && valorNivel(p, k)[0] !== filtro[k]) return false;
    }
    return true;
  }
  /* Lo que se puede escoger en un nivel: [{llave, texto, n}], ordenado (las medidas, por su número) */
  function opcionesNivel(clave) {
    var vistos = {};
    cat.productos.forEach(function (p) {
      if (!pasaNiveles(p, clave)) return;
      var v = valorNivel(p, clave);
      if (!v[0]) return;
      if (!vistos[v[0]]) vistos[v[0]] = { llave: v[0], texto: v[1], n: 0 };
      vistos[v[0]].n++;
    });
    return Object.keys(vistos).map(function (k) { return vistos[k]; }).sort(function (a, b) {
      return a.texto.localeCompare(b.texto, 'es', { numeric: true, sensitivity: 'base' });
    });
  }
  function pintarCategorias() {
    var caja = $('cats');
    caja.textContent = '';
    NIVELES.forEach(function (nv) {
      var ops = opcionesNivel(nv.clave), puesto = filtro[nv.clave] || '';
      /* lo puesto ya no está (otro catálogo): se suelta */
      if (puesto && !ops.some(function (o) { return o.llave === puesto; })) { filtro[nv.clave] = ''; puesto = ''; }
      if (ops.length < 2 && !puesto) return;
      var lab = el('label', 'nivel' + (puesto ? ' puesto' : ''));
      lab.appendChild(el('span', 'nivel-tit', nv.titulo));
      var sel = el('select');
      sel.id = 'f-' + nv.clave;
      sel.dataset.nivel = nv.clave;
      var todos = el('option', '', nv.todos);
      todos.value = '';
      sel.appendChild(todos);
      ops.forEach(function (o) {
        var op = el('option', '', o.texto + ' (' + o.n + ')');
        op.value = o.llave;
        sel.appendChild(op);
      });
      sel.value = puesto;
      lab.appendChild(sel);
      caja.appendChild(lab);
    });
  }
  /* Cambió un nivel: queda ese, se sueltan los que siguen */
  function cambiarNivel(clave, valor) {
    var suelta = false;
    NIVELES.forEach(function (nv) {
      if (suelta) filtro[nv.clave] = '';
      if (nv.clave === clave) { filtro[clave] = valor; suelta = true; }
    });
    soloFavoritos = false;
    filtro.q = ''; $('q').value = '';
    pintar();
    var nuevo = $('f-' + clave);
    if (nuevo) nuevo.focus();
  }
  function hayNiveles() { return NIVELES.some(function (nv) { return !!filtro[nv.clave]; }); }
  /* Lo puesto en los niveles, para la línea del filtro: «Aluminio · Molde · 16 oz» */
  function textoNiveles() {
    return NIVELES.filter(function (nv) { return filtro[nv.clave]; }).map(function (nv) {
      var o = opcionesNivel(nv.clave).filter(function (x) { return x.llave === filtro[nv.clave]; })[0];
      return o ? o.texto : '';
    }).filter(Boolean).join(' · ');
  }

  /* Qué se ve y en qué orden. Buscando con «Más pedidos» manda lo más parecido a lo escrito
     (PE.buscar: el código exacto va primero); con otro orden, el que escogió la persona. */
  function listar() {
    var PE = window.PE || {}, consulta = filtro.q.trim(), modo = $('orden').value;   /* PE: tienda/buscar.js */
    /* Favoritos: lo guardado con el corazón, el último primero (solo lo que sigue en la tienda) */
    if (soloFavoritos) {
      var favs = guardados ? idsDe(guardados.favoritos).filter(function (id) { return por[id]; }).map(function (id) { return por[id]; }) : [];
      return { lista: favs, consulta: '', buscando: false };
    }
    var base = cat.productos.filter(function (p) { return pasaNiveles(p); });
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

  /* Las páginas del catálogo: «Anterior», los números (con … si son muchas) y «Siguiente». Con una sola no sale. */
  function pintarPaginas(paginas) {
    var nav = $('paginas');
    nav.textContent = '';
    nav.hidden = paginas < 2;
    if (paginas < 2) return;
    var boton = function (texto, n, clase, etiqueta) {
      var b = el('button', 'pag' + (clase ? ' ' + clase : ''), texto);
      b.type = 'button';
      b.dataset.pagina = String(n);
      if (etiqueta) b.setAttribute('aria-label', etiqueta);
      if (n === pagina && !clase) b.setAttribute('aria-current', 'page');
      if (n < 1 || n > paginas) b.disabled = true;
      nav.appendChild(b);
    };
    boton('‹ Anterior', pagina - 1, 'pag-ant', 'Página anterior');
    var vistos = [];
    for (var n = 1; n <= paginas; n++) {
      if (n === 1 || n === paginas || Math.abs(n - pagina) <= 1) vistos.push(n);
    }
    vistos.forEach(function (n, k) {
      if (k && n - vistos[k - 1] > 1) nav.appendChild(el('span', 'pag-salto', '…'));
      boton(String(n), n, '', 'Página ' + n + ' de ' + paginas);
    });
    boton('Siguiente ›', pagina + 1, 'pag-sig', 'Página siguiente');
  }
  function irAPagina(n) {
    pagina = n;
    pintar();
    var v = $('vitrina'), y = v.getBoundingClientRect().top + window.scrollY - document.querySelector('.cab').offsetHeight - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: QUIETO ? 'auto' : 'smooth' });
  }

  /* Una tarjeta de producto (la misma en lo más pedido y en el catálogo) */
  function tarjeta(p, favs) {
    var li = el('li'), a = el('article', 'prod'), f = el('div', p.foto ? 'foto propia' : 'foto');
    if (p.fotos && p.fotos.length > 1) carrusel(f, p.fotos);
    else {
      var i = el('img');
      i.src = foto(p); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
      f.appendChild(i);
    }
    var sp = p.disponible ? selloPromo(p) : null;
    if (!p.disponible) f.appendChild(el('span', 'sello agotado', 'Agotado'));
    else if (sp) f.appendChild(sp);
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
    var pr = el('span', 'precio'), finPromo = pintarPrecio(pr, p);
    c.append(h3, el('span', 'unidad', 'Código ' + p.id), pr);
    if (finPromo) c.appendChild(finPromo);
    var cu = intentar(function () { return precioPorUnidad(p); });
    if (cu) c.appendChild(el('span', 'por-unidad', cu.valor + ' ' + cu.corto));
    if (p.disponible) { var llega = el('span', 'llega', etiquetaLlega); llega.hidden = !etiquetaLlega; c.appendChild(llega); }
    c.appendChild(ctrl);
    a.append(f, c);
    li.appendChild(a);
    return li;
  }

  function pintar() {
    var g = $('grilla'), r = listar(), lista = r.lista, favs = guardados ? idsDe(guardados.favoritos) : [];
    g.textContent = '';
    $('esqueleto').hidden = true;
    var empiezaABuscar = r.buscando && !buscando;
    buscando = r.buscando; verGuardados();
    /* Buscando quedan solo los resultados, pegados a la cabecera (tienda.css esconde lo demás); al empezar a
       buscar la página sube, que es donde salen */
    document.documentElement.classList.toggle('buscando', buscando);
    document.documentElement.classList.toggle('en-favoritos', soloFavoritos);
    if (empiezaABuscar) window.scrollTo(0, 0);
    /* Las tarjetas entran con movimiento cuando cambia lo que se ve (categoría, orden, entrar o salir de la
       búsqueda), no con cada letra que se escribe. Al abrir la tienda no: mientras cargan las letras y las
       fotos de arriba, una animación ahí le quita al navegador el ancla con la que deja quieta la vitrina */
    var con = [NIVELES.map(function (nv) { return filtro[nv.clave] || ''; }).join(','), $('orden').value, buscando, soloFavoritos, filtro.q.trim()].join('|');
    g.classList.remove('entra');
    if (pintadoCon !== null && con !== pintadoCon && !QUIETO) { void g.offsetWidth; g.classList.add('entra'); }
    /* cambió lo que se ve: vuelve a la primera página */
    if (con !== pintadoCon) pagina = 1;
    pintadoCon = con;
    var titulo = soloFavoritos ? 'Sus favoritos' : filtro.cat ? (cats[filtro.cat] || {}).nombre
      : (r.buscando ? 'Resultados para «' + r.consulta + '»' : 'Todos los productos');
    intentar(pintarCategorias);
    $('tituloVitrina').textContent = titulo;
    /* Con filtro: cuántos productos hay y el filtro puesto, que se quita con su ✕ (deja ver todo) */
    var conFiltro = !!(hayNiveles() || r.buscando), puesto = hayNiveles() ? textoNiveles() : '«' + r.consulta.trim() + '»';
    $('filtroLinea').hidden = !conFiltro;
    $('limpiar').hidden = !conFiltro;
    /* sin resultados no se cuenta: el aviso de «No lo encontramos» ya lo dice */
    $('conteo').textContent = lista.length ? lista.length + (lista.length === 1 ? ' producto' : ' productos') : '';
    $('limpiarTexto').textContent = conFiltro ? puesto : '';
    $('limpiar').setAttribute('aria-label', conFiltro ? 'Quitar ' + puesto + ' y ver todos los productos' : 'Ver todos los productos');
    $('avisoFicha').textContent = '';
    $('estado').textContent = lista.length ? ''
      : (soloFavoritos ? 'Toque el corazón de un producto y lo encuentra aquí.' : 'No lo encontramos. Escríbanos por WhatsApp y se lo conseguimos.');
    /* Buscó y no hay nada: el pedido se lo llevamos nosotros, con lo que escribió */
    var pedirlo = $('pedirloWa'), sinNada = r.buscando && !lista.length && !!cat.whatsapp;
    pedirlo.hidden = !sinNada;
    if (sinNada) pedirlo.href = 'https://wa.me/' + cat.whatsapp + '?text=' + encodeURIComponent('Hola, busco: ' + r.consulta);
    /* De a POR_PAGINA (pedido del dueño, 11-nov-2026): debajo, las páginas */
    var paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    if (pagina > paginas) pagina = paginas;
    lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).forEach(function (p) { g.appendChild(tarjeta(p, favs)); });
    intentar(function () { pintarPaginas(paginas); });
    intentar(pintarMasPedido);
    intentar(marcarSeccion);
    intentar(vigilarFotos);
  }

  /* Lo más pedido: hasta 12 de lo más vendido (lo dice el CRM con `destacado`), de a 4, y cada 5 s los
     siguientes (pedido del dueño, 11-nov-2026). Si el CRM todavía no tiene ventas que contar, se muestran los
     que tienen foto propia bajo el título «Recomendados»: nunca se llama «más pedido» a lo que no lo es.
     No cambia sola con el mouse o el dedo encima, con el foco adentro, con la pestaña escondida, con la ficha
     abierta, con «Pausar» ni con «menos movimiento»; los puntos dejan pasar a mano. */
  var POR_VUELTA = 4, CADA_VUELTA = 5000, MAX_ROTA = 12;
  var rota = { lista: [], pag: 0, reloj: null, pausada: false, encima: false, tocada: 0 };
  function poolMasPedido() {
    var hay = cat.productos.filter(function (p) { return p.disponible; });
    var top = hay.filter(function (p) { return p.destacado; });
    var lista = top.length ? top : hay.filter(function (p) { return p.foto; });
    return { lista: lista.slice(0, MAX_ROTA), deVerdad: top.length > 0 };
  }
  function vueltasRota() { return Math.ceil(rota.lista.length / POR_VUELTA); }
  function pintarMasPedido() {
    var sec = $('masPedido'), r = poolMasPedido();
    rota.lista = r.lista;
    sec.hidden = !r.lista.length;
    if (!r.lista.length) { pararRota(); return; }
    $('masPedidoTit').textContent = r.deVerdad ? 'Lo más pedido' : 'Recomendados';
    var v = vueltasRota();
    if (rota.pag >= v) rota.pag = 0;
    $('rotaCtrl').hidden = v < 2;
    $('rotaPausa').hidden = QUIETO;
    var puntos = $('rotaPuntos');
    if (puntos.children.length !== v) {
      puntos.textContent = '';
      for (var n = 0; n < v; n++) {
        var b = el('button', 'rota-punto');
        b.type = 'button'; b.dataset.vuelta = String(n);
        b.setAttribute('aria-label', 'Ver el grupo ' + (n + 1) + ' de ' + v);
        puntos.appendChild(b);
      }
    }
    pintarVuelta(false);
    if (!rota.reloj && v > 1 && !QUIETO) rota.reloj = setInterval(function () { intentar(pasoRota); }, CADA_VUELTA);
    if (v < 2) pararRota();
  }
  function pintarVuelta(mover) {
    var ul = $('rotan'), favs = guardados ? idsDe(guardados.favoritos) : [];
    var desde = rota.pag * POR_VUELTA, parte = rota.lista.slice(desde, desde + POR_VUELTA);
    /* la última vuelta se completa con las primeras: siempre se ven 4 */
    if (parte.length < POR_VUELTA && rota.lista.length > POR_VUELTA) parte = parte.concat(rota.lista.slice(0, POR_VUELTA - parte.length));
    ul.textContent = '';
    parte.forEach(function (p) { ul.appendChild(tarjeta(p, favs)); });
    ul.classList.remove('cambia');
    if (mover && !QUIETO) { void ul.offsetWidth; ul.classList.add('cambia'); }
    Array.prototype.forEach.call($('rotaPuntos').children, function (b, k) { b.setAttribute('aria-current', String(k === rota.pag)); });
    intentar(vigilarFotos);
  }
  function pararRota() { if (rota.reloj) { clearInterval(rota.reloj); rota.reloj = null; } }
  function pasoRota() {
    if (rota.pausada || rota.encima || document.hidden || buscando || soloFavoritos || $('masPedido').hidden) return;
    if ($('ficha').open || Date.now() - rota.tocada < 8000) return;
    irAVuelta(rota.pag + 1);
  }
  function irAVuelta(n) {
    var v = vueltasRota();
    if (!v) return;
    rota.pag = ((n % v) + v) % v;
    pintarVuelta(true);
  }
  function eventosRota() {
    var sec = $('masPedido');
    sec.addEventListener('mouseenter', function () { rota.encima = true; });
    sec.addEventListener('mouseleave', function () { rota.encima = false; });
    sec.addEventListener('focusin', function () { rota.encima = true; });
    sec.addEventListener('focusout', function (e) { if (!sec.contains(e.relatedTarget)) rota.encima = false; });
    sec.addEventListener('pointerdown', function () { rota.tocada = Date.now(); });
    $('rotaPuntos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vuelta]');
      if (b) irAVuelta(Number(b.dataset.vuelta));
    });
    $('rotaPausa').addEventListener('click', function () {
      rota.pausada = !rota.pausada;
      this.setAttribute('aria-pressed', String(rota.pausada));
      this.setAttribute('aria-label', rota.pausada ? 'Seguir pasando lo más pedido' : 'Pausar lo más pedido');
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

  /* Las direcciones de las fotos de un producto, la principal primero (sin fotos del CRM, la de su categoría) */
  function fotosDe(p) {
    return Array.isArray(p.fotos) && p.fotos.length
      ? p.fotos.map(function (n) { return FOTOS + encodeURIComponent(n); }) : [foto(p)];
  }
  var galeria = { lista: [], tira: null };   /* fotos de la ficha abierta y su tira (si son varias) */
  function fotoActual() { var t = galeria.tira; return t ? Math.round(t.scrollLeft / Math.max(1, t.clientWidth)) : 0; }
  function iconoAmpliar() {
    var s = document.createElementNS(SVG, 'svg'), t = document.createElementNS(SVG, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    t.setAttribute('d', 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
    s.appendChild(t);
    return s;
  }
  /* Galería de la ficha: «2 / 3» sobre la foto, el botón de ampliar y las miniaturas que llevan a cada foto */
  function pintarGaleria(f, lista) {
    var minis = $('fichaMinis'), total = lista.length;
    galeria = { lista: lista, tira: f.querySelector('.tira') };
    minis.textContent = '';
    minis.hidden = total < 2;
    var cuenta = el('span', 'foto-n'), ampliar = el('button', 'foto-ampliar');
    cuenta.hidden = total < 2; cuenta.setAttribute('aria-hidden', 'true');
    ampliar.type = 'button'; ampliar.id = 'fichaAmpliar';
    ampliar.setAttribute('aria-label', total > 1 ? 'Ver las ' + total + ' fotos en grande' : 'Ver la foto en grande');
    ampliar.appendChild(iconoAmpliar());
    f.append(cuenta, ampliar);
    function marcar() {
      var n = fotoActual();
      cuenta.textContent = (n + 1) + ' / ' + total;
      Array.prototype.forEach.call(minis.children, function (b, k) { b.setAttribute('aria-current', String(k === n)); });
    }
    if (total > 1) lista.forEach(function (url, n) {
      var b = el('button', 'galeria-mini'), i = el('img');
      b.type = 'button'; b.setAttribute('aria-label', 'Ver foto ' + (n + 1) + ' de ' + total);
      i.src = url; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
      b.appendChild(i);
      b.addEventListener('click', function () { if (galeria.tira) galeria.tira.scrollTo({ left: n * galeria.tira.clientWidth, behavior: 'smooth' }); });
      minis.appendChild(b);
    });
    if (galeria.tira) galeria.tira.addEventListener('scroll', marcar, { passive: true });
    marcar();
    ampliar.addEventListener('click', function () { abrirVisor(fotoActual(), ampliar); });
  }

  /* ---------- Visor: las fotos en grande, encima de la ficha ---------- */
  var visorDesde = null;   /* el botón que lo abrió: ahí vuelve el foco al cerrarlo */
  function visorActual() { var t = $('visorTira'); return Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); }
  function pintarVisorN() {
    var total = $('visorTira').children.length, n = visorActual();
    $('visorN').textContent = total > 1 ? (n + 1) + ' de ' + total : '';
    $('visorAnt').disabled = n <= 0; $('visorSig').disabled = n >= total - 1;
  }
  function abrirVisor(n, desde) {
    var t = $('visorTira'), total = galeria.lista.length;
    if (!total) return;
    t.textContent = '';
    galeria.lista.forEach(function (url, k) {
      var i = el('img'); i.src = url; i.alt = 'Foto ' + (k + 1) + ' de ' + total; i.decoding = 'async';
      t.appendChild(i);
    });
    $('visorAnt').hidden = $('visorSig').hidden = total < 2;
    $('visor').hidden = false;
    visorDesde = desde || null;
    t.scrollLeft = Math.max(0, Math.min(n, total - 1)) * t.clientWidth;
    pintarVisorN();
    $('visorCerrar').focus();
  }
  function moverVisor(d) {
    var t = $('visorTira'), n = Math.max(0, Math.min(t.children.length - 1, visorActual() + d));
    t.scrollTo({ left: n * t.clientWidth, behavior: 'smooth' });
  }
  function cerrarVisor() {
    if ($('visor').hidden) return false;
    $('visor').hidden = true;
    $('visorTira').textContent = '';
    var d = visorDesde; visorDesde = null;
    if (d && d.isConnected) { try { d.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
    return true;
  }

  /* Características y descripción: llegan del CRM; lo que no viene, o viene mal, no sale */
  function pintarDetalle(p) {
    var dets = Array.isArray(p.detalles) ? p.detalles.filter(function (x) {
      return x && typeof x.nombre === 'string' && typeof x.valor === 'string' && x.nombre.trim() && x.valor.trim();
    }) : [];
    var dl = $('fichaCaract'), desc = typeof p.descripcion === 'string' ? p.descripcion.trim() : '';
    dl.textContent = '';
    dets.forEach(function (x) {
      var fila = el('div', 'caract-fila');
      fila.append(el('dt', null, x.nombre.trim()), el('dd', null, x.valor.trim()));
      dl.appendChild(fila);
    });
    $('fichaDesc').textContent = desc;
    $('caractCaja').hidden = !dets.length;
    $('descCaja').hidden = !desc;
    $('fichaDetalle').hidden = !dets.length && !desc;
  }

  /* Precio por cantidad: «Desde 12: $900». Solo los que bajan el precio de uno */
  function pintarEscalones(p) {
    /* Con una promoción sin tope no cuenta ninguno: la promoción gana al precio por cantidad.
       Con tope sí, para lo que pase del tope. */
    var x = promoDe(p), sinTope = x && !(x.tope > 0);
    var ul = $('fichaEscalones'), lista = sinTope ? [] : (Array.isArray(p.escalones) ? p.escalones : []).filter(function (e) {
      return e && typeof e.desde === 'number' && e.desde > 1 && typeof e.precio === 'number' && e.precio > 0 && e.precio < p.precio;
    });
    ul.textContent = '';
    lista.forEach(function (e) {
      var li = el('li');
      li.append(el('span', null, 'Desde ' + formato.format(e.desde)), el('b', null, pesos(e.precio)));
      ul.appendChild(li);
    });
    $('escalonesCaja').hidden = !lista.length;
  }

  function pintarFicha(p) {
    var f = $('fichaFotos'), direcciones = fotosDe(p);
    f.textContent = '';
    f.className = p.foto ? 'foto propia' : 'foto';
    if (p.fotos && p.fotos.length > 1) carrusel(f, p.fotos);
    else {
      var i = el('img');
      i.src = foto(p); i.alt = ''; i.decoding = 'async';
      f.appendChild(i);
    }
    intentar(function () { pintarGaleria(f, direcciones); });
    intentar(function () { pintarDetalle(p); });
    $('fichaCat').textContent = (cats[p.categoria] || {}).nombre || '';
    $('fichaNombre').textContent = p.nombre;
    $('fichaCodigo').textContent = 'Código ' + p.id;
    var finFicha = pintarPrecio($('fichaPrecio'), p), xf = promoDe(p);
    $('fichaPromo').textContent = '';
    $('fichaPromo').hidden = !finFicha;
    if (finFicha) {
      $('fichaPromo').append(el('span', 'sello promo', '-' + xf.porcentaje + ' %'), finFicha);
      if (xf.tope > 0) $('fichaPromo').appendChild(el('span', 'tope-promo', 'Hasta ' + formato.format(xf.tope) + ' por pedido a este precio'));
    }
    var cu = intentar(function () { return precioPorUnidad(p); });
    $('fichaUnidad').textContent = cu ? 'Precio por ' + cu.largo + ': ' + cu.valor : '';
    $('fichaUnidad').hidden = !cu;
    intentar(function () { pintarEscalones(p); });
    var disp = $('fichaDisp');
    disp.textContent = p.disponible ? 'Disponible' : 'Agotado';
    disp.className = 'ficha-disp ' + (p.disponible ? 'hay' : 'no-hay');
    var ctrl = control(p);
    ctrl.dataset.ctrl = p.id;
    $('fichaControl').textContent = '';
    $('fichaControl').appendChild(ctrl);
    var fav = $('fichaFav');
    fav.hidden = !guardados; fav.dataset.fav = p.id; pintarCorazon(fav, esFavorito(p.id));
    /* Preguntar por WhatsApp: el chat abre con el nombre y el código ya escritos (sin número en catalogo.json no sale) */
    var wa = $('preguntarWa');
    wa.hidden = !cat.whatsapp;
    if (cat.whatsapp) wa.href = 'https://wa.me/' + cat.whatsapp + '?text=' + encodeURIComponent('Hola, tengo una pregunta sobre ' + p.nombre + ' (código ' + p.id + ').');
    var ul = $('parecidos'), lista = parecidos(p, 6);
    ul.textContent = '';
    $('parecidosCaja').hidden = !lista.length;
    lista.forEach(function (o) {
      var li = el('li'), b = el('button', 'parecido'), im = el('img', o.foto ? 'propia' : null);
      b.type = 'button';
      im.src = foto(o); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      b.append(im, el('span', 'nm', o.nombre), el('span', 'pr', pesos(precioVisto(o))));
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
    $('avisoFicha').textContent = '';
    pintarFicha(p);
    ficha.id = p.id;
    intentar(pintarLlegada);   /* el pie de la ficha dice cuándo llega este producto */
    if (!yaAbierta) {
      /* El foco vuelve a la tarjeta que la abrió: la chica de favoritos o vistos si vino de ahí; si no, al nombre
         de su tarjeta de la vitrina (también si se tocó la foto o se entró por el enlace) */
      ficha.desde = desde || document.querySelector('#grilla [data-ficha="' + p.id + '"]');
      ficha.lugar = lugarDe(ficha.desde);
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
    intentar(cerrarVisor);
    var d = $('ficha'), desde = ficha.desde, id = ficha.id;
    ficha.id = null; ficha.desde = null; ficha.empujada = false;
    document.documentElement.classList.remove('con-ficha');
    if (d.open) d.close();
    ['fichaFotos', 'fichaControl', 'parecidos', 'fichaMinis'].forEach(function (i) { $(i).textContent = ''; });
    galeria = { lista: [], tira: null };
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
  /* Lo que se miraba al abrir la ficha y dónde estaba: la sección de favoritos o vistos si la abrió una tarjeta
     de ahí (quedan encima de la vitrina), si no la vitrina; la vitrina va de segunda por si esa sección se fue. */
  function lugarDe(desde) {
    var v = $('vitrina'), zona = desde && desde.dataset && desde.dataset.zona ? $(desde.dataset.zona) : null;
    return [zona, v].filter(Boolean).map(function (n) { return { n: n, top: n.getBoundingClientRect().top }; });
  }
  /* Con la ficha abierta, arriba de la vitrina pudo aparecer «vistos» o «favoritos»: al cerrarla, lo que se
     miraba queda donde estaba (la tarjeta que la abrió sigue a la vista, con el foco). (Con history.back() el
     navegador devuelve su propio scroll DESPUÉS del popstate: por eso se repone un cuadro más tarde.) */
  function reponerLugar() {
    var lugar = ficha.lugar;
    if (ficha.id !== null || !lugar) return;
    ficha.lugar = null;
    var a = lugar.filter(function (x) { return x.n.isConnected && !x.n.hidden; })[0];
    var dif = a ? a.n.getBoundingClientRect().top - a.top : 0;
    if (dif && window.scrollY > 0) window.scrollBy(0, dif);
  }

  /* La dirección manda: #p=ID abre la ficha; un id que ya no existe avisa y deja la tienda normal */
  /* Un enlace con #c=… abre la tienda con esa categoría puesta (las tarjetas de la página principal llevan
     aquí). Vale el id del CRM o el nombre sin tildes ni mayúsculas, entero o su comienzo: #c=vasos encuentra
     «Vasos y platos». Si no hay ninguna así, la tienda abre con todo. La dirección se limpia después. */
  function slug(t) { return norm(String(t || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function categoriaDe(valor) {
    var v = slug(valor);
    if (!v) return '';
    var c = cat.categorias.filter(function (x) { return String(x.id) === valor; })[0]
      || cat.categorias.filter(function (x) { return slug(x.nombre) === v; })[0]
      || cat.categorias.filter(function (x) { return slug(x.nombre).indexOf(v) === 0; })[0];
    return c && cat.productos.some(function (p) { return p.categoria === c.id; }) ? c.id : '';
  }
  function filtroDeLaDireccion() {
    var m = /^#c=([^&]*)$/.exec(location.hash);
    if (!m) return false;
    var valor;
    try { valor = decodeURIComponent(m[1]); } catch (e) { valor = m[1]; }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ }
    var id = categoriaDe(valor);
    if (!id) return false;
    soloFavoritos = false;
    filtro = { cat: id, q: '' };
    $('q').value = '';
    return true;
  }
  function fichaDeLaDireccion() {
    var m = /^#p=([^&]*)$/.exec(location.hash);
    if (!m) { if (ficha.id !== null) soltarFicha(); return; }
    var id = m[1];
    if (/^\d{1,9}$/.test(id) && Object.prototype.hasOwnProperty.call(por, id)) {
      if (ficha.id !== Number(id)) abrirFicha(Number(id), false);
      return;
    }
    if (ficha.id !== null) soltarFicha();
    /* #avisoFicha (role=status) está siempre en la página, vacío: así el lector de pantalla anuncia el texto al llegar */
    $('avisoFicha').textContent = 'Ese producto ya no está en la tienda.';
    limpiarDireccion();
  }

  /* Compartir: el menú del teléfono si lo hay; si no, WhatsApp con el nombre y el enlace */
  function compartir(p) {
    var url = location.origin + RAIZ + '#p=' + p.id;
    function porWhatsApp() { window.open('https://wa.me/?text=' + encodeURIComponent(p.nombre + ' ' + url), '_blank', 'noopener'); }
    if (!navigator.share) { porWhatsApp(); return; }
    navigator.share({ title: p.nombre, text: p.nombre + ' · ' + pesos(precioVisto(p)), url: url }).catch(function (e) {
      if (!e || e.name !== 'AbortError') porWhatsApp();   /* cancelar el menú no es un error */
    });
  }

  function eventosFicha() {
    var d = $('ficha');
    $('fichaCerrar').addEventListener('click', cerrarFicha);
    d.addEventListener('click', function (e) { if (e.target === d) cerrarFicha(); });   /* el fondo oscuro */
    /* Escape y el «atrás» de Android: con el visor abierto cierra el visor; si no, la ficha */
    d.addEventListener('cancel', function (e) { e.preventDefault(); if (!cerrarVisor()) cerrarFicha(); });
    /* Tocar la foto grande la amplía (los puntos y el botón de ampliar hacen lo suyo) */
    $('fichaFotos').addEventListener('click', function (e) { if (!e.target.closest('.puntos, .foto-ampliar')) abrirVisor(fotoActual(), $('fichaAmpliar')); });
    $('visorCerrar').addEventListener('click', cerrarVisor);
    $('visorAnt').addEventListener('click', function () { moverVisor(-1); });
    $('visorSig').addEventListener('click', function () { moverVisor(1); });
    $('visorTira').addEventListener('scroll', pintarVisorN, { passive: true });
    $('visor').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); moverVisor(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); moverVisor(1); }
    });
    d.addEventListener('close', function () { if (!d.open) cerrarFicha(); });   /* si el navegador la cerró por su cuenta */
    $('compartir').addEventListener('click', function () { if (ficha.id !== null) compartir(por[ficha.id]); });
    $('fichaFav').insertBefore(iconoCorazon(), $('fichaFav').firstChild);
    $('fichaFav').addEventListener('click', function () { if (ficha.id !== null) alternarFavorito(ficha.id); });
    window.addEventListener('popstate', function () { fichaDeLaDireccion(); requestAnimationFrame(reponerLugar); });
    window.addEventListener('hashchange', function () { if (intentar(filtroDeLaDireccion)) { pintar(); $('vitrina').scrollIntoView({ behavior: QUIETO ? 'auto' : 'smooth' }); } });
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
    intentar(function () { subirFavoritos(ids); });
    /* la tarjeta de la vitrina y el corazón de la ficha son el mismo favorito */
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (b) { pintarCorazon(b, i < 0); });
    pintarGuardados();
    if (soloFavoritos) pintar();   /* viendo Favoritos, el que se quitó se va y el nuevo aparece */
  }
  /* Favoritos en la cuenta: el celular y el computador muestran los mismos. La primera vez que esta cuenta
     entra en este navegador se juntan los de aquí con los de la cuenta (no se pierde ninguno); de ahí en
     adelante manda la cuenta, así lo que se quita en un equipo se quita en todos. Sin respuesta del CRM
     (o un CRM que aún no los guarda) quedan solo en el navegador, como antes. */
  var favEnCuenta = false, favReloj = 0;
  function unirFavoritos(yo) {
    if (!guardados || !yo || !Array.isArray(yo.favoritos) || !yo.documento) return;
    var nube = idsDe({ leer: function () { return yo.favoritos; } }), lista = nube.slice(), marca = null;
    try { marca = localStorage.getItem(CLAVE_FAV_CUENTA); } catch (e) { /* sin almacenamiento */ }
    if (marca !== yo.documento) {
      /* primera vez de esta cuenta aquí: los de otra cuenta no se mezclan, los sueltos sí se juntan */
      if (!marca) idsDe(guardados.favoritos).forEach(function (id) { if (lista.indexOf(id) < 0) lista.push(id); });
      try { localStorage.setItem(CLAVE_FAV_CUENTA, yo.documento); } catch (e) { /* sin almacenamiento */ }
    }
    lista = lista.slice(0, MAX_FAVORITOS);
    favEnCuenta = true;
    var antes = idsDe(guardados.favoritos).join(',');
    guardados.favoritos.escribir(lista);
    if (lista.join(',') !== nube.join(',')) subirFavoritos(lista);
    if (lista.join(',') !== antes) {
      document.querySelectorAll('[data-fav]').forEach(function (b) { pintarCorazon(b, lista.indexOf(Number(b.dataset.fav)) >= 0); });
      intentar(pintarGuardados);
      if (soloFavoritos) pintar();
    }
  }
  function subirFavoritos(ids) {
    if (!favEnCuenta) return;
    clearTimeout(favReloj);
    favReloj = setTimeout(function () {
      fetch(FAVORITOS, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ favoritos: ids }) })
        .catch(function () { /* sin red: quedan en este navegador y se suben con el próximo cambio */ });
    }, 400);
  }
  /* Al volver a la pestaña (quizá con favoritos cambiados en el celular), se traen los de la cuenta */
  function favoritosAlVolver() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || !favEnCuenta) return;
      fetch(YO, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (yo) { if (yo && yo.ok) intentar(function () { unirFavoritos(yo); }); })
        .catch(function () { /* sin red: siguen los de aquí */ });
    });
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
    b.append(f, el('span', 'nm', p.nombre), el('span', 'pr', pesos(precioVisto(p))));
    b.addEventListener('click', function () { abrirFicha(p.id, true, b); });
    li.appendChild(b);
    return li;
  }
  /* Con algo escrito en el buscador se esconden: los resultados quedan arriba */
  function verGuardados() {
    ['favoritos', 'vistos'].forEach(function (z) { $(z).hidden = buscando || soloFavoritos || !Number($(z).dataset.n); });
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
    var cel = celular10(d.celular);
    if (!/^3\d{9}$/.test(cel)) mal('d-cel', 'El celular debe tener 10 dígitos y empezar por 3.');
    if (d.barrio.length < 3) mal('d-barrio', 'Elija o escriba su barrio.');
    if (d.direccion.length < 5) mal('d-dir', 'Escriba la dirección con el detalle.');
    if (!$('d-acepto').checked) mal('d-acepto', 'Falta autorizar el uso de sus datos.');
    ['d-nombre', 'd-cel', 'd-barrio', 'd-dir', 'd-acepto'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    malos.forEach(function (m) { $(m[0]).setAttribute('aria-invalid', 'true'); });
    var e = $('errores');
    e.textContent = malos.map(function (m) { return m[1]; }).join(' ');
    e.hidden = !malos.length;
    if (malos.length) $(malos[0][0]).focus();
    if (!malos.length) d.celular = cel.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    return !malos.length;
  }
  /* Lo último que esta cuenta escribió en este celular; si no hay, lo guardado en su cuenta («Mis datos»).
     Lo que dejó otra cuenta en este mismo celular no se le muestra a nadie más. */
  function pasoDatos() {
    var c = cuenta || {}, d = leerDatos();
    if (!c.documento || d.cuenta !== c.documento) d = {};
    $('d-nombre').value = d.nombre || c.nombre || '';
    $('d-cel').value = d.celular || c.celular || '';
    $('d-acepto').checked = !!d.acepto;
    $('errores').hidden = true;
    if (dirDeCuenta()) modoDireccion(true);
    else {
      /* Sin dirección en la cuenta: la última que escribió esta cuenta aquí, y la primera que ponga queda como la suya */
      $('d-barrio').value = d.barrio || c.barrio || '';
      $('d-dir').value = d.direccion || c.direccion || '';
      $('d-extra').value = d.extra || c.indicaciones || '';
      modoDireccion(false);
      $('usoGuardar').checked = true;
    }
    vista('datos');
    /* Con todo ya puesto, el botón queda a la vista para pedir en un toque; si no, el primer dato que falta */
    var falta = ['d-nombre', 'd-cel', 'd-barrio', 'd-dir'].filter(function (id) { return !$(id).value; })[0];
    $(falta || 'enviar').focus();
  }

  /* ---------- Dirección predeterminada ---------- */
  /* La de la cuenta («Mis datos») es la predeterminada: sale lista, en una tarjeta. «Cambiar» abre los campos
     y pregunta si la nueva es solo para este pedido o queda como la suya. Solo cuenta si pasaría la revisión
     del formulario (así nunca queda un error escondido detrás de la tarjeta). */
  function dirDeCuenta() {
    var c = cuenta || {};
    return String(c.barrio || '').trim().length >= 3 && String(c.direccion || '').trim().length >= 5 ? c : null;
  }
  function modoDireccion(guardada) {
    var g = dirDeCuenta(), tarjeta = !!(guardada && g);
    $('dirGuardada').hidden = !tarjeta;
    $('dirCampos').hidden = tarjeta;
    $('usarGuardada').hidden = tarjeta || !g;
    $('dirUso').hidden = tarjeta || !cuenta;
    if (!tarjeta) return;
    $('d-barrio').value = g.barrio.trim();
    $('d-dir').value = g.direccion.trim();
    $('d-extra').value = String(g.indicaciones || '').trim();
    $('dgDir').textContent = $('d-dir').value;
    $('dgBarrio').textContent = $('d-barrio').value + ', El Espinal';
    $('dgExtra').textContent = $('d-extra').value;
    $('dgExtra').hidden = !$('d-extra').value;
  }
  function cambiarDireccion() {
    modoDireccion(false);
    $('usoPedido').checked = true;
    $('d-dir').focus();
  }
  function usarGuardada() {
    modoDireccion(true);
    $('cambiarDir').focus();
  }
  /* «Guardarla como mi dirección»: queda en la cuenta, como si la hubiera puesto en «Mis datos». Se guarda solo si
     el pedido llegó, y si no se puede no estorba: el pedido ya va con esa dirección. El nombre de la cuenta no cambia. */
  function guardarDireccion(d) {
    var nombre = String(cuenta.nombre || '').trim();
    var cuerpo = { nombre: nombre.length >= 3 ? nombre : d.nombre, barrio: d.barrio, direccion: d.direccion, indicaciones: d.extra };
    return fetch(DATOS, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error('no'); return j; }); })
      .then(function () {
        if (!cuenta) return;
        cuenta.barrio = cuerpo.barrio; cuenta.direccion = cuerpo.direccion; cuenta.indicaciones = cuerpo.indicaciones;
      })
      .catch(function () { /* queda la de antes; la puede cambiar en «Mis datos» */ });
  }

  /* ---------- Ubicación de entrega (PE.dentroDeEntrega, tienda/ubicacion.js) ---------- */
  /* «Ubícame en el mapa» adjunta el punto del GPS a las indicaciones, solo si cae dentro del
     radio de catalogo.json ("entrega"). Sin GPS en el navegador, sin "entrega" o sin ubicacion.js el
     botón no sale y todo sigue como siempre. Si el GPS se niega o no responde, se puede pedir igual.
     Un punto impreciso (coords.accuracy mayor que PRECISION_MAX_M) no se adjunta: se pide escribir la dirección.
     Un resultado nuevo (error, impreciso, fuera del radio) borra el enlace anterior: nunca viaja un punto viejo. */
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
    botonesUbicacion('buscando');
    pintarUbicado('Buscando su ubicación…', 'buscando');
    function terminar(texto, estado) {
      pintarUbicado(texto, estado);
      boton.disabled = false;
      botonesUbicacion(estado);
      if (teniaFoco && (!document.activeElement || document.activeElement === document.body ||
        document.activeElement.hidden)) boton.focus();
    }
    function noPudo() {
      if (mia === busquedaGps) terminar('No pudimos tomar su ubicación. Escriba la dirección y siga.', 'error');
    }
    try {
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (mia !== busquedaGps) return;   /* el pedido ya salió: esta respuesta llegó tarde */
        var c = pos && pos.coords, enlace = c ? window.PE.enlaceMapa(c.latitude, c.longitude) : '';
        if (!enlace) return noPudo();
        if (typeof c.accuracy === 'number' && c.accuracy > PRECISION_MAX_M) {
          return terminar('Su ubicación salió imprecisa. Escriba la dirección o intente otra vez con el GPS encendido.', 'error');
        }
        if (!window.PE.dentroDeEntrega(c.latitude, c.longitude, cat.entrega)) {
          return terminar('Esa ubicación queda fuera de El Espinal. Escriba la dirección donde lo recibe.', 'fuera');
        }
        enlaceUbicacion = enlace;
        $('ubicarVer').href = enlace;
        terminar('Ubicación lista ✓', 'ok');
      }, noPudo, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    } catch (e) { noPudo(); }
  }
  /* El pedido llegó a la tienda: la ubicación era de ese pedido */
  function soltarUbicacion() {
    enlaceUbicacion = ''; busquedaGps++;
    pintarUbicado('');
    $('ubicar').disabled = false;
    botonesUbicacion('');
  }
  /* Mientras busca: «Cancelar». Con el punto listo: «Ver en el mapa» (para revisarlo) y «Quitar». */
  function botonesUbicacion(estado) {
    $('ubicarCancelar').hidden = estado !== 'buscando';
    $('ubicarVer').hidden = estado !== 'ok';
    $('ubicarQuitar').hidden = estado !== 'ok';
  }
  /* Cancelar la búsqueda o quitar el punto: el pedido sigue sin ubicación; la respuesta que llegue tarde se descarta */
  function sinUbicacion() {
    soltarUbicacion();
    $('ubicar').focus();
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
    var cuerpo = {
      nombre: d.nombre, celular: d.celular,
      barrio: d.barrio, direccion: d.direccion, indicaciones: indicaciones,
      lineas: lineas
    };
    var cupon = cuentas().cupon;
    if (cupon) cuerpo.cupon = cupon;
    llamar('', 'POST', cuerpo).then(function (r) {
      /* Se mandó el cupón: o lo gastó este pedido o ya no servía; en los dos casos no se vuelve a ofrecer */
      if (cupon) soltarCupon(cupon);
      pedido = r;
      guardarPedido(pedido);
      /* El pedido ya está en la tienda: la canasta queda vacía para la próxima y lo PRIMERO es el paso de pago.
         Lo demás es repintar y recordar: si algo de eso falla, el pago ya está a la vista (si no, el cliente
         vería la canasta vacía sin pago y pediría otra vez). */
      canasta = {}; guardar();
      pasoPago();
      intentar(function () { recordarUltimo(lineas); });   /* para «Pedir lo de la última vez»; solo si el pedido llegó */
      intentar(soltarUbicacion);
      if (dirPorGuardar) { guardarDireccion(dirPorGuardar); dirPorGuardar = null; }
      intentar(pintar);
      intentar(pintarCanasta);
    }).catch(function (e) {
      /* La sesión se venció con la canasta armada: a entrar. La canasta queda guardada en este celular */
      if (e.estado === 401) { aLaEntrada(); return; }
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
    document.querySelectorAll('#pago [data-cancelar]').forEach(function (b) { b.hidden = pedido.puede_cancelar !== true; });
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
  /* En un celular (dedo, no mouse) el QR está en la misma pantalla que tendría que escanearlo:
     ahí manda la llave Bre-B, que se copia y se pega en la app del banco. */
  function enCelular() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  function pintarQr() {
    var pago = (cat && cat.pago) || {};
    var llave = String(pago.llave || '').trim();
    var celular = enCelular() && !!llave;
    $('qrImg').hidden = !pago.qr;
    $('qrFalta').hidden = !!pago.qr;
    $('yaPague').disabled = !pago.qr && !llave;
    if (pago.qr) $('qrImg').src = pago.qr;
    $('qrLlave').hidden = !llave;
    $('qrLlaveNum').textContent = llave;
    /* A nombre de quién le sale en su banco: así sabe que la plata va a la tienda */
    var titular = typeof pago.titular === 'string' ? pago.titular.trim() : '';
    $('qrTitular').hidden = !titular;
    $('qrTitular').textContent = titular ? 'Le sale a nombre de ' + titular : '';
    $('pqr').classList.toggle('celular', celular);
    $('pasosCelu').hidden = !celular;
    $('pasosCompu').hidden = celular;
    $('qrAlterno').hidden = !celular || !pago.qr;
    $('guardarQr').hidden = !celular || !pago.qr;
    if (pago.qr) $('guardarQr').setAttribute('href', pago.qr);
    $('copiado').textContent = '';
  }
  /* Copiar la llave o el valor: con el portapapeles del navegador y, si no deja, a la antigua */
  var relojCopia = {};
  function copiar(texto, boton, que) {
    function listo(ok) {
      var antes = boton.dataset.texto || boton.textContent;
      boton.dataset.texto = antes;
      boton.textContent = ok ? '¡Copiado!' : antes;
      boton.classList.toggle('hecho', ok);
      $('copiado').textContent = ok ? que + ': ' + texto : 'No se pudo copiar. Mantenga el dedo sobre ' + texto + ' para copiarlo.';
      clearTimeout(relojCopia[boton.id]);
      relojCopia[boton.id] = setTimeout(function () { boton.textContent = antes; boton.classList.remove('hecho'); }, 2000);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { listo(true); }, function () { listo(copiarALaAntigua(texto)); });
    } else {
      listo(copiarALaAntigua(texto));
    }
  }
  function copiarALaAntigua(texto) {
    var t = document.createElement('textarea');
    t.value = texto;
    t.setAttribute('readonly', '');
    t.className = 'fuera';
    document.body.appendChild(t);
    t.select();
    var ok;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
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
  /* Un video corto por estado (Higgsfield, sin sonido, en bucle). Con menos movimiento pedido, sin datos
     de sobra o si el video no carga, queda el ícono de siempre. */
  var ESCENAS = { POR_CONFIRMAR: 'confirmando', POR_ALISTAR: 'alistando', EN_CAMINO: 'en-camino', ENTREGADO: 'entregado' };
  function pintarEscena() {
    var v = $('fVideo'), nombre = ESCENAS[pedido.estado];
    var quieto = QUIETO || (navigator.connection && navigator.connection.saveData);
    if (!nombre || quieto || !v.canPlayType || !v.canPlayType('video/mp4')) { v.hidden = true; v.removeAttribute('src'); $('fIcono').hidden = false; return; }
    var src = '/tienda/img/pedido/' + nombre + '.mp4';
    if (v.dataset.escena !== nombre) {
      v.dataset.escena = nombre;
      v.poster = '/tienda/img/pedido/' + nombre + '.webp';
      v.src = src;
      v.onerror = function () { v.hidden = true; $('fIcono').hidden = false; };
    }
    if (v.getAttribute('src') && !v.error) { v.hidden = false; $('fIcono').hidden = true; }
    var pr = v.play && v.play();
    if (pr && pr.catch) pr.catch(function () { /* sin reproducción automática: queda la imagen */ });
  }
  /* El carril de carga: cada estado tiene su viajero (celular, bolsa que se llena, moto, listo) y unas frases
     de lo que se está haciendo que van pasando solas mientras la pantalla está a la vista */
  var FRASES = {
    POR_CONFIRMAR: ['La tienda recibió su pedido', 'Revisando que todo esté disponible', 'En un momento se lo confirmamos'],
    POR_ALISTAR: ['Buscando sus productos en la bodega', 'Contando las cantidades', 'Empacando con cuidado', 'Revisando que no falte nada'],
    EN_CAMINO: ['Su pedido va en la moto', 'Rumbo a su dirección', 'Ya casi llega'],
    ENTREGADO: ['¡Gracias por su compra!'],
  };
  var frase = 0, relojFrases = null;
  function pintarCarga() {
    var c = $('fCarga'), lista = FRASES[pedido.estado];
    c.hidden = !lista;
    if (!lista) { clearInterval(relojFrases); relojFrases = null; return; }
    if (c.dataset.estado !== pedido.estado) { c.dataset.estado = pedido.estado; frase = 0; }
    $('fHaciendo').textContent = lista[frase % lista.length];
    if (relojFrases || QUIETO || lista.length < 2) return;
    relojFrases = setInterval(function () {
      var l = FRASES[pedido && pedido.estado];
      if (!l || $('final').hidden || document.hidden) { clearInterval(relojFrases); relojFrases = null; return; }
      frase++;
      var h = $('fHaciendo');
      h.textContent = l[frase % l.length];
      h.classList.remove('entra'); void h.offsetWidth; h.classList.add('entra');
    }, 3200);
  }
  /* Lo que pidió y lo que ha pasado, como texto (del CRM) */
  var HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
  function pintarSeguimiento() {
    var lineas = Array.isArray(pedido.lineas) ? pedido.lineas : [], novedades = Array.isArray(pedido.novedades) ? pedido.novedades : [];
    $('fSeguimiento').hidden = !lineas.length && !novedades.length;
    var ul = $('fLineas'); ul.textContent = '';
    lineas.forEach(function (l) {
      var li = el('li');
      li.append(el('b', 'lo-cant', formato.format(Number(l.cantidad) || 0) + ' ×'), el('span', null, String(l.nombre || '')));
      ul.appendChild(li);
    });
    var ol = $('fNovedades'), antes = ol.children.length;
    ol.textContent = '';
    novedades.forEach(function (n, i) {
      var li = el('li', i >= antes && antes > 0 ? 'nueva' : null), h = new Date(String(n.hora || ''));
      li.append(el('time', null, isNaN(h) ? '' : HORA.format(h)), el('span', null, String(n.texto || '')));
      ol.appendChild(li);
    });
  }
  function pintarFinal() {
    $('fIcono').textContent = ICONOS[pedido.estado] || '⏳';
    intentar(pintarEscena);
    intentar(pintarCarga);
    intentar(pintarSeguimiento);
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
    $('cancelarFinal').hidden = !pedido.puede_cancelar || !!pedido.final;
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
  /* La franja del pedido se ve unos segundos cuando algo cambia (o al volver a la tienda) y se va: ocupa mucho
     en el celular (pedido del dueño, 11-nov-2026). El pedido sigue en Mis pedidos, en el menú de la cuenta. */
  var AVISO_SEGUNDOS = 10, avisoDe = '', relojAviso = null;
  function pintarAviso() {
    var a = $('avisoPedido');
    if (!pedido || !pedido.codigo) { a.hidden = true; avisoDe = ''; clearTimeout(relojAviso); return; }
    var pendiente = faltaPago(pedido);
    var texto = pedido.codigo + ' · ' + (pendiente ? 'Falta terminar el pago' : (pedido.titulo || 'Pedido por confirmar'));
    $('avisoTexto').textContent = texto;
    if (texto === avisoDe) return;
    avisoDe = texto;
    a.hidden = false;
    clearTimeout(relojAviso);
    /* Con el pago a medias la franja se queda: es el camino de vuelta para terminarlo */
    if (!pendiente) relojAviso = setTimeout(function () { a.hidden = true; }, AVISO_SEGUNDOS * 1000);
  }
  /* Falta el pago: no escogió cómo pagar, o escogió QR y no tocó «PAGO CONFIRMADO» (pudo salirse de la pantalla) */
  function faltaPago(p) {
    return !!p && !p.final && (!p.estado || p.estado === 'POR_CONFIRMAR') && (!p.medio || (p.medio === 'qr' && !p.pago_avisado));
  }
  function abrirPedido() {
    abrir();
    if (faltaPago(pedido)) pasoPago(); else pasoFinal();
  }
  /* Abrir un pedido por su código (desde «Mis pedidos» o un enlace #pedido=PE-…): con la sesión de la cuenta el CRM
     lo da aunque este navegador no tenga su secreto, así se retoma en cualquier equipo */
  function abrirPedidoCodigo(codigo) {
    codigo = String(codigo || '').toUpperCase();
    if (!/^PE-[A-Z0-9]{3,8}$/.test(codigo)) return;
    if (pedido && pedido.codigo === codigo) { abrirPedido(); return; }
    llamar('/' + codigo, 'GET').then(function (r) {
      pedido = r; guardarPedido(pedido);
      abrirPedido();
      vigilar();
    }).catch(function () { /* no es de esta cuenta o ya no existe: la tienda sigue normal */ });
  }
  function pedidoDeLaDireccion() {
    var m = /^#pedido=(PE-[A-Za-z0-9]{3,8})$/.exec(location.hash);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ }
    abrirPedidoCodigo(m[1]);
  }
  /* Cancelar el pedido: hasta que salga a repartir (lo revisa el CRM). Se pregunta antes: no tiene vuelta atrás */
  function cancelarPedido(boton) {
    if (!pedido || !pedido.codigo) return;
    var aviso = pedido.medio === 'qr' && pedido.pago_avisado
      ? ' Si ya transfirió, le devolvemos la plata.' : '';
    if (!window.confirm('¿Cancelar el pedido ' + pedido.codigo + '?' + aviso)) return;
    var err = $('errCancelar'), errPago = $('errPago');
    err.hidden = true;
    ocupado(boton, true);
    llamar('/' + pedido.codigo + '/cancelar', 'POST', {}).then(function (r) {
      Object.assign(pedido, r); guardarPedido(pedido);
      pasoFinal();
    }).catch(function (e) {
      var donde = vistaActual() === 'pago' ? errPago : err;
      donde.textContent = e.message; donde.hidden = false;
    }).then(function () { ocupado(boton, false); });
  }

  /* ---------- Canasta ---------- */
  /* La franja de arriba dice desde cuánto el domicilio es gratis con el valor que manda el CRM;
     el del HTML queda solo de respaldo. */
  function pintarGratisDesde() {
    var g = cat.domicilio && cat.domicilio.gratis_desde;
    if (typeof g === 'number' && g > 0) $('gratisDesde').textContent = pesos(g);
  }
  function pintarCanasta() {
    var c = cuentas(), ul = $('items'), gratis = cat.domicilio.gratis_desde;
    ul.textContent = '';
    Object.keys(canasta).forEach(function (id) {
      var p = por[id], li = el('li'), i = el('img', p.foto ? 'propia' : null), mid = el('div');
      i.src = foto(p); i.alt = '';
      var cadaUno = precioDe(p, canasta[id]), xc = promoDe(p), total = totalDe(p, canasta[id]);
      mid.append(el('div', 'nm', p.nombre), control(p).firstChild);
      /* Con promoción la línea lo dice (y el tope, si se pasa); con precio por cantidad, a cuánto quedó cada uno */
      if (xc) {
        var pasa = xc.tope > 0 && canasta[id] > xc.tope;
        mid.appendChild(el('small', 'cada-uno promo', 'Promoción: ' + pesos(xc.precio) + ' cada uno'
          + (pasa ? ' hasta ' + formato.format(xc.tope) + '; los demás a ' + pesos(cadaUno) : '')));
      } else if (cadaUno !== p.precio) mid.appendChild(el('small', 'cada-uno', pesos(cadaUno) + ' cada uno por llevar ' + formato.format(canasta[id])));
      li.append(i, mid, el('span', 'v', pesos(total)));
      ul.appendChild(li);
    });
    var vacia = c.n === 0;
    var arriba = $('n');   /* la canasta de arriba ya no existe en la tienda (la de abajo es la única) */
    if (arriba) { arriba.hidden = vacia; arriba.textContent = c.n; }
    intentar(function () { pintarAbajo(c, gratis); });
    $('dom').textContent = vacia ? '$0' : (c.d ? pesos(c.d) : 'Gratis');
    $('falta').textContent = c.cupon ? '· con su cupón' : (!vacia && c.s < gratis ? '· gratis si agrega ' + pesos(gratis - c.s) : '');
    $('dom').classList.toggle('con-cupon', !!c.cupon);
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
  function verTodo() { soloFavoritos = false; filtro = { cat: '', q: '' }; $('q').value = ''; pintar(); }

  /* ---------- Abajo (celular): la canasta en su círculo y la tira del domicilio gratis ---------- */
  /* El círculo dice cuántos productos lleva (y el total, para quien lo oye) y su aro se llena hacia el domicilio
     gratis; la tira de encima lo dice con letras y sale solo con algo en la canasta. Las cifras son las de
     cuentas(): las mismas que cobra la canasta. */
  function pintarAbajo(c, gratis) {
    var vacia = c.n === 0, conMeta = typeof gratis === 'number' && gratis > 0;
    var falta = conMeta ? Math.max(0, gratis - c.s) : 0, llego = !vacia && falta === 0;
    var avance = vacia ? 0 : (conMeta ? Math.min(100, c.s / gratis * 100) : 100);
    var b = $('barra'), f = $('flota'), t = $('flotaTxt');
    $('barraN').hidden = vacia; $('barraN').textContent = c.n;
    b.setAttribute('aria-label', vacia ? 'Canasta vacía' : 'Canasta: ' + c.n + (c.n === 1 ? ' producto, ' : ' productos, ') + pesos(c.t));
    b.style.setProperty('--avance', avance + '%');
    b.classList.toggle('gratis', llego);
    f.hidden = vacia;
    f.classList.toggle('gratis', llego);
    t.textContent = '';
    if (!vacia) {
      t.append('Lleva ', el('b', null, pesos(c.s)), ' · ');
      if (llego) t.append(el('b', 'si', 'domicilio gratis'));
      else if (c.cupon) t.append(el('b', 'si', 'domicilio gratis con su cupón'));
      else t.append('faltan ', el('b', null, pesos(falta)), ' para domicilio gratis');
    }
    $('flotaTubo').style.width = avance + '%';
    document.documentElement.classList.toggle('con-canasta', !vacia);   /* el pie deja espacio a la tira */
    /* Lo que pasó desde la última vez: la canasta salta si cambió lo que lleva, y se celebra al LLEGAR al
       domicilio gratis (no al abrir la tienda con una canasta que ya lo tenía) */
    if (llevaba !== null && c.n !== llevaba) saltar(canastaVisible());
    if (eraGratis === false && llego && conMeta) celebrar('¡Su domicilio ya es gratis!');
    llevaba = c.n; eraGratis = llego;
  }

  /* ---------- Movimiento (nada de esto corre si la persona pidió menos movimiento) ---------- */
  /* La canasta que se ve: en el celular el círculo de abajo, en el computador la de la cabecera */
  function canastaVisible() {
    return [$('barra'), document.querySelector('.cab .btn-canasta')].filter(function (b) { return b && b.getBoundingClientRect().width > 0; })[0] || null;
  }
  function saltar(n) {
    if (QUIETO || !n) return;
    n.classList.remove('salta'); void n.offsetWidth; n.classList.add('salta');
  }
  /* Al agregar desde la vitrina, la foto del producto vuela a la canasta (con la ficha o la canasta abiertas
     no: la canasta no está a la vista) */
  function volar(id) {
    var destino = canastaVisible(), ctrl = document.querySelector('#grilla [data-ctrl="' + id + '"]');
    var tarjeta = ctrl ? ctrl.closest('.prod') : null, img = tarjeta ? tarjeta.querySelector('.foto img') : null;
    if (QUIETO || !destino || !img || !img.animate || $('ficha').open || !$('panel').hidden) return;
    var r = img.getBoundingClientRect(), d = destino.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
    var v = el('img', 'volando');
    v.src = img.currentSrc || img.src; v.alt = '';
    v.style.left = r.left + 'px'; v.style.top = r.top + 'px'; v.style.width = r.width + 'px'; v.style.height = r.height + 'px';
    document.body.appendChild(v);
    var dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2);
    var a = v.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 70) + 'px) scale(.5)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.1)', opacity: 0.4 }
    ], { duration: 650, easing: 'cubic-bezier(.5,0,.7,1)' });
    a.onfinish = a.oncancel = function () { v.remove(); };
  }
  /* Aviso corto arriba, que se va solo. Con la ficha abierta va dentro de ella (la ficha tapa lo demás) */
  var relojTostada = null;
  function encima() { return $('ficha').open ? $('ficha') : document.body; }
  function avisar(texto) {
    var t = $('tostada'), casa = encima();
    if (t.parentNode !== casa) casa.appendChild(t);
    t.hidden = true; void t.offsetWidth;   /* si ya estaba, vuelve a entrar */
    t.textContent = texto; t.hidden = false;
    clearTimeout(relojTostada);
    relojTostada = setTimeout(function () { t.hidden = true; }, 3000);
  }
  /* El aviso y, encima, papelitos de los colores de la marca que caen */
  function celebrar(texto) {
    avisar(texto);
    if (QUIETO || !document.body.animate) return;
    var caja = el('div', 'confeti'), colores = ['#D42215', '#FFC933', '#1A44BE', '#0f7a43', '#ffffff'];
    caja.setAttribute('aria-hidden', 'true');
    encima().appendChild(caja);
    for (var i = 0; i < 40; i++) {
      var papel = el('i'), ang = Math.random() * Math.PI * 2, dist = 110 + Math.random() * 190;
      papel.style.background = colores[i % colores.length];
      caja.appendChild(papel);
      papel.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist - 80) + 'px) rotate(' + Math.random() * 720 + 'deg)', opacity: 1, offset: 0.6 },
        { transform: 'translate(' + Math.cos(ang) * dist * 1.1 + 'px,' + (Math.sin(ang) * dist + 260) + 'px) rotate(' + Math.random() * 900 + 'deg)', opacity: 0 }
      ], { duration: 1500 + Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(function () { caja.remove(); }, 2300);
  }

  /* Al agregar un producto: un chulo verde brota donde se tocó, con su aro, y un «+1» sube (tienda.css) */
  function agregado(r) {
    if (QUIETO || !document.body.animate || !r || !r.width) return;
    var casa = encima(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var chulo = el('span', 'agregado'), uno = el('span', 'mas-uno', '+1'), ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'), linea = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); linea.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
    svg.appendChild(linea); chulo.appendChild(svg);
    chulo.setAttribute('aria-hidden', 'true'); uno.setAttribute('aria-hidden', 'true');
    [chulo, uno].forEach(function (n) { n.style.left = x + 'px'; n.style.top = y + 'px'; casa.appendChild(n); });
    var a = chulo.animate([
      { transform: 'scale(.3)', opacity: 0, boxShadow: '0 0 0 0 rgba(15,122,67,.45)' },
      { transform: 'scale(1.12)', opacity: 1, offset: 0.35 },
      { transform: 'scale(1)', opacity: 1, boxShadow: '0 0 0 18px rgba(15,122,67,0)', offset: 0.75 },
      { transform: 'scale(.85)', opacity: 0, boxShadow: '0 0 0 18px rgba(15,122,67,0)' }
    ], { duration: 850, easing: 'ease-out' });
    var b = uno.animate([
      { transform: 'translate(-50%,-50%)', opacity: 0 },
      { transform: 'translate(-50%,-130%)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-280%)', opacity: 0 }
    ], { duration: 950, easing: 'ease-out' });
    a.onfinish = a.oncancel = function () { chulo.remove(); };
    b.onfinish = b.oncancel = function () { uno.remove(); };
  }
  /* Las tarjetas con varias fotos las pasan solas, rápido y cada una a su tiempo (pedido del dueño, 11-nov-2026):
     en cada vuelta pasa la mitad. Se quedan quietas las que no se ven, la que la persona acaba de tocar, con la
     ficha o la canasta abiertas, con la pestaña escondida o si pidió menos movimiento. */
  var vueltaFotos = 0, relojFotos = null;
  /* El reloj arranca la primera vez que la vitrina trae una tarjeta con varias fotos */
  function vigilarFotos() {
    if (!relojFotos && document.querySelector('#grilla .tira, #rotan .tira')) relojFotos = setInterval(function () { intentar(pasarFotos); }, 1200);
  }
  function pasarFotos() {
    vueltaFotos++;
    if (QUIETO || document.hidden || $('ficha').open || !$('panel').hidden) return;
    var ahora = Date.now(), alto = window.innerHeight;
    Array.prototype.forEach.call(document.querySelectorAll('#grilla .tira, #rotan .tira'), function (tira, k) {
      if ((vueltaFotos + k) % 2 || Number(tira.dataset.tocada || 0) > ahora - 6000) return;
      var r = tira.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > alto) return;
      var sigue = (Math.round(tira.scrollLeft / r.width) + 1) % tira.children.length;
      tira.scrollTo({ left: sigue * r.width, behavior: 'smooth' });
    });
  }
  /* Con algo en la canasta, el círculo da un saltico cada tanto: recuerda que el pedido está a un toque */
  function recordarCanasta() {
    if (cuentas().n && $('panel').hidden && !$('ficha').open && !document.hidden) saltar(canastaVisible());
  }

  /* ---------- Abajo (celular): la pastilla de secciones ---------- */
  /* La rayita amarilla va a la sección abierta: Favoritos mientras la vitrina muestra solo lo guardado, Buscar con
     el cursor en el buscador o algo escrito, e Inicio en lo demás. Mis pedidos vive en el menú de la cuenta. */
  function marcarSeccion() {
    var en = soloFavoritos ? 'favoritos' : (buscando || enBuscador ? 'buscar' : 'inicio');
    $('pastilla').dataset.en = en;
    [['buscar', 'abBuscar'], ['inicio', 'abInicio'], ['favoritos', 'abFavoritos']].forEach(function (x) {
      if (x[0] === en) $(x[1]).setAttribute('aria-current', 'true'); else $(x[1]).removeAttribute('aria-current');
    });
  }
  /* Inicio: la tienda como al abrirla (sin búsqueda, categoría ni favoritos) y arriba del todo */
  function vistaInicial() {
    soloFavoritos = false;
    filtro = { cat: '', q: '' };
    $('q').value = '';
    pintar();
  }
  function irAlInicio() { $('q').blur(); vistaInicial(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  /* Buscar: el cursor al buscador (en el celular sale el teclado) y arriba, donde salen los resultados */
  function irABuscar() {
    if (soloFavoritos) { soloFavoritos = false; pintar(); }
    $('q').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  /* Favoritos: la vitrina con lo guardado con el corazón, arriba del todo (lo demás se esconde, como buscando) */
  function irAFavoritos() {
    $('q').blur();
    soloFavoritos = true;
    filtro = { cat: '', q: '' };
    $('q').value = '';
    pintar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function eventosAbajo() {
    $('abInicio').addEventListener('click', irAlInicio);
    $('abBuscar').addEventListener('click', irABuscar);
    $('abFavoritos').addEventListener('click', irAFavoritos);
    $('q').addEventListener('focus', function () { enBuscador = true; marcarSeccion(); });
    $('q').addEventListener('blur', function () { enBuscador = false; marcarSeccion(); });
    marcarSeccion();
  }
  /* La cabecera suelta una sombra cuando la página ya bajó */
  function sombraCabecera() {
    var c = document.querySelector('.cab');
    if (c) c.classList.toggle('bajo', window.scrollY > 4);
  }
  /* La cuenta arriba: el círculo lleva la inicial de quien entró (sin nombre queda la silueta) */
  function pintarYo() {
    var n = cuenta && typeof cuenta.nombre === 'string' ? cuenta.nombre.trim() : '';
    if (n) $('yo').textContent = Array.from(n)[0].toUpperCase();
    /* La foto de perfil, si puso una, la pinta mi-cuenta/menu.js (cargue antes o después de esto) */
    if (cuenta) {
      window.PE_YO = cuenta;
      intentar(function () { document.dispatchEvent(new CustomEvent('pe:yo', { detail: cuenta })); });
    }
  }

  function eventos() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) { soloFavoritos = false; filtro = { cat: b.dataset.cat, q: '' }; $('q').value = ''; pintar(); }
      if (e.target.closest('[data-abrir]')) { vista('canasta'); abrir(); }
      var medio = e.target.closest('.medio');
      if (medio) elegirMedio(medio.dataset.medio);
      var billete = e.target.closest('.billete');
      if (billete) {
        document.querySelectorAll('.billete').forEach(function (x) { x.setAttribute('aria-pressed', String(x === billete)); });
        $('pagaCon').value = '';
      }
    });
    intentar(eventosRota);
    $('paginas').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pagina]');
      if (b && !b.disabled) irAPagina(Number(b.dataset.pagina));
    });
    $('ultimaVez').addEventListener('click', pedirLoDeLaUltimaVez);
    $('limpiar').addEventListener('click', function (e) { e.preventDefault(); verTodo(); });
    $('cats').addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-nivel]');
      if (sel) cambiarNivel(sel.dataset.nivel, sel.value);
    });
    $('q').addEventListener('input', function () { soloFavoritos = false; filtro = { cat: '', q: this.value }; pintar(); });
    $('orden').addEventListener('change', pintar);
    /* Enter o «Buscar»: a los resultados (buscando están arriba del todo); en el celular Enter además guarda el
       teclado para verlos */
    function aLosResultados() {
      if (buscando) window.scrollTo({ top: 0, behavior: 'smooth' }); else $('vitrina').scrollIntoView({ behavior: 'smooth' });
    }
    $('q').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      aLosResultados();
      if (enCelular()) this.blur();
    });
    $('btnq').addEventListener('click', aLosResultados);
    $('cerrar').addEventListener('click', cerrar);
    $('velo').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    $('vaciar').addEventListener('click', function () { canasta = {}; guardar(); pintar(); pintarCanasta(); cerrar(); });
    $('seguir').addEventListener('click', pasoDatos);
    $('ubicar').addEventListener('click', tomarUbicacion);
    $('ubicarCancelar').addEventListener('click', sinUbicacion);
    $('ubicarQuitar').addEventListener('click', sinUbicacion);
    $('cambiarDir').addEventListener('click', cambiarDireccion);
    $('usarGuardada').addEventListener('click', usarGuardada);
    $('volver').addEventListener('click', function () { vista('canasta'); });
    $('datos').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = leerFormulario();
      if (!cuentas().n || !validar(d)) return;
      d.acepto = true;
      d.cuenta = cuenta ? cuenta.documento : '';   /* de quién es lo guardado en este celular */
      guardarDatos(d);
      /* La dirección queda como la de la cuenta solo si lo escogió (y solo si el pedido llega) */
      dirPorGuardar = cuenta && !$('dirCampos').hidden && !$('dirUso').hidden && $('usoGuardar').checked ? d : null;
      enviarPedido(d);
    });
    $('yaPague').addEventListener('click', function () { pagar({ medio: 'qr', pagado: true }, this, 'errQr'); });
    $('copiarLlave').addEventListener('click', function () { copiar($('qrLlaveNum').textContent, this, 'Llave copiada'); });
    $('copiarValor').addEventListener('click', function () { copiar(String(Math.round(pedido.total)), this, 'Valor copiado'); });
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
    document.querySelectorAll('[data-cancelar]').forEach(function (b) { b.addEventListener('click', function () { cancelarPedido(b); }); });
    /* «Mis pedidos» (en su ventana) pide abrir un pedido: el que trae su código o el que está en curso aquí */
    window.addEventListener('pe:abrir-pedido', function (e) {
      var codigo = e && e.detail && typeof e.detail === 'string' ? e.detail : '';
      if (codigo) abrirPedidoCodigo(codigo);
      else if (pedido && pedido.codigo) abrirPedido();
    });
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
    return fetch(url, { cache: 'no-cache', credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  /* Sin sesión no hay tienda: a la entrada, que vuelve a esta misma dirección (con su #p=… si lo trae) */
  function aLaEntrada() {
    var pedida = location.pathname + location.search;
    location.replace(RAIZ + 'mi-cuenta/' + (pedida === RAIZ ? '' : '?volver=' + encodeURIComponent(pedida)) + location.hash);
  }
  /* Lo de catalogo.json es opcional: si no carga o el JSON está roto, la tienda sigue con {}. Los datos de
     quien entró también: sin ellos, los de entrega se escriben a mano. */
  Promise.all([json('/tienda/catalogo.json').catch(function () { return {}; }), json(CATALOGO), json(YO).catch(function () { return null; })])
    .then(function (r) {
      var sitio = r[0] && typeof r[0] === 'object' && !Array.isArray(r[0]) ? r[0] : {}, crm = r[1];
      if (!crm.ok) throw new Error('crm');
      /* El CRM dice que esa sesión no vale (galleta vencida o inventada): nadie ve la tienda sin cuenta */
      if (crm.sesion === false) { aLaEntrada(); return; }
      cuenta = r[2] && r[2].ok ? r[2] : null;
      if (!crm.productos || !crm.productos.length) { var v = new Error('vacío'); v.vacio = true; throw v; }
      cat = {
        domicilio: crm.domicilio, pago: sitio.pago, whatsapp: sitio.whatsapp, horario: sitio.horario,
        sinonimos: sitio.sinonimos, entrega: sitio.entrega,
        categorias: crm.categorias.map(function (c) {
          return { id: c.id, nombre: c.nombre, imagen: fotoCategoria(c.nombre, Array.isArray(sitio.categorias) ? sitio.categorias : []) };
        }),
        productos: crm.productos
      };
      cat.categorias.forEach(function (c) { cats[c.id] = c; });
      cat.productos.forEach(function (p) { por[p.id] = p; });
      /* Lo que ya no está o se agotó sale de la canasta guardada */
      Object.keys(canasta).forEach(function (id) { if (!por[id] || !por[id].disponible || !(canasta[id] > 0)) delete canasta[id]; });
      guardar();
      BARRIOS.forEach(function (b) { var o = el('option'); o.value = b; $('barrios').appendChild(o); });
      /* Lo que es un extra va con intentar: si falla, los productos se ven igual (nunca «No pudimos cargar») */
      $('ubicarCaja').hidden = !intentar(ubicacionDisponible);
      guardados = intentar(abrirGuardados) || null;
      intentar(function () { unirFavoritos(cuenta); });
      intentar(favoritosAlVolver);
      pintarCategorias();
      eventos();
      eventosFicha();
      intentar(eventosAbajo);
      var conFiltro = !!intentar(filtroDeLaDireccion);
      pintar();
      if (conFiltro) requestAnimationFrame(function () { $('vitrina').scrollIntoView(); });
      intentar(pintarGuardados);   /* favoritos y vistos, solo lo que sigue en la tienda */
      intentar(pintarUltimaVez);
      intentar(pintarGratisDesde);
      intentar(pintarYo);
      intentar(sombraCabecera);
      window.addEventListener('scroll', sombraCabecera, { passive: true });
      pintarCanasta();   /* también pinta la hora de llegada (que se cuida sola) */
      vista('canasta');
      pintarAviso();
      vigilar();
      intentar(fichaDeLaDireccion);   /* un enlace con #p=ID abre esa ficha */
      intentar(pedidoDeLaDireccion);  /* y uno con #pedido=PE-… abre ese pedido (desde «Mis pedidos») */
      setInterval(pintarLlegada, 60000);   /* la hora de llegada corre sola mientras la página está abierta */
      setInterval(function () { intentar(recordarCanasta); }, 15000);
    })
    .catch(function (e) {
      $('esqueleto').hidden = true;
      $('estado').textContent = e && e.vacio
        ? 'Estamos subiendo los productos a la tienda. Mientras tanto, escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.'
        : 'La tienda está en pausa por un momento. Escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.';
    });
})();
