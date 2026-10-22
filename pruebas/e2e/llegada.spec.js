/* Hora de llegada: la franja de arriba y la canasta dicen cuándo llega según el horario
   (el congelado de SITIO_FIJO, no el de tienda/catalogo.json: ver ayudas.js). */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar } from './ayudas.js';

test('la franja y la canasta dicen la hora de llegada', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page, { hora: '2026-10-22T10:00:00-05:00' });
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega hoy antes de las 11:00 a. m.');
  await expect(page.locator('#llegada')).toBeHidden();   /* con la canasta cerrada no se ve */
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#llegada')).toHaveText('Llega hoy antes de las 11:00 a. m.');
  v.sinProblemas();
});

test('un domingo por la noche dice que llega mañana, no «en menos de 1 hora»', async ({ page }) => {
  await abrirTienda(page, { hora: '2026-10-25T21:00:00-05:00' });
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega mañana antes de las 9:00 a. m.');
});

test('la franja sigue la hora de Colombia aunque el equipo esté en otra zona', async ({ browser }) => {
  const contexto = await browser.newContext({ timezoneId: 'Asia/Tokyo' });
  const page = await contexto.newPage();
  await abrirTienda(page, { hora: '2026-10-22T10:00:00-05:00' });
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega hoy antes de las 11:00 a. m.');
  await contexto.close();
});

test('si el horario falta queda el texto de siempre', async ({ page }) => {
  await abrirTienda(page, { hora: '2026-10-22T10:00:00-05:00', sitio: (sitio) => { delete sitio.horario; } });
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Domicilio en El Espinal en menos de 1 hora');
  await page.getByRole('button', { name: 'Agregar Contenedor icopor J1 x25 und a la canasta' }).click();
  await page.locator('.btn-canasta').click();
  await expect(page.locator('#llegada')).toBeHidden();
});

test('la hora se actualiza sola cada minuto mientras la página sigue abierta', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-22T09:59:00-05:00') });
  await page.clock.pauseAt(new Date('2026-10-22T10:00:00-05:00'));
  await abrirTienda(page);
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega hoy antes de las 11:00 a. m.');
  await page.clock.runFor(30 * 60 * 1000);   /* pasan 30 minutos: ya son las 10:30 */
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega hoy antes de las 11:30 a. m.');
  await page.clock.runFor(2 * 60 * 60 * 1000 + 10 * 60 * 1000);   /* 12:40: queda el almuerzo en medio */
  await expect(page.locator('#franjaLlegada')).toHaveText('🛵 Llega hoy antes de las 3:00 p. m.');
});
