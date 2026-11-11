/* Panel pequeño de «Mi cuenta» en la cabecera (tienda y portal del cliente).
   Despliega el nombre y tres opciones; si la sesión se venció, lleva a la entrada.
   Los datos vienen del CRM por /tienda/mi-cuenta/api (ver functions/). */
(function () {
  'use strict';
  var API = '/tienda/mi-cuenta/api/';
  /* Raíz de la tienda: «/» en tienda.plasticosespinal.com, «/tienda/» en las pruebas y vistas previas */
  var RAIZ = /^\/tienda(\/|$)/.test(location.pathname) ? '/tienda/' : '/';
  var PORTAL = RAIZ + 'mi-cuenta/';
  /* Mis pedidos, Mis datos y el detalle se ven SIEMPRE como ventana encima de
     la tienda (pedido del dueño): la tienda queda de fondo y una X la devuelve. */
  var EN_VENTANA = ['pedidos', 'datos', 'pedido', 'cupones'];
  var enMarco = false;
  try { enMarco = window.self !== window.top && window.top.location.origin === location.origin; } catch (e) { enMarco = false; }
  var pagina = document.body ? document.body.dataset.pagina : '';
  /* La dirección de la tienda con el portal abierto encima en esa ruta */
  function sobreLaTienda(ruta) { return RAIZ + '#cuenta=' + encodeURIComponent(ruta); }
  function esVentana(url) {
    return url.origin === location.origin && EN_VENTANA.some(function (p) { return url.pathname === PORTAL + p + '/'; });
  }
  /* Entró por la dirección suelta (un enlace guardado): se va a la tienda.
     La marca le dice a cuenta.js que no arranque en una página que ya se va. */
  if (!enMarco && EN_VENTANA.indexOf(pagina) >= 0) {
    document.documentElement.dataset.aLaTienda = '';
    location.replace(sobreLaTienda(location.pathname + location.search));
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
      window.parent.postMessage({ cuenta: 'cerrar', ir: url.pathname === RAIZ ? '' : url.href }, location.origin);
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
      /* «Mis pedidos» pidió ver el pedido en curso: lo abre la tienda (tienda.js) */
      if (e.data.pedido) { window.dispatchEvent(new CustomEvent('pe:abrir-pedido')); return; }
      if (e.data.ir) location.href = e.data.ir;
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ventana) cerrarVentana(); });
    var m = /^#cuenta=(.+)$/.exec(location.hash);
    if (m) abrirVentana(decodeURIComponent(m[1]));
  }

  function iniciar() {
    if (enMarco) { dentroDeLaVentana(); return; }
    var enTienda = location.pathname === RAIZ || location.pathname === RAIZ + 'index.html';
    if (enTienda) enLaTienda();
    /* Mis pedidos y Mis datos: en la tienda se abren encima; desde otra página
       se va directo a la tienda con la ventana abierta, sin pasar por la
       página suelta (que haría un salto más). */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var url = new URL(a.href, location.href);
      if (!esVentana(url)) return;
      e.preventDefault();
      if (enTienda) abrirVentana(url.pathname + url.search);
      else location.href = sobreLaTienda(url.pathname + url.search);
    });
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
      var cabeza = el('div', 'cabeza');
      /* Solo si el CRM ya sabe de fotos (trae «foto» en yo, aunque sea vacía) */
      if ('foto' in yo) cabeza.appendChild(circuloDeFoto(yo, function () { pintar(yo); }));
      var hola = el('p', 'hola');
      hola.appendChild(el('span', '', 'Hola,'));
      hola.appendChild(el('b', '', (yo.nombre || '').split(' ')[0] || 'cliente'));
      cabeza.appendChild(hola);
      panel.appendChild(cabeza);
      if (yo.foto) {
        var quitar = el('button', 'quitar-foto', 'Quitar foto');
        quitar.type = 'button';
        quitar.addEventListener('click', function () {
          quitar.disabled = true;
          mandarFoto('foto/quitar', {}).then(function () { yo.foto = ''; fotoArriba(yo); pintar(yo); panel.querySelector('.foto-yo').focus(); },
            function (e) { quitar.disabled = false; avisoFoto(e.message); });
        });
        panel.appendChild(quitar);
      }
      var aviso = el('small', 'aviso-foto');
      aviso.setAttribute('role', 'status');
      panel.appendChild(aviso);
      [['Mis pedidos', PORTAL + 'pedidos/', 'Compras de la tienda y del mostrador'],
       ['Cupones', PORTAL + 'cupones/', 'Lo que la tienda le regala'],
       ['Mis datos', PORTAL + 'datos/', 'Nombre y dirección de entrega']].forEach(function (o) {
        var a = el('a', 'opcion');
        a.href = o[1];
        a.appendChild(el('b', '', o[0]));
        /* Con un cupón sin usar, «Cupones» lo dice con un punto rojo */
        if (o[0] === 'Cupones' && Array.isArray(yo.cupones) && yo.cupones.length) a.querySelector('b').appendChild(el('span', 'hay', String(yo.cupones.length)));
        a.appendChild(el('small', '', o[2]));
        panel.appendChild(a);
      });
      var salir = el('button', 'salir', 'Salir de mi cuenta');
      salir.type = 'button';
      salir.addEventListener('click', function () {
        /* Sin cuenta no hay tienda: al salir se queda en la entrada, lista para volver a entrar */
        fetch(API + 'salir', { method: 'POST', credentials: 'same-origin' })
          .finally(function () { location.href = PORTAL + '#entrar'; });
      });
      panel.appendChild(salir);
      panel.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
    }

    /* ---------- Foto de perfil ---------- */
    /* Opcional: se pone tocando el círculo de la inicial (no hay otro botón) y se quita con «Quitar foto».
       Solo la ve su dueño. Antes de mandarla se achica aquí mismo (una foto del celular pesa varios megas);
       el CRM la vuelve a escribir limpia, sin los datos de la cámara. */
    var LADO_FOTO = 640;
    function avisoFoto(texto) { var a = panel.querySelector('.aviso-foto'); if (a) a.textContent = texto || ''; }
    function mandarFoto(ruta, cuerpo) {
      return fetch(API + ruta, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (r.status === 401) { location.href = PORTAL; return new Promise(function () {}); }
            if (!r.ok || !j.ok) throw new Error(j.error || 'No pudimos guardar la foto. Intente más tarde.');
            return j;
          });
        });
    }
    function rutaFoto(nombre) { return API + 'foto/' + nombre; }
    /* El círculo de arriba (el que abre este menú): la foto si hay; si no, lo que ya tenía (la inicial) */
    var inicialDeArriba = null;
    function fotoArriba(yo) {
      var c = boton.querySelector('.yo');
      if (!c) return;
      if (inicialDeArriba === null && !c.querySelector('img')) inicialDeArriba = c.textContent;
      if (yo.foto) {
        var img = el('img');
        img.src = rutaFoto(yo.foto); img.alt = ''; img.width = 42; img.height = 42;
        c.textContent = ''; c.appendChild(img); c.classList.add('con-foto');
      } else if (c.querySelector('img')) {
        c.textContent = inicialDeArriba || Array.from((yo.nombre || '').trim() || '·')[0].toUpperCase();
        c.classList.remove('con-foto');
      }
    }
    /* La foto escogida, achicada y como JPEG en base64 */
    function achicar(archivo) {
      return new Promise(function (ok, mal) {
        var no = function () { mal(new Error('No pudimos leer esa foto. Pruebe con otra.')); };
        if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return mal(new Error('Escoja una foto JPG, PNG o WebP.'));
        var lector = new FileReader();
        lector.onerror = no;
        lector.onload = function () {
          var img = new Image();
          img.onerror = no;
          img.onload = function () {
            var lado = Math.min(img.naturalWidth, img.naturalHeight), fin = Math.min(lado, LADO_FOTO);
            if (!lado) return no();
            var lienzo = document.createElement('canvas');
            lienzo.width = lienzo.height = fin;
            var ctx = lienzo.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, fin, fin);
            ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, fin, fin);
            ok(lienzo.toDataURL('image/jpeg', 0.88));
          };
          img.src = String(lector.result);
        };
        lector.readAsDataURL(archivo);
      });
    }
    function circuloDeFoto(yo, repintar) {
      var caja = el('span', 'foto-caja');
      var b = el('button', 'foto-yo');
      b.type = 'button';
      b.setAttribute('aria-label', yo.foto ? 'Cambiar mi foto de perfil' : 'Poner mi foto de perfil');
      b.title = yo.foto ? 'Cambiar mi foto' : 'Poner mi foto';
      if (yo.foto) {
        var img = el('img');
        img.src = rutaFoto(yo.foto); img.alt = ''; img.width = 56; img.height = 56;
        b.appendChild(img);
      } else b.appendChild(el('span', '', Array.from((yo.nombre || '').trim() || '·')[0].toUpperCase()));
      var camara = el('span', 'foto-camara');
      camara.setAttribute('aria-hidden', 'true');
      b.appendChild(camara);
      var archivo = el('input');
      archivo.type = 'file'; archivo.accept = 'image/jpeg,image/png,image/webp'; archivo.hidden = true;
      archivo.className = 'foto-archivo';
      archivo.setAttribute('aria-label', 'Foto de perfil');
      b.addEventListener('click', function () { archivo.click(); });
      archivo.addEventListener('change', function () {
        var f = archivo.files && archivo.files[0];
        if (!f) return;
        avisoFoto('Guardando su foto…');
        b.disabled = true;
        achicar(f).then(function (imagen) { return mandarFoto('foto', { imagen: imagen }); })
          .then(function (j) { yo.foto = j.foto || ''; fotoArriba(yo); repintar(); panel.querySelector('.foto-yo').focus(); avisoFoto('Foto guardada ✓'); },
            function (e) { b.disabled = false; archivo.value = ''; avisoFoto(e.message); });
      });
      caja.appendChild(b);
      caja.appendChild(archivo);
      return caja;
    }
    /* Al cargar, el círculo de arriba ya muestra la foto (la tienda le avisa a quién leyó; si no, se pregunta) */
    document.addEventListener('pe:yo', function (e) { if (e.detail) fotoArriba(e.detail); });
    if (window.PE_YO) fotoArriba(window.PE_YO);

    boton.addEventListener('click', function (e) {
      e.preventDefault();
      if (!panel.hidden) { cerrar(); return; }
      fetch(API + 'yo', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (yo) {
          if (yo && yo.ok) { fotoArriba(yo); pintar(yo); }
          else location.href = PORTAL;
        })
        .catch(function () { location.href = PORTAL; });
    });
    document.addEventListener('click', function (e) { if (!caja.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
