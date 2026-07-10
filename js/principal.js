// Plásticos Espinal — JS mínimo y no bloqueante (cargado con defer).
// El sitio funciona completo sin JavaScript; esto solo agrega detalles.

// Año actual en el pie de página.
const anio = document.getElementById("anio");
if (anio) anio.textContent = new Date().getFullYear();

// Respeta la preferencia de menos movimiento del sistema operativo.
const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Numera los hijos de cada grupo escalonado (retraso en cascada vía --i).
document.querySelectorAll("[data-escalonado]").forEach((grupo) => {
  Array.from(grupo.children).forEach((hijo, i) => {
    hijo.style.setProperty("--i", i);
  });
});

// Todo lo que se revela al entrar en pantalla.
const revelables = document.querySelectorAll(".reveal, [data-escalonado] > *");

if (sinMovimiento || !("IntersectionObserver" in window)) {
  // Sin animación: mostrar de una.
  revelables.forEach((el) => el.classList.add("is-visible"));
} else {
  const obs = new IntersectionObserver(
    (entradas, observador) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          observador.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  revelables.forEach((el) => obs.observe(el));
}

// Resalta en el menú la sección visible (scroll-spy).
const enlacesMenu = document.querySelectorAll(".menu a[href^='#']");
const seccionesMenu = Array.from(enlacesMenu)
  .map((a) => document.getElementById(a.hash.slice(1)))
  .filter(Boolean);
// La portada también se observa: al volver arriba se limpia el resaltado.
const portadaSpy = document.getElementById("inicio");
if (portadaSpy) seccionesMenu.push(portadaSpy);
if (seccionesMenu.length && "IntersectionObserver" in window) {
  const enlacePorId = new Map(Array.from(enlacesMenu).map((a) => [a.hash.slice(1), a]));
  const obsMenu = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        enlacesMenu.forEach((a) => a.removeAttribute("aria-current"));
        const enlace = enlacePorId.get(e.target.id);
        if (enlace) enlace.setAttribute("aria-current", "true");
      });
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  seccionesMenu.forEach((s) => obsMenu.observe(s));
}

// Sombra en la cabecera al bajar (feedback de estado).
const cabecera = document.querySelector(".cabecera");
if (cabecera) {
  const alScroll = () => cabecera.classList.toggle("is-scrolled", window.scrollY > 8);
  alScroll();
  window.addEventListener("scroll", alScroll, { passive: true });
}

// Cuenta ascendente de las cifras cuando entran en pantalla.
function animarCifra(el) {
  const texto = el.textContent.trim();
  const m = texto.match(/^([^\d]*)(\d+)(.*)$/); // prefijo, número, sufijo
  if (!m) return; // "Mayorista", "Mismo día"… no son números
  const prefijo = m[1], destino = parseInt(m[2], 10), sufijo = m[3];
  if (sinMovimiento) return; // deja el valor final tal cual
  const dur = 1100, ini = performance.now();
  el.textContent = prefijo + "0" + sufijo;
  const paso = (ahora) => {
    const t = Math.min((ahora - ini) / dur, 1);
    const val = Math.round((1 - Math.pow(1 - t, 3)) * destino); // ease-out cúbico
    el.textContent = prefijo + val + sufijo;
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const cifras = document.querySelectorAll(".boletas b, .sellos b");
if (cifras.length && !sinMovimiento && "IntersectionObserver" in window) {
  const obsCifras = new IntersectionObserver(
    (entradas, observador) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          animarCifra(e.target);
          observador.unobserve(e.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  cifras.forEach((el) => obsCifras.observe(el));
}
