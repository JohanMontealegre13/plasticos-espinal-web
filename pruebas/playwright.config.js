// Pruebas en navegador (Chromium) contra un servidor local que imita a Cloudflare Pages.
import { defineConfig, devices } from '@playwright/test';

const PUERTO = Number(process.env.PUERTO || 4173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,   // una prueba que falla a ratos es un error que hay que arreglar, no repetir
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PUERTO}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node servidor.mjs', url: `http://127.0.0.1:${PUERTO}/`, reuseExistingServer: !process.env.CI },
});
