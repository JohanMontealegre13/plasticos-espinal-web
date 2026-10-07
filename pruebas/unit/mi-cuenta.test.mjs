/* Contrato del portal del cliente (plasticosespinal.com/mi-cuenta), PENDIENTE.
   Lo construye el hilo de la tienda (PR #3 web y CRM): un intermediario en Cloudflare
   (functions/mi-cuenta/) es lo único que habla con la API de datos del CRM, con una
   clave secreta compartida. Cuando entre a main, estas pruebas se escriben de verdad
   con el mismo método que candado.test.mjs (cargar el middleware y llamarlo con un
   CRM simulado). Mientras tanto quedan como «todo»: se ven en cada corrida. */
import { test } from 'node:test';

const PENDIENTE = { todo: 'llega con el PR #3 (portal del cliente)' };

test('la clave del CRM se lee de env, nunca está escrita en el repositorio ni llega al navegador', PENDIENTE);
test('el navegador nunca ve la dirección del CRM (ni en HTML, JS, cabeceras ni redirecciones)', PENDIENTE);
test('sin sesión del cliente, /mi-cuenta no consulta al CRM y pide entrar', PENDIENTE);
test('un cliente solo recibe sus propios pedidos y datos (otro documento = 403)', PENDIENTE);
test('si el CRM responde con otro formato o se cae, el portal muestra un aviso y no datos a medias', PENDIENTE);
test('las respuestas de /mi-cuenta son privadas: no-store y noindex', PENDIENTE);
test('editar datos del cliente valida en el intermediario antes de mandarlo al CRM', PENDIENTE);
