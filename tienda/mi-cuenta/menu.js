/* Panel pequeño de «Mi cuenta» en la cabecera (tienda y portal del cliente).
   Con sesión despliega el nombre y tres opciones; sin sesión lleva a entrar.
   Los datos vienen del CRM por /tienda/mi-cuenta/api (ver functions/). */
(function () {
  'use strict';
  var API = '/tienda/mi-cuenta/api/';

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function iniciar() {
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
