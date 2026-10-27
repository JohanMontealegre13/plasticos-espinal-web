/* Página pública: carga limpia con la CSP real de _headers, anclas y la 404. */
import { test, expect } from '@playwright/test';
import { vigilar } from './ayudas.js';

test('el inicio carga sin errores de JS, de CSP ni recursos rotos', async ({ page }) => {
  const v = vigilar(page);
  const r = await page.goto('/');
  expect(r?.status()).toBe(200);
  await expect(page.locator('h1')).toBeVisible();
  /* El script embebido corrió (si la CSP lo bloquea, la clase js no aparece) */
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  /* El JS externo corrió: pone el año en el pie */
  await expect(page.locator('#anio')).toHaveText(String(new Date().getFullYear()));
  /* La hoja de estilos cargó: la fuente de los títulos es Archivo Black */
  expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Archivo');
  await page.evaluate(() => document.fonts.ready);
  v.sinProblemas();
});

test('Regresión (e7352f9): al recargar con un #ancla la página abre arriba y sin ancla', async ({ page }) => {
  await page.goto('/#contacto');
  await page.waitForLoadState('load');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('los botones de WhatsApp llevan al número del negocio con mensaje', async ({ page }) => {
  await page.goto('/');
  const enlaces = page.locator('a[href^="https://wa.me/"]');
  expect(await enlaces.count()).toBeGreaterThan(5);
  for (const href of await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
    expect(href).toMatch(/^https:\/\/wa\.me\/573183555246\?text=/);
  }
});

test('el menú lleva a secciones que existen', async ({ page }) => {
  await page.goto('/');
  for (const href of await page.locator('.menu a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
    await expect(page.locator(String(href))).toHaveCount(1);
  }
});

test('Regresión (5275792): la 404 en una subcarpeta carga sus estilos e imágenes', async ({ page }) => {
  const v = vigilar(page);
  const r = await page.goto('/una/carpeta/que-no-existe');
  expect(r?.status()).toBe(404);
  await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible();
  expect(await page.locator('body').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Archivo');
  v.sinProblemas();
});

test('en celular el inicio no tiene desplazamiento horizontal', async ({ page }) => {
  await page.goto('/');
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});
