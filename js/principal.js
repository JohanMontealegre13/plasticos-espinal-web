/* Plásticos Espinal · web pública. JS mínimo, sin dependencias.
   Nada del contenido depende de este archivo. */
(function () {
  'use strict';

  /* 1. Año del pie */
  var anio = document.getElementById('anio');
  if (anio) anio.textContent = new Date().getFullYear();

  /* 2. Sombra de la cabecera al desplazarse */
  var cabecera = document.querySelector('.cabecera');
  if (cabecera) {
    var marcar = function () { cabecera.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', marcar, { passive: true });
    marcar();
  }

  /* 3. Menú activo según la sección visible (cápsula, fila y pie a la vez) */
  if ('IntersectionObserver' in window) {
    var enlaces = document.querySelectorAll('.menu a');
    var ids = ['inicio', 'catalogo', 'sectores', 'ecologicos', 'nosotros', 'resenas', 'preguntas', 'contacto'];
    var sinMarca = { inicio: true, resenas: true };

    var activar = function (id) {
      enlaces.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (sinMarca[id]) return;
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

  /* 4. La burbuja se oculta mientras se ven los botones de la portada
        (no se monta sobre «Pida su cotización»). Sin JS sigue visible. */
  var burbuja = document.querySelector('.wa-flotante');
  var botonesPortada = document.querySelector('.portada__botones');
  if (burbuja && botonesPortada && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          if (document.activeElement === burbuja) return; /* no quitarle el foco a quien navega con teclado */
          burbuja.classList.add('is-oculta');
        } else {
          burbuja.classList.remove('is-oculta');
        }
      });
    }).observe(botonesPortada);
  }

  /* 5. Que :active funcione al tocar en iOS */
  document.addEventListener('touchstart', function () {}, { passive: true });
})();
