/* Portal del cliente: entrar, Mis pedidos, un pedido y Mis datos.
   Cada página dice cuál es en <body data-pagina>. Los datos llegan del CRM
   por el intermediario (/tienda/mi-cuenta/api); se pintan con textContent. */
(function () {
  'use strict';
  var API = '/tienda/mi-cuenta/api/';
  var BASE = '/tienda/mi-cuenta/';
  var formato = new Intl.NumberFormat('es-CO');

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pesos(n) { return '$' + formato.format(Math.round(n || 0)); }
  function fecha(texto) {
    var p = String(texto || '').split(' ')[0].split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  /* Pide al intermediario. 401 = sesión vencida: de vuelta a entrar. */
  function pedir(ruta, datos) {
    var op = { credentials: 'same-origin', headers: {} };
    if (datos) {
      op.method = 'POST';
      op.headers['Content-Type'] = 'application/json';
      op.body = JSON.stringify(datos);
    }
    return fetch(API + ruta, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && document.body.dataset.pagina !== 'entrar') {
          location.href = BASE;
          return new Promise(function () {});
        }
        if (!r.ok || !j.ok) throw new Error(j.error || 'No pudimos traer sus datos. Intente más tarde.');
        return j;
      });
    });
  }

  function error(nodo, texto) { nodo.textContent = texto; nodo.hidden = !texto; }

  function enviando(boton, si) { boton.disabled = si; }

  /* ---------- entrar, crear cuenta y olvidé mi contraseña ----------
     Una sola página con cinco vistas. El #hash elige la de arranque
     (#crear, #olvide). Pasos intermedios: el intermediario los guarda en
     una galleta HttpOnly; aquí solo se ve si hay que esperar o seguir. */
  var VISTAS = ['entrar', 'crear', 'olvide', 'verificar', 'clave'];
  var sondeo = null;

  function ver(nombre) {
    VISTAS.forEach(function (v) { $('v-' + v).hidden = v !== nombre; });
    if (sondeo) { clearTimeout(sondeo); sondeo = null; }
    window.scrollTo(0, 0);
    var primero = $('v-' + nombre).querySelector('input');
    if (primero && !primero.closest('[hidden]')) primero.focus();
  }

  function desdeHash() {
    var h = location.hash.replace('#', '');
    ver(h === 'crear' || h === 'olvide' ? h : 'entrar');
  }

  function formulario(id, errorId, armar, enviar) {
    var f = $(id), e = $(errorId);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var datos = armar();
      if (typeof datos === 'string') return error(e, datos);
      error(e, '');
      var b = f.querySelector('button[type=submit]');
      enviando(b, true);
      enviar(datos).catch(function (err) { error(e, err.message); })
        .finally(function () { enviando(b, false); });
    });
  }

  /* El celular queda probado: él nos escribe, o escribe el código que le llegó. */
  function verificar(r) {
    error($('e-verificar'), '');
    ver('verificar');
    var escribe = r.modo === 'cliente_escribe';
    $('escribe').hidden = !escribe;
    $('f-codigo').hidden = escribe;
    if (!escribe) { $('codigo').value = ''; $('codigo').focus(); return; }
    $('mi-codigo').textContent = r.codigo.replace(/(\d{3})(\d{3})/, '$1 $2');
    $('abrir-wa').href = 'https://wa.me/' + encodeURIComponent(r.whatsapp) + '?text=' + encodeURIComponent(r.mensaje);
    var vence = Date.now() + (r.minutos || 10) * 60000;
    (function preguntar() {
      pedir('verificar', {}).then(function (j) {
        if (j.listo) return ver('clave');
        if (Date.now() > vence) return error($('e-verificar'), 'El código venció. Empiece de nuevo.');
        sondeo = setTimeout(preguntar, document.hidden ? 6000 : 3000);
      }, function (err) { error($('e-verificar'), err.message); });
    })();
  }

  function entrar() {
    pedir('yo').then(function () { location.href = BASE + 'pedidos/'; }, function () {});
    window.addEventListener('hashchange', desdeHash);
    desdeHash();

    formulario('f-entrar', 'e-entrar', function () {
      var u = $('usuario').value.replace(/\D/g, '');
      if (u.length < 5) return 'Escriba su cédula o su celular.';
      if (!$('clave').value) return 'Escriba su contraseña.';
      return { usuario: u, clave: $('clave').value };
    }, function (d) {
      return pedir('entrar', d).then(function () { location.href = BASE + 'pedidos/'; });
    });

    formulario('f-crear', 'e-crear', function () {
      var n = $('nombre').value.replace(/\s+/g, ' ').trim();
      var doc = $('documento').value.replace(/\D/g, '');
      var cel = $('celular').value.replace(/\D/g, '').slice(-10);
      if (n.length < 3) return 'Escriba su nombre completo.';
      if (doc.length < 5) return 'Escriba su número de documento.';
      if (cel.length !== 10 || cel[0] !== '3') return 'Escriba su celular de 10 dígitos.';
      return { nombre: n, documento: doc, celular: cel };
    }, function (d) { return pedir('registro', d).then(verificar); });

    formulario('f-olvide', 'e-olvide', function () {
      var u = $('usuario2').value.replace(/\D/g, '');
      return u.length < 5 ? 'Escriba su cédula o su celular.' : { usuario: u };
    }, function (d) { return pedir('olvide', d).then(verificar); });

    formulario('f-codigo', 'e-verificar', function () {
      var c = $('codigo').value.replace(/\D/g, '');
      return c.length !== 6 ? 'El código tiene 6 números.' : { codigo: c };
    }, function (d) {
      return pedir('verificar', d).then(function (j) { if (j.listo) ver('clave'); });
    });

    formulario('f-clave', 'e-clave', function () {
      var c = $('nueva').value;
      if (c.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (c !== $('repetir').value) return 'Las dos contraseñas no son iguales.';
      return { clave: c };
    }, function (d) {
      return pedir('clave', d).then(function () { location.href = BASE + 'pedidos/'; });
    });
  }

  /* Cuenta creada con una cédula que ya teníamos con otro celular. */
  function enRevision(caja) {
    caja.textContent = '';
    var v = el('div', 'vacio');
    v.appendChild(el('b', '', 'Estamos confirmando su cuenta.'));
    v.appendChild(el('p', 'ayuda', 'Esa cédula ya estaba con otro celular. Alguien de la tienda le escribe para confirmar que es usted; luego verá aquí sus compras.'));
    caja.appendChild(v);
  }

  /* ---------- Mis pedidos ---------- */
  function pedidos() {
    var caja = $('lista');
    pedir('yo').then(function (yo) {
      $('hola').textContent = 'Hola, ' + ((yo.nombre || '').split(' ')[0] || 'cliente');
      if (yo.estado === 'por_confirmar') return enRevision(caja);
      return pedir('pedidos').then(pintar);
    }).catch(function (err) { caja.textContent = err.message; });
    function pintar(j) {
      caja.textContent = '';
      if (!j.pedidos.length) {
        var v = el('div', 'vacio');
        v.appendChild(el('b', '', 'Aún no vemos compras a su nombre.'));
        v.appendChild(el('p', 'ayuda', 'Cuando compre, en el mostrador o en la tienda en línea, dé su cédula y aparecerán aquí.'));
        var a = el('a', 'boton', 'Hacer un pedido'); a.href = '/tienda/';
        v.appendChild(a);
        caja.appendChild(v);
        return;
      }
      var ul = el('ul', 'lista');
      j.pedidos.forEach(function (p) {
        var a = el('a', 'compra');
        a.href = BASE + 'pedido/?id=' + encodeURIComponent(p.id);
        var izq = el('span');
        izq.appendChild(el('span', 'chip' + (p.canal === 'Domicilio' ? ' dom' : ''), p.canal));
        if (p.por_pagar) izq.appendChild(el('span', 'chip pend', 'Por pagar'));
        if (p.entrega) izq.appendChild(el('span', 'chip', p.entrega));
        izq.appendChild(el('span', 'det', fecha(p.fecha) + ' · ' + p.numero));
        a.appendChild(izq);
        a.appendChild(el('b', '', pesos(p.total)));
        var li = el('li'); li.appendChild(a); ul.appendChild(li);
      });
      caja.appendChild(ul);
    }
  }

  /* ---------- una compra ---------- */
  function pedido() {
    var id = (new URLSearchParams(location.search).get('id') || '').replace(/\D/g, '');
    var caja = $('detalle');
    if (!id) { location.href = BASE + 'pedidos/'; return; }
    pedir('pedidos/' + id).then(function (p) {
      $('titulo').textContent = 'Compra ' + p.numero;
      var sub = [p.canal, fecha(p.fecha), p.forma_pago].filter(Boolean).join(' · ');
      $('sub').textContent = sub + (p.por_pagar ? ' · Por pagar' : '');
      caja.textContent = '';
      if (p.direccion_entrega) caja.appendChild(el('p', 'ayuda', 'Entrega: ' + p.direccion_entrega + (p.entrega ? ' · ' + p.entrega : '')));
      if (p.lineas.length) {
        var t = el('table', 'tabla'), cab = el('tr'), cuerpo = el('tbody');
        [['Producto', ''], ['Cant.', 'n'], ['Valor', 'n']].forEach(function (c) { cab.appendChild(el('th', c[1], c[0])); });
        var thead = el('thead'); thead.appendChild(cab); t.appendChild(thead);
        p.lineas.forEach(function (l) {
          var tr = el('tr');
          tr.appendChild(el('td', '', l.producto));
          tr.appendChild(el('td', 'n', String(l.cantidad)));
          tr.appendChild(el('td', 'n', pesos(l.valor)));
          cuerpo.appendChild(tr);
        });
        if (p.descuento) {
          var d = el('tr'); d.appendChild(el('td', '', 'Descuento')); d.appendChild(el('td'));
          d.appendChild(el('td', 'n', '−' + pesos(p.descuento))); cuerpo.appendChild(d);
        }
        var tot = el('tr', 'total'); tot.appendChild(el('td', '', 'Total')); tot.appendChild(el('td'));
        tot.appendChild(el('td', 'n', pesos(p.total))); cuerpo.appendChild(tot);
        t.appendChild(cuerpo); caja.appendChild(t);
      } else {
        caja.appendChild(el('p', '', 'Total: ' + pesos(p.total)));
        caja.appendChild(el('p', 'ayuda', 'Esta compra se registró sin el detalle de productos.'));
      }
      var acc = $('acciones');
      if (p.tiene_recibo) {
        var a = el('a', 'boton', 'Ver recibo en PDF');
        a.href = API + 'pedidos/' + id + '/recibo.pdf';
        a.target = '_blank'; a.rel = 'noopener';
        acc.appendChild(a);
      } else {
        acc.appendChild(el('p', 'ayuda', 'Su factura electrónica le llegó al correo cuando compró. Si la necesita otra vez, pídala por WhatsApp al 318 355 5246.'));
      }
    }, function (err) { caja.textContent = err.message; });
  }

  /* ---------- Mis datos ---------- */
  var EDITABLES = ['nombre', 'barrio', 'direccion', 'indicaciones'];

  function datos() {
    var f = $('f-datos'), e = $('e-datos'), ok = $('ok-datos');
    function llenar(yo) {
      if (yo.estado === 'por_confirmar') { $('cargando').hidden = true; return enRevision(f.parentNode.insertBefore(el('div'), f)); }
      EDITABLES.forEach(function (c) { $(c).value = yo[c] || ''; });
      $('v-doc').textContent = (yo.tipo_documento + ' ' + yo.documento).trim();
      $('v-cel').textContent = yo.celular || '—';
      $('v-correo').textContent = yo.correo || '—';
      $('v-muni').textContent = yo.municipio;
      f.hidden = false; $('cargando').hidden = true;
    }
    pedir('yo').then(llenar, function (err) { $('cargando').textContent = err.message; });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ok.hidden = true;
      var d = {};
      EDITABLES.forEach(function (c) { d[c] = $(c).value.replace(/\s+/g, ' ').trim(); });
      if (d.nombre.length < 3) return error(e, 'Escriba su nombre completo.');
      if (!d.barrio || !d.direccion) return error(e, 'Escriba el barrio y la dirección de entrega.');
      error(e, '');
      var b = f.querySelector('button');
      enviando(b, true);
      pedir('datos', d).then(function (yo) { llenar(yo); ok.hidden = false; },
        function (err) { error(e, err.message); }).finally(function () { enviando(b, false); });
    });
  }

  var paginas = { entrar: entrar, pedidos: pedidos, pedido: pedido, datos: datos };
  function iniciar() { var p = paginas[document.body.dataset.pagina]; if (p) p(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
