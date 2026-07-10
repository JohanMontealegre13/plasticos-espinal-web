# Sitio web público — Plásticos Espinal

Página de presentación del negocio (una sola página, HTML/CSS/JS puro, sin
dependencias externas). Diseño 2: **"cartel de plaza"** — lienzo azul noche,
tipografía de afiche (Archivo Black), stickers rotados, cintas tricolor,
boletos troquelados y fotos-lámina. La fiesta del San Pedro llevada a sistema
gráfico. Verificada con la
[Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist).

## Dónde vive

```
Plásticos Espinal/          (carpeta principal en el Escritorio)
├── CMR/                    → el CRM (Flask); ver su propio CLAUDE.md
└── Pagina Web/             → este sitio
```

## Ver el sitio en el computador

```bash
python3 -m http.server 5500 --directory "/Users/johanmontealegrep/Desktop/Plásticos Espinal/Pagina Web"
```

Luego abre <http://localhost:5500/>.

## ✏️ Datos que DEBES cambiar antes de publicar

1. **Número de WhatsApp** — ahora es un número de ejemplo (`573001234567`, en 6
   botones). Cámbialo por el tuyo real (con 57 y sin espacios):

   ```bash
   cd "/Users/johanmontealegrep/Desktop/Plásticos Espinal/Pagina Web"
   sed -i '' 's/573001234567/573XXXXXXXXX/g' index.html
   sed -i '' 's/+57 300 123 4567/+57 3XX XXX XXXX/g' index.html
   ```

2. **Dirección, horario y demás datos de Google Maps** — en `index.html`,
   sección de Contacto (busca `dato-pendiente`), reemplaza "El Espinal, Tolima"
   por tu dirección exacta y ajusta el horario. Actualiza también esos datos en
   el bloque `application/ld+json` (SEO) y en la barra superior.

3. **Mapa real** — el recuadro del mapa es un enlace con diseño propio. Cuando
   tengas tu ficha en Google Maps: en Maps → **Compartir → Insertar un mapa**,
   copia el `<iframe …></iframe>` y reemplaza todo el bloque
   `<a class="contacto-mapa">…</a>` por ese iframe. (El comentario en el HTML lo
   indica.) Si quieres, pásame el enlace de tu ficha y lo dejo embebido.

4. **Dominio** — al comprar tu dominio:

   ```bash
   sed -i '' 's/www.plasticosespinal.com/TU-DOMINIO.com/g' index.html robots.txt sitemap.xml
   ```

## Estructura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (hero, marcas, catálogo, sectores, línea ecológica, nosotros, contacto) |
| `css/estilos.css` | Todos los estilos (paleta del logo: azul, rojo, amarillo + verde para la línea eco) |
| `js/principal.js` | JS mínimo con `defer`; el sitio funciona sin JavaScript |
| `img/` | Logo optimizado (2 tamaños), favicons, iconos y `og-image.jpg` |
| `favicon.ico`, `site.webmanifest` | Iconos del navegador y de "agregar a pantalla de inicio" |
| `robots.txt`, `sitemap.xml` | Para Google |
| `404.html` | Página de error con la marca |

## Secciones de la página

1. **Portada** azul noche: titular de afiche, sticker de origen, boletas con
   datos de confianza y logo en lámina rotada.
2. **Marquesina de marcas**: letrero rodante de tipografía en contorno
   (estático con `prefers-reduced-motion`).
3. **Catálogo** — 10 categorías con foto, cinta tricolor y tag "Cotizar";
   cada tarjeta abre una cotización por WhatsApp.
4. **Sectores** como boletos troquelados sobre azul.
5. **Línea ecológica** en verde profundo con borde de papel picado.
6. **Nosotros** con foto-lámina de bodega y sellos con cifras.
7. **Reseñas** como notas pegadas con cinta + foto polaroid — ⚠️ son
   testimonios de muestra: reemplazar por reseñas reales (con permiso del
   cliente) o por las de Google Business Profile.
8. **Preguntas frecuentes** — boletas desplegables nativas + datos `FAQPage`.
9. **Contacto**: cierre de cartel oscuro con datos en chips troquelados.

## Seguridad

- `_headers` (Netlify/Cloudflare Pages) y `.htaccess` (Apache/cPanel) con:
  CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS y caché. **Mantener ambos archivos sincronizados.**
- `<meta http-equiv="Content-Security-Policy">` en `index.html` como respaldo.
- El único script inline está autorizado por hash SHA-256 en la CSP. Si cambias
  ese script (`document.documentElement.classList.add('js');`), recalcula el hash:
  `printf "NUEVO_SCRIPT" | openssl dgst -sha256 -binary | openssl base64`
  y actualízalo en `_headers`, `.htaccess` y la meta CSP.
- `.well-known/security.txt` con contacto para reportes de seguridad.

## Cumplimiento de la Front-End Checklist

Título <65 caracteres, descripción <160, favicons completos, Open Graph +
Twitter Card, `lang="es"`, un solo H1 con jerarquía correcta, HTML semántico,
`rel="noopener"` en todos los `target="_blank"`, `alt` en todas las imágenes,
enlace "saltar al contenido", `:focus-visible`, `prefers-reduced-motion`, datos
estructurados JSON-LD (negocio local), sitemap y robots. Peso total ~125 KB,
cero peticiones externas, JS con `defer`, sin errores en consola. Probado en
escritorio y móvil (375 px).

**Pendiente al desplegar (depende del servidor):** HTTPS, compresión
gzip/brotli y cabeceras de caché/seguridad. Cloudflare Pages o Netlify los
aplican solos: se arrastra la carpeta `Pagina Web` y queda en línea con HTTPS.
