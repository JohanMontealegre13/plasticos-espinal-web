/* Plásticos Espinal · tienda en línea (versión de prueba, detrás de contraseña).
   Lee /tienda/catalogo.json (en la fase 2 lo publica el CRM), arma la canasta y
   la manda por WhatsApp con un código de pedido y el [#código] de cada producto:
   el bot recalcula los precios con el CRM, así que el total del mensaje es solo
   una referencia para el cliente. Datos de la base: siempre textContent. */
(function () {
  'use strict';

  var CLAVE = 'pe-canasta-v1';
  var CLAVE_DATOS = 'pe-cliente-v1';   /* datos de entrega, solo en este celular */
  /* Barrios de El Espinal para sugerir (lista parcial: el cliente puede escribir otro) */
  var BARRIOS = ['Arkabal', 'Balkanes', 'Belén', 'Betania', 'Betania Campestre', 'Bosques de Roa',
    'Caballero y Góngora', 'Cafasur', 'El Centro', 'Entre Ríos', 'Fátima', 'Isaías Olivar',
    'La Cascada', 'La Esperanza', 'Libertador', 'Nacional', 'Primero de Mayo', 'Rondón',
    'San Rafael', 'Santa Margarita María', 'Talura', 'Villa Catalina', 'Villa Ceiba',
    'Villa Laura', 'Villa Lorena', 'Villa Paz'];
  var CAMPOS = { nombre: 'd-nombre', tipo: 'd-tipo', documento: 'd-doc', celular: 'd-cel',
    correo: 'd-correo', barrio: 'd-barrio', direccion: 'd-dir', extra: 'd-extra' };   /* dato -> campo */
  var cat = null;                 /* catálogo */
  var por = {};                   /* id -> producto */
  var cats = {};                  /* id -> categoría */
  var canasta = leer();           /* { id: cantidad } */
  var filtro = { cat: '', q: '', todo: false };
  var codigo = null;

  var $ = function (i) { return document.getElementById(i); };
  var formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  function pesos(n) { return '$' + formato.format(Math.round(n)); }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  /* ---------- Guardado en el navegador (si falla, la canasta vive solo en memoria) ---------- */
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; } }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(canasta)); } catch (e) { /* sin almacenamiento */ } }
  function leerDatos() { try { return JSON.parse(localStorage.getItem(CLAVE_DATOS)) || {}; } catch (e) { return {}; } }
  function guardarDatos(d) { try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } }

  function foto(p) { return p.imagen || (cats[p.categoria] || {}).imagen || '/img/productos/bodega.webp'; }

  /* ---------- Cuentas ---------- */
  function cuentas() {
    var n = 0, s = 0;
    Object.keys(canasta).forEach(function (id) { n += canasta[id]; s += canasta[id] * por[id].precio; });
    var d = s === 0 || s >= cat.domicilio.gratis_desde ? 0 : cat.domicilio.tarifa;
    return { n: n, s: s, d: d, t: s + d };
  }
  function cambiar(id, d) {
    var n = (canasta[id] || 0) + d;
    if (n <= 0) delete canasta[id]; else canasta[id] = Math.min(n, 999);
    guardar(); pintar(); pintarCanasta();
  }

  /* ---------- Selector − n + ---------- */
  function control(p) {
    var n = canasta[p.id] || 0, w = el('div');
    if (!n) {
      var b = el('button', 'mas', '+ Agregar');
      b.type = 'button';
      b.setAttribute('aria-label', 'Agregar ' + p.nombre + ' a la canasta');
      b.addEventListener('click', function () { cambiar(p.id, 1); });
      w.appendChild(b);
      return w;
    }
    var c = el('div', 'cant'), m = el('button', null, '−'), o = el('output', null, String(n)), s = el('button', null, '+');
    m.type = s.type = 'button';
    m.setAttribute('aria-label', 'Quitar uno de ' + p.nombre);
    s.setAttribute('aria-label', 'Agregar uno más de ' + p.nombre);
    o.setAttribute('aria-live', 'polite');
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
      var i = el('img'); i.src = c.imagen; i.alt = '';
      b.append(i, el('span', null, c.nombre));
      $('cats').appendChild(b);
    });
  }

  function pintar() {
    var g = $('grilla'), q = norm(filtro.q.trim());
    g.textContent = '';
    var lista = cat.productos.filter(function (p) {
      if (filtro.cat && p.categoria !== filtro.cat) return false;
      if (q && norm(p.nombre).indexOf(q) < 0) return false;
      return filtro.todo || p.destacado;
    });
    var titulo = filtro.cat ? (cats[filtro.cat] || {}).nombre
      : (q ? 'Resultados para «' + filtro.q.trim() + '»' : (filtro.todo ? 'Todos los productos' : 'Lo más pedido'));
    $('tituloVitrina').textContent = titulo;
    $('limpiar').hidden = !(filtro.cat || q);
    document.querySelectorAll('.cat').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cat === filtro.cat)); });
    $('estado').textContent = lista.length ? '' : 'No lo encontramos. Escríbanos por WhatsApp y se lo conseguimos.';
    lista.forEach(function (p) {
      var li = el('li'), a = el('article', 'prod'), f = el('div', 'foto'), i = el('img');
      i.src = foto(p); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async';
      f.appendChild(i);
      if (p.destacado) f.appendChild(el('span', 'sello', 'Más pedido'));
      var c = el('div', 'cuerpo');
      c.append(el('h3', null, p.nombre), el('span', 'unidad', 'Código ' + p.id), el('span', 'precio', pesos(p.precio)), control(p));
      a.append(f, c);
      li.appendChild(a);
      g.appendChild(li);
    });
  }

  /* ---------- Canasta ---------- */
  function codigoPedido() {
    var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* sin 0/O ni 1/I */
    var azar = new Uint32Array(4), s = '';
    window.crypto.getRandomValues(azar);
    for (var i = 0; i < 4; i++) s += letras[azar[i] % letras.length];
    return 'PE-' + s;
  }
  function enlaceWhatsApp(c, d) {
    if (!codigo) codigo = codigoPedido();
    var lin = ['Hola, quiero hacer este pedido 🛒 ' + codigo, ''];
    Object.keys(canasta).forEach(function (id) { lin.push(canasta[id] + ' × ' + por[id].nombre + ' [#' + id + ']'); });
    lin.push('', 'Productos: ' + pesos(c.s), 'Domicilio: ' + (c.d ? pesos(c.d) : 'gratis'), 'Total: ' + pesos(c.t));
    /* Datos de entrega y de la cuenta: el CRM crea al cliente con ellos al registrar el pedido.
       Todo va en una sola línea: un salto de línea en las indicaciones podría colar otra «Correo: …» */
    d = Object.keys(d).reduce(function (o, k) { o[k] = String(d[k]).replace(/\s*[\r\n]+\s*/g, ' ').trim(); return o; }, {});
    lin.push('', '— Datos de entrega y de mi cuenta —',
      'Nombre: ' + d.nombre,
      d.tipo + ': ' + d.documento,
      'Celular: ' + d.celular,
      'Correo: ' + d.correo,
      'Municipio: El Espinal (Tolima)',
      'Barrio: ' + d.barrio,
      'Dirección: ' + d.direccion);
    if (d.extra) lin.push('Indicaciones: ' + d.extra);
    lin.push('Autorizo el uso de mis datos para el pedido y mi cuenta.');
    return 'https://wa.me/' + cat.whatsapp + '?text=' + encodeURIComponent(lin.join('\n'));
  }

  /* ---------- Paso 2: datos de entrega ---------- */
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) mal('d-correo', 'Revise el correo.');
    if (d.barrio.length < 3) mal('d-barrio', 'Elija o escriba su barrio.');
    if (d.direccion.length < 5) mal('d-dir', 'Escriba la dirección con el detalle.');
    if (!$('d-acepto').checked) mal('d-acepto', 'Falta autorizar el uso de sus datos.');
    ['d-nombre', 'd-doc', 'd-cel', 'd-correo', 'd-barrio', 'd-dir', 'd-acepto'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
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
    $('d-correo').value = d.correo || ''; $('d-barrio').value = d.barrio || '';
    $('d-dir').value = d.direccion || ''; $('d-extra').value = d.extra || '';
    $('d-acepto').checked = !!d.acepto;
    $('errores').hidden = true;
    $('items').hidden = true; $('vacio').hidden = true; document.querySelector('.resumen').hidden = true;
    $('datos').hidden = false;
    $('d-nombre').focus();
  }
  function pasoCanasta() {
    $('datos').hidden = true; $('items').hidden = false; document.querySelector('.resumen').hidden = false;
    pintarCanasta();
  }

  function pintarCanasta() {
    var c = cuentas(), ul = $('items'), gratis = cat.domicilio.gratis_desde;
    ul.textContent = '';
    Object.keys(canasta).forEach(function (id) {
      var p = por[id], li = el('li'), i = el('img'), mid = el('div');
      i.src = foto(p); i.alt = '';
      mid.append(el('div', 'nm', p.nombre), control(p).firstChild);
      li.append(i, mid, el('span', 'v', pesos(p.precio * canasta[id])));
      ul.appendChild(li);
    });
    var vacia = c.n === 0;
    $('vacio').hidden = !vacia;
    $('vaciar').hidden = vacia;
    $('n').hidden = vacia; $('n').textContent = c.n;
    $('barra').hidden = vacia;
    $('barraN').textContent = c.n + (c.n === 1 ? ' producto' : ' productos');
    $('barraT').textContent = pesos(c.t);
    $('sub').textContent = pesos(c.s);
    $('dom').textContent = vacia ? '$0' : (c.d ? pesos(c.d) : 'Gratis');
    $('tot').textContent = pesos(c.t);
    var m = $('meta');
    m.textContent = c.s >= gratis
      ? 'Sus productos pasan de ' + pesos(gratis) + ': el domicilio es gratis.'
      : 'Agregue ' + pesos(gratis - c.s) + ' más en productos y el domicilio le sale gratis.';
    var pr = el('progress'); pr.max = 1; pr.value = Math.min(c.s / gratis, 1);
    m.appendChild(pr);
    m.hidden = vacia;
    $('seguir').disabled = vacia;
    $('tot2').textContent = pesos(c.t);
    if (vacia && !$('datos').hidden) pasoCanasta();
  }

  /* ---------- Panel ---------- */
  function abrir() { $('panel').hidden = false; $('velo').hidden = false; $('cerrar').focus(); }
  function cerrar() { $('panel').hidden = true; $('velo').hidden = true; pasoCanasta(); }
  function verTodo() { filtro = { cat: '', q: '', todo: true }; $('q').value = ''; pintar(); }

  function eventos() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (b) { filtro = { cat: b.dataset.cat, q: '', todo: true }; $('q').value = ''; pintar(); $('vitrina').scrollIntoView({ behavior: 'smooth' }); }
      var combo = e.target.closest('[data-combo]');
      if (combo) {
        combo.dataset.combo.split(',').forEach(function (id) { if (por[id]) canasta[id] = (canasta[id] || 0) + 1; });
        guardar(); pintar(); pintarCanasta(); abrir();
      }
      if (e.target.closest('[data-abrir]')) abrir();
    });
    $('verTodo').addEventListener('click', function () { verTodo(); $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('limpiar').addEventListener('click', function (e) { e.preventDefault(); verTodo(); });
    $('q').addEventListener('input', function () { filtro = { cat: '', q: this.value, todo: true }; pintar(); });
    $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('btnq').addEventListener('click', function () { $('vitrina').scrollIntoView({ behavior: 'smooth' }); });
    $('cerrar').addEventListener('click', cerrar);
    $('velo').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    $('vaciar').addEventListener('click', function () { canasta = {}; guardar(); pintar(); pintarCanasta(); cerrar(); });
    $('seguir').addEventListener('click', pasoDatos);
    $('volver').addEventListener('click', pasoCanasta);
    $('datos').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = leerFormulario();
      if (!cuentas().n || !validar(d)) return;
      d.acepto = true;
      guardarDatos(d);
      var enlace = enlaceWhatsApp(cuentas(), d);
      /* Cada envío lleva un código nuevo: si el cliente vuelve y cambia algo, es otro pedido */
      codigo = null;
      var w = window.open(enlace, '_blank');
      if (w) w.opener = null; else window.location.href = enlace;
    });
  }

  /* ---------- Carga ---------- */
  fetch('/tienda/catalogo.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (datos) {
      cat = datos;
      datos.categorias.forEach(function (c) { cats[c.id] = c; });
      datos.productos.forEach(function (p) { por[p.id] = p; });
      /* Lo que ya no está en el catálogo sale de la canasta guardada */
      Object.keys(canasta).forEach(function (id) { if (!por[id] || !(canasta[id] > 0)) delete canasta[id]; });
      guardar();
      BARRIOS.forEach(function (b) { var o = el('option'); o.value = b; $('barrios').appendChild(o); });
      pintarCategorias();
      eventos();
      pintar();
      pintarCanasta();
    })
    .catch(function () {
      $('estado').textContent = 'No pudimos cargar los productos. Escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.';
    });
})();
