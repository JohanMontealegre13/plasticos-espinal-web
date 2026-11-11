/* Plásticos Espinal · web pública. JS mínimo, sin dependencias.
   Nada del contenido depende de este archivo: sin él, todo se ve y todo se puede tocar. */
(function () {
  'use strict';

  var menosMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hayObservador = 'IntersectionObserver' in window;

  /* 1. Año del pie */
  var anio = document.getElementById('anio');
  if (anio) anio.textContent = String(new Date().getFullYear());

  /* 2. Sombra de la cabecera al desplazarse */
  var cabecera = document.querySelector('.cabecera');
  if (cabecera) {
    var marcar = function () { cabecera.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', marcar, { passive: true });
    marcar();
  }

  /* 3. Menú activo según la sección visible (banda y pie a la vez) */
  if (hayObservador) {
    var enlaces = document.querySelectorAll('.menu a');
    var ids = ['inicio', 'catalogo', 'sectores', 'ecologicos', 'nosotros', 'preguntas', 'contacto'];

    var activar = function (id) {
      enlaces.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (id === 'inicio') return;
      document.querySelectorAll('.menu a[href="#' + id + '"]').forEach(function (a) {
        a.setAttribute('aria-current', 'true');
      });
    };

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) activar(e.target.id); });
    }, { rootMargin: '-35% 0px -55% 0px' });

    ids.forEach(function (id) {
      var seccion = document.getElementById(id);
      if (seccion) observador.observe(seccion);
    });
  }

  /* 4. Aparecer al bajar: cada bloque marcado data-revela sube y aparece una sola vez.
        Lo que ya se ve al cargar se marca primero, para que no parpadee. Los hermanos
        salen escalonados 70 ms (máximo 5 pasos). Con «menos movimiento» no se hace nada. */
  var revelar = document.querySelectorAll('[data-revela]');
  if (revelar.length && hayObservador && !menosMovimiento) {
    var alto = window.innerHeight || document.documentElement.clientHeight;
    var porVer = [];
    revelar.forEach(function (/** @type {HTMLElement} */ el) {
      var r = el.getBoundingClientRect();
      if (r.top < alto && r.bottom > 0) { el.classList.add('visto'); return; }
      var hermanos = el.parentElement ? el.parentElement.querySelectorAll(':scope > [data-revela]') : [];
      var i = Array.prototype.indexOf.call(hermanos, el);
      if (i > 0) el.style.setProperty('--retraso', Math.min(i, 5) * 70 + 'ms');
      porVer.push(el);
    });
    var vigia = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visto');
        vigia.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    porVer.forEach(function (el) { vigia.observe(el); });
    document.documentElement.classList.add('revela-listo');
  }

  /* 5. Carrusel de categorías: flechas, puntos y pausa. Avanza solo cada 5 s mientras
        se ve en pantalla; se detiene con el mouse encima o con el foco adentro, y se
        apaga del todo cuando la persona lo toca, lo desliza o pulsa la pausa. */
  var SVG = 'http://www.w3.org/2000/svg';
  /** @param {string} id */
  function icono(id) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('class', 'icono');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(SVG, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }
  /** @param {string} clase @param {string} etiqueta @param {string} [id] */
  function boton(clase, etiqueta, id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = clase;
    b.setAttribute('aria-label', etiqueta);
    if (id) b.appendChild(icono(id));
    return b;
  }

  /** @param {HTMLElement} raiz */
  function carrusel(raiz) {
    var pista = /** @type {HTMLElement} */ (raiz.querySelector('.carrusel__pista'));
    if (!pista || pista.children.length < 2) return;
    var items = /** @type {HTMLElement[]} */ (Array.prototype.slice.call(pista.children));

    raiz.setAttribute('role', 'region');
    raiz.setAttribute('aria-roledescription', 'carrusel');
    raiz.setAttribute('aria-label', pista.getAttribute('aria-label') || 'Carrusel');

    var controles = document.createElement('div');
    controles.className = 'carrusel__controles';
    var ant = boton('carrusel__flecha carrusel__flecha--ant', 'Anteriores', 'i-flecha');
    var sig = boton('carrusel__flecha carrusel__flecha--sig', 'Siguientes', 'i-flecha');
    var puntos = document.createElement('div');
    puntos.className = 'carrusel__puntos';
    var pausa = boton('carrusel__pausa', 'Pausar el carrusel', 'i-pausa');
    controles.appendChild(ant);
    controles.appendChild(puntos);
    controles.appendChild(sig);
    if (!menosMovimiento) controles.appendChild(pausa);
    raiz.appendChild(controles);
    raiz.classList.add('carrusel--listo');

    var paso = function () {
      var a = items[0].getBoundingClientRect().width;
      var b = items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left;
      return b || a || 1;
    };
    var porVista = function () { return Math.max(1, Math.round((pista.clientWidth + 1) / paso())); };
    var paginas = function () { return Math.max(1, Math.ceil(items.length / porVista())); };
    var maximo = function () { return pista.scrollWidth - pista.clientWidth; };
    var actual = function () {
      if (pista.scrollLeft >= maximo() - 4) return paginas() - 1;
      return Math.round(pista.scrollLeft / (paso() * porVista()));
    };

    var irA = function (/** @type {number} */ p) {
      var n = paginas();
      p = ((p % n) + n) % n;
      var objetivo = Math.min(p * porVista() * paso(), maximo());
      pista.scrollTo({ left: objetivo, behavior: menosMovimiento ? 'auto' : 'smooth' });
    };

    var cuantos = 0;
    var pintar = function () {
      var n = paginas();
      if (n !== cuantos) {
        cuantos = n;
        while (puntos.firstChild) puntos.removeChild(puntos.firstChild);
        for (var i = 0; i < n; i++) {
          var d = boton('carrusel__punto', 'Ir al grupo ' + (i + 1) + ' de ' + n);
          d.dataset.pagina = String(i);
          puntos.appendChild(d);
        }
        controles.hidden = n < 2;
      }
      var a = actual();
      Array.prototype.forEach.call(puntos.children, function (/** @type {HTMLElement} */ d, /** @type {number} */ i) {
        if (i === a) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      /* aria-disabled y no disabled: un botón deshabilitado con el foco encima lo bota a <body> */
      ant.setAttribute('aria-disabled', String(pista.scrollLeft <= 4));
      sig.setAttribute('aria-disabled', String(pista.scrollLeft >= maximo() - 4));
    };

    /* Avance solo */
    var apagado = menosMovimiento;
    /* data-cada: cada cuántos milisegundos avanza (la portada va más rápido que las categorías).
       data-sigue-con-raton: no se detiene con el mouse encima (la portada ocupa todo el ancho y el
       mouse casi siempre queda sobre ella); se detiene con el foco, al tocarla o con la pausa. */
    var cada = Number(raiz.dataset.cada) || 5000;
    var sigueConRaton = raiz.hasAttribute('data-sigue-con-raton');
    var raton = false;   /* el mouse encima */
    var foco = false;    /* el foco del teclado adentro (cada uno pausa por su lado) */
    var visible = false;
    var reloj = 0;
    var parar = function () { if (reloj) { clearInterval(reloj); reloj = 0; } };
    var revisar = function () {
      parar();
      if (apagado || (raton && !sigueConRaton) || foco || !visible || document.hidden || paginas() < 2) return;
      reloj = window.setInterval(function () {
        var a = actual();
        irA(a >= paginas() - 1 ? 0 : a + 1);
      }, cada);
    };
    var apagar = function () {
      if (apagado) return;
      apagado = true;
      pausa.setAttribute('aria-label', 'Seguir moviendo el carrusel');
      pausa.replaceChildren(icono('i-seguir'));
      revisar();
    };

    /* Las flechas mueven una vista entera desde donde esté la fila (también a medio deslizar) y se
       detienen en los extremos; solo el avance solo vuelve al principio. */
    var correr = function (/** @type {number} */ d) {
      pista.scrollBy({ left: d * porVista() * paso(), behavior: menosMovimiento ? 'auto' : 'smooth' });
    };
    ant.addEventListener('click', function () { if (ant.getAttribute('aria-disabled') === 'true') return; apagar(); correr(-1); });
    sig.addEventListener('click', function () { if (sig.getAttribute('aria-disabled') === 'true') return; apagar(); correr(1); });
    puntos.addEventListener('click', function (e) {
      var d = /** @type {HTMLElement} */ (e.target).closest('.carrusel__punto');
      if (!d) return;
      apagar();
      irA(Number(/** @type {HTMLElement} */ (d).dataset.pagina));
    });
    pausa.addEventListener('click', function () {
      if (!apagado) { apagar(); return; }
      apagado = false;
      pausa.setAttribute('aria-label', 'Pausar el carrusel');
      pausa.replaceChildren(icono('i-pausa'));
      revisar();
    });

    pista.addEventListener('pointerdown', apagar, { passive: true });
    pista.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) apagar(); }, { passive: true });
    raiz.addEventListener('mouseenter', function () { raton = true; revisar(); });
    raiz.addEventListener('mouseleave', function () { raton = false; revisar(); });
    raiz.addEventListener('focusin', function () { foco = true; revisar(); });
    raiz.addEventListener('focusout', function (e) {
      if (!raiz.contains(/** @type {Node} */ (e.relatedTarget))) { foco = false; revisar(); }
    });
    document.addEventListener('visibilitychange', revisar);

    var cuadro = 0;
    pista.addEventListener('scroll', function () {
      if (cuadro) return;
      cuadro = requestAnimationFrame(function () { cuadro = 0; pintar(); });
    }, { passive: true });
    window.addEventListener('resize', function () { pintar(); revisar(); });

    if (hayObservador) {
      new IntersectionObserver(function (entradas) {
        visible = entradas[0].isIntersecting;
        revisar();
      }, { threshold: 0.4 }).observe(pista);
    }
    pintar();
  }

  document.querySelectorAll('[data-carrusel]').forEach(function (el) { carrusel(/** @type {HTMLElement} */ (el)); });

  /* 5c. Resumen de categoría (Johan, 11-nov-2026): tocar una tarjeta de «Compre por categoría» abre
         una ventana con lo que trae esa categoría (foto, nombre, frase y tipos de producto) y el
         botón a la tienda. Sin JS, o con Ctrl/⌘+clic, la tarjeta sigue llevando al catálogo. */
  (function () {
    var dlg = /** @type {HTMLDialogElement|null} */ (document.getElementById('resumenCat'));
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var foto = /** @type {HTMLImageElement} */ (document.getElementById('resumenFoto'));
    var titulo = /** @type {HTMLElement} */ (document.getElementById('resumenTitulo'));
    var bajada = /** @type {HTMLElement} */ (document.getElementById('resumenBajada'));
    var tipos = /** @type {HTMLElement} */ (document.getElementById('resumenTipos'));
    /** @type {HTMLElement|null} */
    var origen = null;
    document.querySelectorAll('[data-resumen]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var e = /** @type {MouseEvent} */ (ev);
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        ev.preventDefault();
        var tarjeta = /** @type {HTMLElement} */ (el);
        var img = /** @type {HTMLImageElement|null} */ (tarjeta.querySelector('img'));
        var h = tarjeta.querySelector('h3');
        var p = tarjeta.querySelector('p');
        if (img) { foto.srcset = img.srcset; foto.sizes = '(min-width: 600px) 560px, 100vw'; foto.src = img.src; }
        titulo.textContent = h ? (h.textContent || '').trim() : '';
        bajada.textContent = p ? (p.textContent || '').trim() : '';
        tipos.textContent = '';
        (tarjeta.dataset.tipos || '').split('|').forEach(function (t) {
          if (!t) return;
          var li = document.createElement('li');
          li.appendChild(icono('i-check'));
          li.appendChild(document.createTextNode(t));
          tipos.appendChild(li);
        });
        origen = tarjeta;
        dlg.showModal();
      });
    });
    dlg.addEventListener('click', function (ev) {
      var t = /** @type {HTMLElement} */ (ev.target);
      /* Cierra con la X o al tocar fuera de la caja */
      if (t === dlg || t.closest('[data-cerrar]')) dlg.close();
    });
    dlg.addEventListener('close', function () { if (origen) origen.focus(); });
  })();

  /* 5b. Fotos que esperan: las láminas 2 y 3 de la portada traen su foto en data-src/data-srcset
         para que, con datos lentos, la primera foto no comparta la conexión con ellas. Se ponen
         cuando la página terminó de cargar, o antes si alguien desliza o toca la portada (o el
         carrusel avanza solo). */
  (function () {
    var esperan = document.querySelectorAll('[data-srcset], [data-src]');
    if (!esperan.length) return;
    var hecho = false;
    var poner = function () {
      if (hecho) return;
      hecho = true;
      esperan.forEach(function (el) {
        var e = /** @type {HTMLElement} */ (el);
        if (e.dataset.srcset) { e.setAttribute('srcset', e.dataset.srcset); e.removeAttribute('data-srcset'); }
        if (e.dataset.src) { e.setAttribute('src', e.dataset.src); e.removeAttribute('data-src'); }
      });
    };
    if (document.readyState === 'complete') { poner(); return; }
    window.addEventListener('load', poner, { once: true });
    var heroe = document.querySelector('.carrusel--heroe');
    if (heroe) {
      var pistaH = heroe.querySelector('.carrusel__pista');
      if (pistaH) pistaH.addEventListener('scroll', poner, { once: true, passive: true });
      heroe.addEventListener('pointerdown', poner, { once: true, passive: true });
      heroe.addEventListener('focusin', poner, { once: true });
    }
  })();

  /* 6. Cinta de marcas: sin JS corre sola por CSS. Con JS la mueve principal.js para que también se
        pueda arrastrar a los lados con el mouse o el dedo (y con la rueda de lado del trackpad);
        al soltarla sigue sola desde donde quedó. Se detiene con el mouse encima, con el foco adentro
        o con el botón de pausa (lo exige WCAG 2.2.2 para lo que se mueve más de 5 s). Con «menos
        movimiento» no corre, no se arrastra ni sale el botón. */
  var cinta = /** @type {HTMLElement | null} */ (document.querySelector('[data-marcas]'));
  var pausaCinta = document.getElementById('marcasPausa');
  var ventanaCinta = cinta && /** @type {HTMLElement | null} */ (cinta.querySelector('.marcas__ventana'));
  var pistaCinta = cinta && /** @type {HTMLElement | null} */ (cinta.querySelector('.marcas__pista'));
  if (cinta && pausaCinta && ventanaCinta && pistaCinta && !menosMovimiento) {
    var laCinta = cinta;
    var botonCinta = pausaCinta;
    var ventanaM = ventanaCinta;
    var pistaM = pistaCinta;
    var VELOCIDAD = 70;   /* píxeles por segundo */
    var corrido = 0;      /* cuánto ha corrido la pista hacia la izquierda */
    var antes = 0;
    var encima = false;
    var adentro = false;
    var quieta = false;
    var enPantalla = !hayObservador;
    var cuadroCinta = 0;
    /** @type {{ id: number, x: number, desde: number } | null} */
    var arrastre = null;
    laCinta.classList.add('marcas--mano');
    botonCinta.hidden = false;

    /* Fichas 3D: cada logo entra en una ficha con grosor y dorso (estilos.css, «Fichas 3D»). El logo
       no se toca: se mueve la ficha entera. Cada ficha flota con su propio ritmo (--d). */
    /** @param {string} clase */
    var capa = function (clase) {
      var d = document.createElement('div');
      d.className = clase;
      return d;
    };
    pistaM.querySelectorAll('.marcas__lista li').forEach(function (li, i) {
      var logo = li.querySelector('img');
      if (!logo) return;
      var truco = capa('marca__truco');
      var flota = capa('marca__flota');
      var ficha = capa('marca__ficha');
      var cara = capa('marca__cara');
      cara.appendChild(logo);
      ficha.append(capa('marca__canto'), capa('marca__canto'), capa('marca__dorso'), cara);
      flota.appendChild(ficha);
      truco.appendChild(flota);
      li.replaceChildren(truco, capa('marca__piso'));
      /** @type {HTMLElement} */ (li).style.setProperty('--d', (-((i % 14) * 0.73) % 5.5).toFixed(2) + 's');
    });
    laCinta.classList.add('marcas--3d');

    /* La pista lleva la lista cuatro veces: correr una lista entera deja todo igual que al empezar */
    var ponerEn = function () {
      var vuelta = pistaM.scrollWidth / 4;
      if (vuelta > 0) corrido = ((corrido % vuelta) + vuelta) % vuelta;
      pistaM.style.transform = 'translate3d(' + (-corrido).toFixed(1) + 'px, 0, 0)';
    };
    var avanzar = function (/** @type {number} */ t) {
      cuadroCinta = 0;
      var dt = antes ? Math.min(t - antes, 100) : 0;
      antes = t;
      if (!arrastre && !quieta && !encima && !adentro) corrido += VELOCIDAD * dt / 1000;
      ponerEn();
      seguir();
    };
    var seguir = function () {
      if (cuadroCinta) return;
      if (!enPantalla || document.hidden) { antes = 0; return; }
      cuadroCinta = requestAnimationFrame(avanzar);
    };

    ventanaM.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      arrastre = { id: e.pointerId, x: e.clientX, desde: corrido };
      ventanaM.setPointerCapture(e.pointerId);
      laCinta.classList.add('esta-arrastrando');
    });
    ventanaM.addEventListener('pointermove', function (e) {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      corrido = arrastre.desde - (e.clientX - arrastre.x);
      ponerEn();
    });
    var soltar = function (/** @type {PointerEvent} */ e) {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      arrastre = null;
      laCinta.classList.remove('esta-arrastrando');
    };
    ventanaM.addEventListener('pointerup', soltar);
    ventanaM.addEventListener('pointercancel', soltar);
    /* Las fotos de los logos no se arrastran solas (el navegador las sacaría de la página) */
    ventanaM.addEventListener('dragstart', function (e) { e.preventDefault(); });
    ventanaM.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      corrido += e.deltaX;
      ponerEn();
    }, { passive: false });
    ventanaM.addEventListener('mouseenter', function () { encima = true; });
    ventanaM.addEventListener('mouseleave', function () { encima = false; });
    /* El foco en la ventana (no en el botón de pausa: al seguir, el foco queda en él) */
    ventanaM.addEventListener('focusin', function () { adentro = true; });
    ventanaM.addEventListener('focusout', function (e) {
      if (!ventanaM.contains(/** @type {Node} */ (e.relatedTarget))) adentro = false;
    });
    botonCinta.addEventListener('click', function () {
      quieta = !quieta;
      laCinta.classList.toggle('esta-pausada', quieta);
      botonCinta.setAttribute('aria-label', quieta ? 'Seguir moviendo las marcas' : 'Pausar las marcas');
      botonCinta.replaceChildren(icono(quieta ? 'i-seguir' : 'i-pausa'));
    });
    /* Con el mouse encima, la ficha se ladea hacia el puntero */
    ventanaM.addEventListener('pointermove', function (e) {
      if (arrastre || e.pointerType !== 'mouse') return;
      var li = /** @type {Element} */ (e.target).closest('li');
      var ficha = li && /** @type {HTMLElement | null} */ (li.querySelector('.marca__ficha'));
      if (!li || !ficha) return;
      var r = li.getBoundingClientRect();
      ficha.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 30).toFixed(1) + 'deg');
      ficha.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 24).toFixed(1) + 'deg');
    });
    ventanaM.addEventListener('pointerout', function (e) {
      var li = /** @type {Element} */ (e.target).closest('li');
      var ficha = li && /** @type {HTMLElement | null} */ (li.querySelector('.marca__ficha'));
      if (!ficha) return;
      ficha.style.removeProperty('--ry');
      ficha.style.removeProperty('--rx');
    });

    /* Las «cosas raras» (Johan, 11-nov-2026: «que no todo se vea igual»). Cada 3 a 4,5 s sale UN
       truco, sacado de una bolsa: no se repite ninguno hasta que salgan todos, y la bolsa se baraja
       otra vez. Los de una ficha los hace una de las que se ven; los de grupo, todas las que se ven,
       una tras otra (paso, en ms). Nada con la cinta pausada, con el mouse encima, arrastrándola,
       con el foco adentro o fuera de la pantalla. La duración de cada uno va con su animación en
       estilos.css («Los trucos»). */
    /** @type {{ n: string, ms: number, grupo?: number, alReves?: boolean }[]} */
    var TRUCOS = [
      { n: 'voltereta', ms: 1300 }, { n: 'salto', ms: 900 }, { n: 'moneda', ms: 1400 },
      { n: 'cohete', ms: 2200 }, { n: 'saludo', ms: 1100 }, { n: 'trompo', ms: 1200 },
      { n: 'doble-salto', ms: 1300 }, { n: 'rebote', ms: 1900 }, { n: 'pendulo', ms: 1700 },
      { n: 'latido', ms: 1000 }, { n: 'acercarse', ms: 1300 }, { n: 'hundirse', ms: 1600 },
      { n: 'tambaleo', ms: 1000 }, { n: 'mira-atras', ms: 1600 }, { n: 'vuelta-canto', ms: 1000 },
      { n: 'rueda', ms: 1900 }, { n: 'resorte', ms: 1300 }, { n: 'asomarse', ms: 1300 },
      { n: 'temblor', ms: 700 }, { n: 'orbita', ms: 1400 }, { n: 'domino', ms: 1500 },
      { n: 'no', ms: 1000 }, { n: 'si', ms: 1000 }, { n: 'mortal', ms: 1300 },
      { n: 'brinco-lado', ms: 1100 }, { n: 'paracaidas', ms: 3000 },
      /* De grupo */
      { n: 'salto', ms: 900, grupo: 110 }, { n: 'salto', ms: 900, grupo: 110, alReves: true },
      { n: 'domino', ms: 1500, grupo: 150 }, { n: 'si', ms: 1000, grupo: 0 },
      { n: 'vuelta-canto', ms: 1000, grupo: 140 }, { n: 'trompo', ms: 1200, grupo: 90, alReves: true },
    ];
    /** @type {typeof TRUCOS} */
    var bolsa = [];
    var hacerTruco = function () {
      window.setTimeout(hacerTruco, 3000 + Math.random() * 1500);
      if (quieta || encima || adentro || arrastre || !enPantalla || document.hidden) return;
      if (pistaM.querySelector('[class*="hace-"]')) return;
      var caja = ventanaM.getBoundingClientRect();
      var margen = caja.width * 0.1;
      var visibles = /** @type {HTMLElement[]} */ (Array.prototype.filter.call(pistaM.querySelectorAll('li'), function (/** @type {Element} */ li) {
        var r = li.getBoundingClientRect();
        return r.left > caja.left + margen && r.right < caja.right - margen;
      }));
      if (!visibles.length) return;
      if (!bolsa.length) {
        bolsa = TRUCOS.slice();
        for (var k = bolsa.length - 1; k > 0; k--) {
          var j = Math.floor(Math.random() * (k + 1));
          var t = bolsa[k]; bolsa[k] = bolsa[j]; bolsa[j] = t;
        }
      }
      var truco = /** @type {typeof TRUCOS[number]} */ (bolsa.pop());
      var fichas = truco.grupo === undefined ? [visibles[Math.floor(Math.random() * visibles.length)]] : visibles;
      if (truco.alReves) fichas.reverse();
      var clase = 'hace-' + truco.n;
      fichas.forEach(function (li, orden) {
        var retraso = (truco.grupo || 0) * orden;
        var parte = li.querySelector('.marca__truco');
        if (!parte) return;
        li.style.setProperty('--dur', truco.ms + 'ms');
        li.style.setProperty('--retraso', retraso + 'ms');
        li.classList.add(clase);
        var acabar = function () {
          li.classList.remove(clase);
          li.style.removeProperty('--retraso');
        };
        parte.addEventListener('animationend', acabar, { once: true });
        window.setTimeout(acabar, truco.ms + retraso + 400);   /* por si la animación no llega a terminar */
      });
    };
    window.setTimeout(hacerTruco, 1500);

    document.addEventListener('visibilitychange', seguir);
    if (hayObservador) {
      new IntersectionObserver(function (entradas) {
        enPantalla = entradas[0].isIntersecting;
        laCinta.classList.toggle('esta-fuera', !enPantalla);
        seguir();
      }).observe(ventanaM);
    }
    seguir();
  }

  /* 7. Que :active funcione al tocar en iOS */
  document.addEventListener('touchstart', function () {}, { passive: true });
})();
