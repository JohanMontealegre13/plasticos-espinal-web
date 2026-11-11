/* Portal del cliente: la entrada de la tienda (bienvenida, crear cuenta, entrar),
   Mis pedidos, un pedido y Mis datos. Cada página dice cuál es en <body data-pagina>.
   Los datos llegan del CRM por el intermediario (/tienda/mi-cuenta/api); se pintan
   con textContent. */
(function () {
  'use strict';
  var API = '/tienda/mi-cuenta/api/';
  /* Raíz de la tienda: «/» en tienda.plasticosespinal.com, «/tienda/» en las pruebas y vistas previas */
  var RAIZ = /^\/tienda(\/|$)/.test(location.pathname) ? '/tienda/' : '/';
  var BASE = RAIZ + 'mi-cuenta/';
  var formato = new Intl.NumberFormat('es-CO');

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pesos(n) { return '$' + formato.format(Math.round(n || 0)); }
  function fecha(texto) {
    var p = String(texto || '').split(' ')[0].split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  /* Mis pedidos, Mis datos y el detalle se ven como ventana encima de la tienda (menu.js) */
  var enMarco = false;
  try { enMarco = window.self !== window.top && window.top.location.origin === location.origin; } catch (e) { enMarco = false; }

  /* Sin sesión no hay tienda: a la entrada, que recuerda lo que se estaba viendo para volver ahí.
     Desde la ventana de Mi cuenta se va la página entera, no solo el marco. */
  function aLaEntrada() {
    var w = enMarco ? window.top : window;
    var pedida = w.location.pathname + w.location.search;
    w.location.href = BASE + (pedida === RAIZ ? '' : '?volver=' + encodeURIComponent(pedida)) + (enMarco ? w.location.hash : '');
  }

  /* Pide al intermediario. 401 = sesión vencida: de vuelta a la entrada. */
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
          aLaEntrada();
          return new Promise(function () {});
        }
        if (!r.ok || !j.ok) throw new Error(j.error || 'No pudimos traer sus datos. Intente más tarde.');
        return j;
      });
    });
  }

  function aMisPedidos() {
    var ruta = BASE + 'pedidos/';
    location.href = enMarco ? ruta : RAIZ + '#cuenta=' + encodeURIComponent(ruta);
  }

  function error(nodo, texto) { nodo.textContent = texto; nodo.hidden = !texto; }

  function enviando(boton, si) { boton.disabled = si; }

  /* ---------- la entrada: bienvenida, crear cuenta, entrar y olvidé mi contraseña ----------
     Una sola página con siete pantallas. El #hash elige la de arranque (#crear, #entrar,
     #olvide); sin él, la bienvenida, o «Entrar» si en este celular ya entró alguien.
     Pasos intermedios: el intermediario los guarda en una galleta HttpOnly; aquí solo se ve
     si hay que esperar o seguir. */
  var VISTAS = ['bienvenida', 'crear', 'verificar', 'clave', 'listo', 'entrar', 'olvide'];
  var CONOCE = 'pe-conoce-v1';   /* en este celular ya entró alguien: la próxima vez abre en «Entrar» */
  var QUIETO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var sondeo = null;
  var flujo = 'crear';           /* 'crear' u 'olvide': qué se está confirmando por WhatsApp */
  var ultimoEnvio = null;        /* { ruta, datos } del último código pedido, para mandarlo otra vez */

  /* A dónde se va al entrar: a lo que se pidió antes de llegar aquí (?volver=, que pone la
     puerta) y, si venía un producto o la ventana de Mi cuenta en la dirección (#p=…, #cuenta=…),
     con eso. Solo vale una dirección de esta misma tienda; cualquier otra cosa, a su inicio. */
  var HASH_TIENDA = /^#(?:p|cuenta)=/.test(location.hash) ? location.hash : '';
  function destino() {
    var pedida = new URLSearchParams(location.search).get('volver') || '', ruta = RAIZ;
    try {
      var u = new URL(pedida, location.origin);
      var deAqui = pedida.charAt(0) === '/' && u.origin === location.origin && u.pathname.indexOf(RAIZ) === 0;
      if (deAqui && u.pathname !== BASE && u.pathname !== BASE + 'index.html') ruta = u.pathname + u.search;
    } catch (e) { /* dirección rara: al inicio */ }
    /* Con el origen delante: una ruta que empiece por «//» nunca saca de la tienda */
    return location.origin + ruta + HASH_TIENDA;
  }
  function aLaTienda() { location.href = destino(); }

  function conoce() { try { return localStorage.getItem(CONOCE) === '1'; } catch (e) { return false; } }
  function recordarQueConoce() { try { localStorage.setItem(CONOCE, '1'); } catch (e) { /* sin almacenamiento */ } }

  function ver(nombre) {
    VISTAS.forEach(function (v) { $('v-' + v).hidden = v !== nombre; });
    if (sondeo) { clearTimeout(sondeo); sondeo = null; }
    window.scrollTo(0, 0);
    var primero = $('v-' + nombre).querySelector('input, h1[tabindex]');
    if (primero && !primero.closest('[hidden]')) primero.focus();
  }

  function desdeHash() {
    var h = location.hash.replace('#', '');
    ver(h === 'crear' || h === 'entrar' || h === 'olvide' ? h : (conoce() ? 'entrar' : 'bienvenida'));
  }

  function formulario(id, errorId, armar, enviar) {
    var f = $(id), e = $(errorId);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var b = f.querySelector('button[type=submit]');
      if (b.disabled) return;   /* ya va en camino */
      var datos = armar();
      if (typeof datos === 'string') return error(e, datos);
      error(e, '');
      enviando(b, true);
      enviar(datos).catch(function (err) { error(e, err.message); })
        .finally(function () { enviando(b, false); });
    });
  }

  /* Las seis casillas muestran lo que lleva el campo de verdad (que está encima, invisible).
     El campo no lleva maxlength: así se puede pegar el mensaje entero o el código con un espacio
     en medio, y aquí se dejan solo los seis números. */
  function pintarCodigo() {
    var campo = $('codigo'), v = campo.value.replace(/\D/g, '').slice(0, 6), cajas = $('casillas').children;
    if (campo.value !== v) campo.value = v;
    for (var i = 0; i < cajas.length; i++) {
      cajas[i].textContent = v.charAt(i);
      cajas[i].className = (v.charAt(i) ? 'lleno' : '') + (i === Math.min(v.length, cajas.length - 1) ? ' ahora' : '');
    }
    $('casillas').classList.remove('bien');
    return v;
  }

  /* Pide el código (crear cuenta u olvidé) y pasa a confirmarlo */
  function pedirCodigo(ruta, datos) {
    flujo = ruta === 'olvide' ? 'olvide' : 'crear';
    ultimoEnvio = { ruta: ruta, datos: datos };
    return pedir(ruta, datos).then(verificar);
  }

  /* El celular queda probado: él nos escribe, o escribe el código que le llegó. */
  function verificar(r) {
    error($('e-verificar'), '');
    ver('verificar');
    var escribe = r.modo === 'cliente_escribe', cel = ultimoEnvio && ultimoEnvio.datos.celular;
    $('escribe').hidden = !escribe;
    $('f-codigo').hidden = escribe;
    $('t-verificar').textContent = escribe ? 'Confirme su WhatsApp' : 'Escriba el código que le llegó';
    $('s-verificar').textContent = escribe ? 'Así sabemos que el número es suyo.'
      : 'Lo mandamos ' + (cel ? 'al WhatsApp ' + cel.slice(0, 3) + ' *** ' + cel.slice(-4) : 'al WhatsApp de su cuenta') +
        '. Vence en ' + (r.minutos || 10) + ' minutos.';
    if (!escribe) { $('codigo').value = ''; pintarCodigo(); $('codigo').focus(); return; }
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

  /* Qué tan fuerte va la contraseña: cuatro rayitas (largo, mayúscula, número y más largo) */
  function medir(v) {
    var n = 0;
    if (v.length >= 8) n++;
    if (/[A-ZÁÉÍÓÚÑ]/.test(v)) n++;
    if (/\d/.test(v)) n++;
    if (v.length >= 10) n++;
    $('fuerza').className = 'fuerza' + (v ? ' n' + Math.max(1, n) : '');
  }

  /* La cuenta quedó con contraseña (nueva o cambiada): el chulo y a la tienda */
  function cuentaLista(j) {
    recordarQueConoce();
    var nombre = String(j.nombre || '').split(' ')[0], porConfirmar = j.estado === 'por_confirmar';
    $('t-listo').textContent = nombre ? '¡Hola, ' + nombre + '!' : '¡Listo!';
    $('s-listo').textContent = flujo === 'olvide' ? 'Su contraseña quedó cambiada.'
      : (porConfirmar ? 'Su cuenta quedó lista: ya puede ver precios y pedir. Esa cédula ya estaba con otro celular, así que sus compras anteriores salen cuando la tienda confirme que es usted.'
        : 'Su cuenta quedó lista.');
    /* Con algo que leer no se va sola: espera el botón */
    $('a-la-tienda').hidden = !porConfirmar;
    ver('listo');
    if (!porConfirmar) setTimeout(aLaTienda, QUIETO ? 600 : 1700);
  }

  function entrar() {
    /* La entrada nunca va dentro de la ventana de Mi cuenta: se va la página entera */
    if (enMarco) { aLaEntrada(); return; }
    pedir('yo').then(aLaTienda, function () {});   /* ya entró: a la tienda, o a lo que pidió */
    window.addEventListener('hashchange', desdeHash);
    desdeHash();

    formulario('f-entrar', 'e-entrar', function () {
      var u = $('usuario').value.replace(/\D/g, '');
      if (u.length < 5) return 'Escriba su cédula o su celular.';
      if (!$('clave').value) return 'Escriba su contraseña.';
      return { usuario: u, clave: $('clave').value };
    }, function (d) {
      return pedir('entrar', d).then(function () { recordarQueConoce(); aLaTienda(); });
    });

    formulario('f-crear', 'e-crear', function () {
      var n = $('nombre').value.replace(/\s+/g, ' ').trim();
      var doc = $('documento').value.replace(/\D/g, '');
      var cel = $('celular').value.replace(/\D/g, '').slice(-10);
      if (n.length < 3) return 'Escriba su nombre completo.';
      if (doc.length < 5) return 'Escriba su número de documento.';
      if (cel.length !== 10 || cel[0] !== '3') return 'Escriba su celular de 10 dígitos.';
      var correo = $('correo').value.trim().toLowerCase();
      if (!correoValido(correo)) return 'Escriba su correo: ahí le llega el cupón de su primer domicilio gratis.';
      return { nombre: n, documento: doc, celular: cel, correo: correo };
    }, function (d) { return pedirCodigo('registro', d); });

    formulario('f-olvide', 'e-olvide', function () {
      var u = $('usuario2').value.replace(/\D/g, '');
      return u.length < 5 ? 'Escriba su cédula o su celular.' : { usuario: u };
    }, function (d) { return pedirCodigo('olvide', d); });

    formulario('f-codigo', 'e-verificar', function () {
      var c = pintarCodigo();
      return c.length !== 6 ? 'El código tiene 6 números.' : { codigo: c };
    }, function (d) {
      return pedir('verificar', d).then(function (j) {
        if (!j.listo) return;
        $('casillas').classList.add('bien');
        setTimeout(function () { ver('clave'); }, QUIETO ? 0 : 350);
      });
    });
    /* Con el sexto número se confirma solo (el botón queda para quien lo prefiera) */
    $('codigo').addEventListener('input', function () {
      if (pintarCodigo().length !== 6) return;
      var f = $('f-codigo');
      if (typeof f.requestSubmit === 'function') f.requestSubmit(); else f.querySelector('button[type=submit]').click();
    });
    $('otra-vez').addEventListener('click', function () {
      if (!ultimoEnvio) return ver(flujo);
      var b = this;
      enviando(b, true);
      pedir(ultimoEnvio.ruta, ultimoEnvio.datos).then(verificar, function (err) { error($('e-verificar'), err.message); })
        .finally(function () { enviando(b, false); });
    });
    $('de-nuevo').addEventListener('click', function () { ver(flujo); });

    formulario('f-clave', 'e-clave', function () {
      var c = $('nueva').value;
      if (c.length < 8) return 'La contraseña debe tener al menos 8 letras o números.';
      return { clave: c };
    }, function (d) { return pedir('clave', d).then(cuentaLista); });
    $('nueva').addEventListener('input', function () { medir(this.value); });
    $('ver-clave').addEventListener('click', function () {
      var mostrar = $('nueva').type === 'password';
      $('nueva').type = mostrar ? 'text' : 'password';
      this.textContent = mostrar ? 'Ocultar' : 'Ver';
      this.setAttribute('aria-pressed', String(mostrar));
    });
    $('a-la-tienda').addEventListener('click', aLaTienda);
  }

  /* Cuenta creada con una cédula que ya teníamos con otro celular. */
  function enRevision(caja) {
    caja.textContent = '';
    var v = el('div', 'vacio');
    v.appendChild(el('b', '', 'Estamos confirmando su cuenta.'));
    v.appendChild(el('p', 'ayuda', 'Esa cédula ya estaba con otro celular. Alguien de la tienda le escribe para confirmar que es usted; luego verá aquí sus compras.'));
    caja.appendChild(v);
  }

  /* El pedido de la tienda que va en camino (el que guardó este celular al pedirlo): arriba de todo, y al
     tocarlo se ve su seguimiento en la tienda. Se borra solo cuando el pedido termina. */
  var EN_CURSO = { POR_CONFIRMAR: 'Confirmando', POR_ALISTAR: 'Preparándose', EN_CAMINO: 'En camino' };
  function guardadoAqui() {
    var p;
    try { p = JSON.parse(localStorage.getItem('pe-pedido-v1')); } catch (e) { p = null; }
    return p && p.codigo && !p.final ? p : null;
  }
  function intentarEnCurso(enLista) {
    var p = guardadoAqui();
    if (!p || enLista.indexOf(p.codigo) >= 0) return;
    var b = el('button', 'compra en-curso');
    b.type = 'button';
    var izq = el('span');
    izq.appendChild(el('span', 'chip vivo', EN_CURSO[p.estado] || 'En curso'));
    izq.appendChild(el('span', 'det', 'Pedido ' + p.codigo + ' · ' + (p.titulo || 'Pedido por confirmar')));
    b.appendChild(izq);
    b.appendChild(el('b', '', 'Ver ›'));
    b.addEventListener('click', function () {
      if (window.parent !== window) window.parent.postMessage({ cuenta: 'cerrar', pedido: true }, location.origin);
      else location.href = RAIZ;
    });
    $('lista').appendChild(b);
  }

  /* Abre un pedido en la tienda: dentro de su ventana se lo pide a la tienda; suelta, va con #pedido=PE-… */
  function abrirEnLaTienda(codigo) {
    if (window.parent !== window) window.parent.postMessage({ cuenta: 'cerrar', pedido: codigo }, location.origin);
    else location.href = RAIZ + '#pedido=' + encodeURIComponent(codigo);
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
      var enCurso = j.en_curso || [];
      intentarEnCurso(enCurso.map(function (p) { return p.codigo; }));
      pintarEnCurso(caja, enCurso);
      if (!j.pedidos.length && !enCurso.length) {
        var v = el('div', 'vacio');
        v.appendChild(el('b', '', 'Aún no vemos compras a su nombre.'));
        v.appendChild(el('p', 'ayuda', 'Cuando compre, en el mostrador o en la tienda en línea, dé su cédula y aparecerán aquí.'));
        var a = el('a', 'boton', 'Hacer un pedido'); a.href = RAIZ;
        v.appendChild(a);
        caja.appendChild(v);
        return;
      }
      if (!j.pedidos.length) return;
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

  /* Los pedidos de la tienda que aún no son venta (por confirmar, o que la tienda no tomó): los manda el
     CRM, así que salen en cualquier celular, y el abierto se abre en la tienda desde cualquiera de ellos. */
  function pintarEnCurso(caja, lista) {
    if (!lista.length) return;
    var ul = el('ul', 'lista');
    lista.forEach(function (p) {
      /* Abierto = se puede abrir en la tienda desde cualquier equipo de la cuenta: terminar el pago, seguirlo o
         cancelarlo (el CRM lo da con la sesión, aunque este celular no tenga su secreto) */
      var abre = !!p.abierto;
      var falta = abre && p.estado === 'POR_CONFIRMAR' && (!p.medio || (p.medio === 'qr' && !p.pago_avisado));
      var fila = el(abre ? 'button' : 'div', 'compra' + (abre ? ' en-curso' : ''));
      if (abre) {
        fila.type = 'button';
        fila.addEventListener('click', function () { abrirEnLaTienda(p.codigo); });
      }
      var izq = el('span');
      izq.appendChild(el('span', 'chip dom', 'Tienda en línea'));
      izq.appendChild(el('span', 'chip' + (falta ? ' pend' : (p.abierto ? ' vivo' : ' pend')), falta ? 'Falta el pago' : (EN_CURSO[p.estado] || p.titulo)));
      izq.appendChild(el('span', 'det', fecha(p.fecha) + ' · Pedido ' + p.codigo));
      fila.appendChild(izq);
      fila.appendChild(el('b', '', falta ? 'Terminar el pago ›' : pesos(p.total)));
      var li = el('li'); li.appendChild(fila); ul.appendChild(li);
    });
    caja.appendChild(ul);
  }

  /* ---------- una compra ---------- */
  function pedido() {
    var id = (new URLSearchParams(location.search).get('id') || '').replace(/\D/g, '');
    var caja = $('detalle');
    if (!id) { aMisPedidos(); return; }
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

  /* El mismo filtro del CRM (cupones.correo_valido): algo@algo.dominio, sin espacios */
  function correoValido(c) { return c.length <= 120 && /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(c); }

  /* ---------- Cupones ---------- */
  function cupones() {
    var caja = $('lista');
    pedir('yo').then(function (yo) {
      $('hola').textContent = 'Hola, ' + ((yo.nombre || '').split(' ')[0] || 'cliente');
      caja.textContent = '';
      var lista = Array.isArray(yo.cupones) ? yo.cupones : [];
      if (!lista.length) {
        var v = el('div', 'vacio');
        v.appendChild(el('b', '', 'Por ahora no tiene cupones.'));
        v.appendChild(el('p', 'ayuda', yo.correo
          ? 'Cuando tengamos uno para usted, le llega al correo y aparece aquí.'
          : 'Ponga su correo en Mis datos y le llega el de su primer domicilio gratis.'));
        if (!yo.correo) { var a = el('a', 'boton', 'Ir a Mis datos'); a.href = BASE + 'datos/'; v.appendChild(a); }
        caja.appendChild(v);
        return;
      }
      var ul = el('ul', 'lista');
      lista.forEach(function (c) {
        var li = el('li', 'cupon');
        li.appendChild(el('b', 'titulo', c.titulo || 'Cupón'));
        li.appendChild(el('span', 'detalle', c.detalle || ''));
        li.appendChild(el('code', 'codigo', c.codigo || ''));
        li.appendChild(el('small', 'solo', 'Se usa solo al pedir: no tiene que escribirlo.'));
        ul.appendChild(li);
      });
      caja.appendChild(ul);
    }, function (err) { caja.textContent = err.message; });
  }

  /* ---------- Mis datos ---------- */
  var EDITABLES = ['nombre', 'barrio', 'direccion', 'indicaciones'];

  function datos() {
    var f = $('f-datos'), e = $('e-datos'), ok = $('ok-datos'), sinCorreo = false;
    function llenar(yo) {
      if (yo.estado === 'por_confirmar') { $('cargando').hidden = true; return enRevision(f.parentNode.insertBefore(el('div'), f)); }
      EDITABLES.forEach(function (c) { $(c).value = yo[c] || ''; });
      $('v-doc').textContent = (yo.tipo_documento + ' ' + yo.documento).trim();
      $('v-cel').textContent = yo.celular || '—';
      $('v-correo').textContent = yo.correo || '—';
      /* Una cuenta de antes, sin correo: lo pone aquí (y le llega el cupón). Con correo, ya no se cambia aquí */
      $('c-correo').hidden = !!yo.correo;
      sinCorreo = !yo.correo;
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
      var correo = $('correo').value.trim().toLowerCase();
      if (sinCorreo && correo) {
        if (!correoValido(correo)) return error(e, 'Revise el correo.');
        d.correo = correo;
      }
      error(e, '');
      var b = f.querySelector('button');
      enviando(b, true);
      pedir('datos', d).then(function (yo) {
        llenar(yo); ok.hidden = false;
        /* La canasta vuelve a proponer lo de la cuenta, no lo último que se escribió en este celular */
        try { localStorage.removeItem('pe-cliente-v1'); } catch (x) { /* sin almacenamiento */ }
      },
        function (err) { error(e, err.message); }).finally(function () { enviando(b, false); });
    });
  }

  var paginas = { entrar: entrar, pedidos: pedidos, pedido: pedido, datos: datos, cupones: cupones };
  function iniciar() {
    if ('aLaTienda' in document.documentElement.dataset) return;   /* menu.js ya la manda a la tienda */
    var p = paginas[document.body.dataset.pagina];
    if (p) p();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
