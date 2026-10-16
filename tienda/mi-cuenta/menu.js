/* Panel pequeño de «Mi cuenta» en la cabecera (tienda y portal del cliente).
   Con sesión despliega el nombre y tres opciones; sin sesión lleva a entrar.
   Los datos vienen del CRM por /tienda/mi-cuenta/api (ver functions/). */
(function () {
  'use strict';
  var API = '/tienda/mi-cuenta/api/';
  var PORTAL = '/tienda/mi-cuenta/';
  /* Mis pedidos, Mis datos y el detalle se ven SIEMPRE como ventana encima de
     la tienda (pedido del dueño): la tienda queda de fondo y una X la devuelve. */
  var EN_VENTANA = ['pedidos', 'datos', 'pedido'];
  var enMarco = false;
  try { enMarco = window.self !== window.top && window.top.location.origin === location.origin; } catch (e) { enMarco = false; }
  var pagina = document.body ? document.body.dataset.pagina : '';
  if (!enMarco && EN_VENTANA.indexOf(pagina) >= 0) {
    location.replace('/tienda/#cuenta=' + encodeURIComponent(location.pathname + location.search));
    return;
  }
  if (enMarco) document.documentElement.classList.add('en-ventana');

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  /* ---------- Dentro de la ventana: lo que sale del portal la cierra ---------- */
  function dentroDeLaVentana() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.indexOf(PORTAL) === 0) return;
      e.preventDefault();
      window.parent.postMessage({ cuenta: 'cerrar', ir: url.pathname === '/tienda/' ? '' : url.href }, location.origin);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.parent.postMessage({ cuenta: 'cerrar' }, location.origin);
    });
  }

  /* ---------- En la tienda: abre el portal encima, con la tienda de fondo ---------- */
  var ventana = null;
  function abrirVentana(ruta) {
    if (ruta.indexOf(PORTAL) !== 0) return;
    cerrarVentana(true);
    var abierto = document.querySelector('.menu-cuenta:not([hidden])');
    if (abierto) { abierto.hidden = true; var bc = document.querySelector('.btn-cuenta'); if (bc) bc.setAttribute('aria-expanded', 'false'); }
    ventana = el('div', 'ventana-cuenta');
    ventana.setAttribute('role', 'dialog');
    ventana.setAttribute('aria-modal', 'true');
    ventana.setAttribute('aria-label', 'Mi cuenta');
    var velo = el('div', 'vc-velo');
    var hoja = el('div', 'vc-hoja');
    var x = el('button', 'vc-cerrar');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar y volver a la tienda');
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg><span>Cerrar</span>';
    var marco = el('iframe', 'vc-marco');
    marco.title = 'Mi cuenta';
    marco.src = ruta;
    hoja.append(x, marco);
    ventana.append(velo, hoja);
    document.body.appendChild(ventana);
    document.documentElement.classList.add('con-ventana');
    velo.addEventListener('click', function () { cerrarVentana(); });
    x.addEventListener('click', function () { cerrarVentana(); });
    x.focus();
    try { history.replaceState(null, '', '#cuenta=' + encodeURIComponent(ruta)); } catch (e) { /* sin historial */ }
  }
  function cerrarVentana(callado) {
    if (!ventana) return;
    ventana.remove();
    ventana = null;
    document.documentElement.classList.remove('con-ventana');
    if (!callado) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ } }
  }
  function enLaTienda() {
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.cuenta !== 'cerrar') return;
      cerrarVentana();
      if (e.data.ir) location.href = e.data.ir;
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ventana) cerrarVentana(); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var url = new URL(a.href, location.href);
      if (url.origin === location.origin && EN_VENTANA.some(function (p) { return url.pathname === PORTAL + p + '/'; })) {
        e.preventDefault();
        abrirVentana(url.pathname + url.search);
      }
    });
    var m = /^#cuenta=(.+)$/.exec(location.hash);
    if (m) abrirVentana(decodeURIComponent(m[1]));
  }

  function iniciar() {
    if (enMarco) { dentroDeLaVentana(); return; }
    if (location.pathname === '/tienda/' || location.pathname === '/tienda/index.html') enLaTienda();
    var boton = document.querySelector('.btn-cuenta');
    if (!boton) return;
    var caja = el('div', 'mi-cuenta');
    boton.parentNode.insertBefore(caja, boton);
    caja.appendChild(boton);
    var panel = el('div', 'menu-cuenta');
    panel.hidden = true;
    panel.id = 'menu-cuenta';
    caja.appendChild(panel);
    boton.setAttribute('aria-haspopup', 'true');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', 'menu-cuenta');

    function cerrar() { panel.hidden = true; boton.setAttribute('aria-expanded', 'false'); }

    function pintar(yo) {
      panel.textContent = '';
      var hola = el('p', 'hola');
      hola.appendChild(el('span', '', 'Hola,'));
      hola.appendChild(el('b', '', (yo.nombre || '').split(' ')[0] || 'cliente'));
      panel.appendChild(hola);
      [['Mis pedidos', '/tienda/mi-cuenta/pedidos/', 'Compras de la tienda y del mostrador'],
       ['Mis datos', '/tienda/mi-cuenta/datos/', 'Nombre y dirección de entrega']].forEach(function (o) {
        var a = el('a', 'opcion');
        a.href = o[1];
        a.appendChild(el('b', '', o[0]));
        a.appendChild(el('small', '', o[2]));
        panel.appendChild(a);
      });
      var salir = el('button', 'salir', 'Salir de mi cuenta');
      salir.type = 'button';
      salir.addEventListener('click', function () {
        fetch(API + 'salir', { method: 'POST', credentials: 'same-origin' })
          .finally(function () { location.href = '/tienda/'; });
      });
      panel.appendChild(salir);
      panel.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
    }

    boton.addEventListener('click', function (e) {
      e.preventDefault();
      if (!panel.hidden) { cerrar(); return; }
      fetch(API + 'yo', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (yo) {
          if (yo && yo.ok) pintar(yo);
          else location.href = '/tienda/mi-cuenta/';
        })
        .catch(function () { location.href = '/tienda/mi-cuenta/'; });
    });
    document.addEventListener('click', function (e) { if (!caja.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
