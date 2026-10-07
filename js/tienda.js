/* Plásticos Espinal · tienda en línea. JS sin dependencias.
   Lee datos/catalogo.json (lo publica el CRM), arma la canasta y la manda por
   WhatsApp con un código de pedido. El mensaje lleva [#código] de cada producto:
   el bot recalcula los precios con el CRM, así que el total del mensaje es solo
   una referencia para el cliente. */
(function () {
  'use strict';

  var CLAVE = 'pe-canasta-v1';
  var catalogo = null;
  var porId = {};
  var canasta = leer();          /* { id: cantidad } */
  var filtro = { categoria: '', texto: '' };

  var $ = function (sel) { return document.querySelector(sel); };
  var vitrina = $('[data-vitrina]');
  var estado = $('[data-estado]');
  var panel = $('[data-canasta]');
  var barra = $('.barra-canasta');
  var velo = null;

  /* ---------- Guardado en el navegador (si falla, la canasta vive solo en memoria) ---------- */
  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; }
  }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(canasta)); } catch (e) { /* sin almacenamiento */ }
  }

  /* ---------- Formato ---------- */
  var formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  function pesos(n) { return '$' + formato.format(Math.round(n)); }
  function normal(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function icono(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icono');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  /* ---------- Cuentas ---------- */
  function cuentas() {
    var items = 0, subtotal = 0;
    Object.keys(canasta).forEach(function (id) {
      var p = porId[id];
      if (!p) return;
      items += canasta[id];
      subtotal += canasta[id] * p.precio;
    });
    var d = catalogo.domicilio;
    var domicilio = subtotal === 0 || subtotal >= d.gratis_desde ? 0 : d.tarifa;
    return { items: items, subtotal: subtotal, domicilio: domicilio, total: subtotal + domicilio };
  }

  function cambiar(id, delta) {
    var n = (canasta[id] || 0) + delta;
    if (n <= 0) delete canasta[id]; else canasta[id] = Math.min(n, 999);
    guardar();
    pintarCanasta();
    pintarControl(id);
  }

  /* ---------- Selector − n + ---------- */
  function selector(id, nombre) {
    var caja = el('div', 'cantidad');
    var menos = el('button');
    menos.type = 'button';
    menos.setAttribute('aria-label', 'Quitar uno de ' + nombre);
    menos.appendChild(icono('i-menos'));
    menos.addEventListener('click', function () { cambiar(id, -1); });
    var n = el('output', null, String(canasta[id] || 0));
    n.setAttribute('aria-live', 'polite');
    var mas = el('button');
    mas.type = 'button';
    mas.setAttribute('aria-label', 'Agregar uno más de ' + nombre);
    mas.appendChild(icono('i-mas'));
    mas.addEventListener('click', function () { cambiar(id, 1); });
    caja.append(menos, n, mas);
    return caja;
  }

  /* ---------- Vitrina ---------- */
  function pintarControl(id) {
    var tarjeta = vitrina.querySelector('[data-id="' + id + '"]');
    if (!tarjeta) return;
    var p = porId[id];
    var lugar = tarjeta.querySelector('[data-control]');
    lugar.textContent = '';
    tarjeta.classList.toggle('en-canasta', !!canasta[id]);
    if (canasta[id]) {
      lugar.appendChild(selector(id, p.nombre));
    } else {
      var b = el('button', 'agregar');
      b.type = 'button';
      b.appendChild(icono('i-mas'));
      b.appendChild(document.createTextNode('Agregar'));
      b.setAttribute('aria-label', 'Agregar ' + p.nombre + ' a la canasta');
      b.addEventListener('click', function () { cambiar(id, 1); });
      lugar.appendChild(b);
    }
  }

  function pintarVitrina() {
    vitrina.textContent = '';
    var texto = normal(filtro.texto.trim());
    var lista = catalogo.productos.filter(function (p) {
      if (filtro.categoria && p.categoria !== filtro.categoria) return false;
      return !texto || normal(p.nombre).indexOf(texto) !== -1;
    });
    estado.textContent = lista.length ? '' : 'No encontramos ese producto. Escríbanos por WhatsApp y se lo conseguimos.';
    lista.forEach(function (p) {
      var li = el('li');
      var art = el('article', 'articulo');
      art.dataset.id = p.id;
      var img = el('img');
      img.src = p.imagen || (catalogo.cats[p.categoria] || {}).imagen || 'img/productos/bodega.webp';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 720; img.height = 540;
      var cuerpo = el('div', 'articulo__cuerpo');
      cuerpo.append(el('h3', null, p.nombre), el('span', 'articulo__codigo', 'Código ' + p.id), el('span', 'articulo__precio', pesos(p.precio)));
      var control = el('div');
      control.dataset.control = '';
      cuerpo.appendChild(control);
      art.append(img, cuerpo);
      li.appendChild(art);
      vitrina.appendChild(li);
      pintarControl(p.id);
    });
  }

  function pintarCategorias() {
    var caja = $('[data-categorias]');
    var todas = [{ id: '', nombre: 'Todo' }].concat(catalogo.categorias.filter(function (c) {
      return catalogo.productos.some(function (p) { return p.categoria === c.id; });
    }));
    todas.forEach(function (c) {
      var b = el('button', 'categoria', c.nombre);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.id === filtro.categoria));
      b.addEventListener('click', function () {
        filtro.categoria = c.id;
        caja.querySelectorAll('.categoria').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        pintarVitrina();
      });
      caja.appendChild(b);
    });
  }

  /* ---------- Canasta ---------- */
  function pintarCanasta() {
    var c = cuentas();
    var lista = $('[data-lista]');
    lista.textContent = '';
    Object.keys(canasta).forEach(function (id) {
      var p = porId[id];
      if (!p) return;
      var li = el('li', 'linea');
      li.append(el('span', 'linea__nombre', p.nombre), el('span', 'linea__valor', pesos(p.precio * canasta[id])),
        selector(id, p.nombre), el('span', 'linea__unitario', pesos(p.precio) + ' c/u'));
      lista.appendChild(li);
    });

    var vacia = c.items === 0;
    $('[data-vacia]').hidden = !vacia;
    $('[data-vaciar]').hidden = vacia;
    $('[data-subtotal]').textContent = pesos(c.subtotal);
    $('[data-domicilio]').textContent = vacia ? '$0' : (c.domicilio ? pesos(c.domicilio) : 'Gratis');
    $('[data-total]').textContent = pesos(c.total);

    var envio = $('[data-envio]');
    var gratis = catalogo.domicilio.gratis_desde;
    envio.hidden = vacia;
    $('[data-envio-texto]').textContent = c.subtotal >= gratis
      ? 'Su domicilio es gratis.'
      : 'Le faltan ' + pesos(gratis - c.subtotal) + ' para el domicilio gratis.';
    $('[data-envio-barra]').value = Math.min(c.subtotal / gratis, 1);

    var enviar = $('[data-enviar]');
    enviar.setAttribute('aria-disabled', String(vacia));
    enviar.href = vacia ? 'https://wa.me/' + catalogo.whatsapp : enlaceWhatsApp(c);

    var contador = $('[data-contador]');
    contador.hidden = vacia;
    contador.textContent = c.items;
    barra.hidden = vacia;
    $('[data-barra-items]').textContent = c.items + (c.items === 1 ? ' producto' : ' productos');
    $('[data-barra-total]').textContent = pesos(c.total);
    if (vacia) cerrar();
  }

  /* ---------- Mensaje de WhatsApp ---------- */
  function codigoPedido() {
    var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* sin 0/O ni 1/I */
    var s = '';
    var azar = new Uint32Array(4);
    (window.crypto || window.msCrypto).getRandomValues(azar);
    for (var i = 0; i < 4; i++) s += letras[azar[i] % letras.length];
    return 'PE-' + s;
  }

  var codigo = null;
  function enlaceWhatsApp(c) {
    if (!codigo) codigo = codigoPedido();
    var lineas = ['Hola, quiero hacer este pedido 🛒 ' + codigo, ''];
    Object.keys(canasta).forEach(function (id) {
      var p = porId[id];
      if (p) lineas.push(canasta[id] + ' × ' + p.nombre + ' [#' + p.id + ']');
    });
    lineas.push('', 'Productos: ' + pesos(c.subtotal),
      'Domicilio: ' + (c.domicilio ? pesos(c.domicilio) : 'gratis'),
      'Total: ' + pesos(c.total));
    return 'https://wa.me/' + catalogo.whatsapp + '?text=' + encodeURIComponent(lineas.join('\n'));
  }

  /* ---------- Abrir y cerrar la canasta en el celular ---------- */
  var esCelular = window.matchMedia('(max-width: 999px)');
  function abrir() {
    if (!esCelular.matches) { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (!velo) {
      velo = el('div', 'velo');
      velo.addEventListener('click', cerrar);
      document.body.appendChild(velo);
    }
    velo.hidden = false;
    panel.classList.add('is-abierta');
    panel.querySelector('[data-cerrar-canasta]').focus();
  }
  function cerrar() {
    if (!panel.classList.contains('is-abierta')) return;
    panel.classList.remove('is-abierta');
    if (velo) velo.hidden = true;
  }

  document.querySelectorAll('[data-abrir-canasta]').forEach(function (b) { b.addEventListener('click', abrir); });
  $('[data-cerrar-canasta]').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  $('[data-vaciar]').addEventListener('click', function () {
    canasta = {};
    guardar();
    pintarCanasta();
    catalogo.productos.forEach(function (p) { pintarControl(p.id); });
  });
  /* Cada envío lleva un código nuevo: si el cliente vuelve y cambia algo, es otro pedido */
  $('[data-enviar]').addEventListener('click', function () { setTimeout(function () { codigo = null; pintarCanasta(); }, 0); });
  $('#buscar').addEventListener('input', function (e) { filtro.texto = e.target.value; pintarVitrina(); });

  /* ---------- Carga ---------- */
  fetch('datos/catalogo.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (datos) {
      catalogo = datos;
      catalogo.cats = {};
      datos.categorias.forEach(function (c) { catalogo.cats[c.id] = c; });
      datos.productos.forEach(function (p) { porId[p.id] = p; });
      /* Lo que ya no está en el catálogo sale de la canasta guardada */
      Object.keys(canasta).forEach(function (id) { if (!porId[id] || !(canasta[id] > 0)) delete canasta[id]; });
      guardar();
      $('[data-aviso-muestra]').hidden = !datos.muestra;
      pintarCategorias();
      pintarVitrina();
      pintarCanasta();
    })
    .catch(function () {
      estado.textContent = 'No pudimos cargar los productos. Escríbanos por WhatsApp al 318 355 5246 y le tomamos el pedido.';
    });
})();
