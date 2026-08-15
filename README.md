# Sitio web público — Plásticos Espinal

Página de presentación del negocio (una sola página, HTML/CSS/JS puro, sin
dependencias externas). Diseño 3: **"Mercado de día"** — lienzo claro
(#EEF2FC) con franjas blanco/claro, producto protagonista, botón de WhatsApp
verde idéntico en toda la página, cinta bicolor azul/rojo como subrayado de
títulos y remate del pie, y el footer azul noche como único bloque oscuro.
Tipografía Archivo Black solo en titulares. Verificada con la
[Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist).

## Dónde vive

- **Esta carpeta** (`plasticos-espinal-web/`, en el Escritorio dentro de
  "Plasticos Espinal") es el repositorio real del sitio.
- **GitHub**: <https://github.com/johanmontealegre13/plasticos-espinal-web>
  (rama `main`). Un `git push` publica automáticamente vía GitHub Pages.
- **Dominio en producción**: <https://plasticosespinal.com> (configurado con
  `CNAME`).
- El CRM es un proyecto aparte: `~/PlasticosEspinal-CRM` (Flask; ver su
  `CLAUDE.md`).

## Ver el sitio en el computador

```bash
python3 -m http.server 5500 --directory "/Users/johanmontealegrep/Desktop/Plasticos Espinal/plasticos-espinal-web"
```

Luego abre <http://localhost:5500/>.

## Publicar un cambio

1. Edita los archivos.
2. Si tocaste `css/estilos.css`, sube el número de versión `?v=N` en
   `index.html` y `404.html` (invalida la caché de los navegadores).
3. `git add` + `git commit` + `git push origin main` — GitHub Pages
   despliega solo en ~1 minuto.

## ✏️ Datos pendientes de mejorar

1. **Mapa real** — el recuadro del mapa es un enlace con diseño propio. Cuando
   haya ficha de Google Business Profile: en Maps → **Compartir → Insertar un
   mapa**, copiar el `<iframe …>` y reemplazar el bloque
   `<a class="contacto-mapa">…</a>`.
2. **Reseñas reales** — las tres notas de la sección Reseñas son testimonios
   de muestra: reemplazar por reseñas reales (con permiso) o por las de
   Google Business Profile.
3. **`og-image.jpg`** — la imagen para compartir en redes sigue siendo la del
   diseño anterior; conviene rehacerla con el look claro actual.
4. **Presentaciones de venta** — cuando se definan ("paca x100", "desde 1
   caja"), añadirlas a las tarjetas del catálogo; también un bloque "Los más
   pedidos" con productos concretos.

## Estructura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (hero, marcas, catálogo, sectores, línea ecológica, nosotros, reseñas, FAQ, contacto) |
| `css/estilos.css` | Todos los estilos (sistema "Mercado de día"; paleta oficial del logo) |
| `js/principal.js` | JS mínimo con `defer`; el sitio funciona sin JavaScript |
| `img/` | Logo optimizado (2 tamaños), favicons, fotos de producto y `og-image.jpg` |
| `favicon.ico`, `site.webmanifest` | Iconos del navegador y de "agregar a pantalla de inicio" |
| `robots.txt`, `sitemap.xml`, `CNAME` | Para Google y para el dominio en GitHub Pages |
| `404.html` | Página de error con la marca |

## Secciones de la página

1. **Portada** clara con velo azul: chip de origen, titular en Archivo Black
   con "a precio de bodega" en azul, lista de beneficios y doble CTA
   (WhatsApp verde + "Ver catálogo").
2. **Marquesina de marcas** con título de confianza ("Distribuimos las marcas
   que su negocio ya conoce"); estática con `prefers-reduced-motion`.
3. **Catálogo** — 10 categorías en cards blancas radio 16px con chip
   "Cotizar"; cada tarjeta abre una cotización por WhatsApp con mensaje
   precargado propio.
4. **Sectores** en cards limpias (asaderos, restaurantes, panaderías…).
5. **Línea ecológica** como sub-marca en verde suave.
6. **Nosotros** con foto de bodega y cifras animadas.
7. **Reseñas** en cards de nota — ⚠️ testimonios de muestra (ver pendientes).
8. **Preguntas frecuentes** — `details` nativos + datos `FAQPage` (el texto
   visible debe seguir siendo espejo exacto del JSON-LD).
9. **Contacto**: datos con WhatsApp, teléfono, dirección y horario, y enlace
   al mapa.

## Seguridad

- `_headers` (Netlify/Cloudflare Pages) y `.htaccess` (Apache/cPanel) con:
  CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS y caché. **Mantener ambos archivos sincronizados.**
- `<meta http-equiv="Content-Security-Policy">` en `index.html` como respaldo.
- El único script inline está autorizado por hash SHA-256 en la CSP. Si cambias
  ese script, recalcula el hash:
  `printf "NUEVO_SCRIPT" | openssl dgst -sha256 -binary | openssl base64`
  y actualízalo en `_headers`, `.htaccess` y la meta CSP.
- `.well-known/security.txt` con contacto para reportes de seguridad.

## Cumplimiento de la Front-End Checklist

Título <65 caracteres, descripción <160, favicons completos, Open Graph +
Twitter Card, `lang="es"`, un solo H1 con jerarquía correcta, HTML semántico,
`rel="noopener"` en todos los `target="_blank"`, `alt` en todas las imágenes,
enlace "saltar al contenido", `:focus-visible`, `prefers-reduced-motion`, datos
estructurados JSON-LD (negocio local + FAQ), sitemap y robots. Cero peticiones
externas, JS con `defer`, sin errores en consola. Contrastes AA verificados en
los pares principales de la paleta. Probado en escritorio y móvil.

## Historial de diseños

1. **Diseño 1** — primera versión.
2. **Diseño 2 "Cartel de plaza"** — azul noche, stickers rotados, sombras
   duras de imprenta (respaldo en `../respaldo-diseno-20260814_191840/`).
3. **Diseño 3 "Mercado de día"** (actual, ago 2026) — claro y comercial,
   basado en el lenguaje visual del sector mayorista (Darnel, Carvajal, MAHA).
   Direcciones alternativas documentadas en `../analisis-rediseno-2026/`.
