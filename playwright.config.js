import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

//Pruebas de extremo a extremo que levantan el backend con FastAPI y el frontend con Vite
//Por defecto usan el Python del venv y con la variable PYTHON se puede usar otro
//Ejemplo PYTHON=python npm run test:e2e
const venvPython = process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python';
const python = process.env.PYTHON || (existsSync(venvPython) ? `../${venvPython}` : 'python');
//Se usa el navegador de PW_CHROMIUM_PATH o el Chrome o Edge instalado, así no hace falta descargar Chromium
const INSTALLED_BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const chromiumPath = process.env.PW_CHROMIUM_PATH || INSTALLED_BROWSERS.find((p) => existsSync(p));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port 8000`,
      cwd: './backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
