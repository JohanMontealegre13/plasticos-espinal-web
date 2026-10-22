/* Servidor local que imita a Cloudflare Pages para las pruebas en navegador:
   sirve la carpeta del sitio, aplica _headers tal cual (así una CSP mal puesta
   rompe la prueba igual que rompería producción) y responde 404.html con 404.
   La tienda se sirve SIN el candado: el candado tiene sus propias pruebas. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { RAIZ, archivoDe, cabecerasPara, leerHeaders } from './lib.mjs';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const PUERTO = Number(process.env.PUERTO || 4173);
const reglas = leerHeaders();

createServer((req, res) => {
  const ruta = new URL(req.url || '/', 'http://x').pathname;
  let archivo = ruta.startsWith('/pruebas/') || ruta.startsWith('/functions/') ? null : archivoDe(ruta);
  let estado = 200;
  if (!archivo) { archivo = '404.html'; estado = 404; }
  const cabeceras = { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', ...cabecerasPara(ruta, reglas) };
  /* HSTS y upgrade-insecure-requests no aplican en http://localhost */
  delete cabeceras['Strict-Transport-Security'];
  if (cabeceras['Content-Security-Policy']) cabeceras['Content-Security-Policy'] = cabeceras['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  res.writeHead(estado, cabeceras);
  res.end(readFileSync(join(RAIZ, archivo)));
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sitio de prueba en http://127.0.0.1:${PUERTO}`));
