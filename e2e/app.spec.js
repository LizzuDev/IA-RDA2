import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

//Las cifras esperadas salen de los mismos archivos que genera python -m ml.train
const readArtifact = (name) =>
  JSON.parse(readFileSync(new URL(`../backend/artifacts/${name}`, import.meta.url), 'utf-8'));
const COMPARISON = readArtifact('comparison.json');
const METADATA = readArtifact('metadata.json');
const PRIMARY = COMPARISON.models.find((m) => m.id === COMPARISON.primary_model);
const SEGMENTS = Object.values(METADATA.segments).sort((a, b) => a.id - b.id);

const API = 'http://127.0.0.1:8000';

//Guarda los errores de consola y de página para comprobar que no haya ninguno
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function runAssignment(page) {
  const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/predict'));
  await page.getByRole('button', { name: 'Asignar Segmento' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.getByText('Resultado de cada modelo')).toBeVisible();
  return response.json();
}

const segmentName = (page) => page.getByTestId('segment-name');

//Estilo global

test.describe('Estilo global', () => {
  test('el fondo es cálido y los títulos usan Bricolage Grotesque', async ({ page }) => {
    await page.goto('/#landing');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(252, 249, 248)');
    const h1Font = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toContain('Bricolage Grotesque');
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toContain('Plus Jakarta Sans');
  });
});

//Landing y navegación

test.describe('Landing y navegación', () => {
  test('la landing muestra el contenido clave', async ({ page }) => {
    await page.goto('/#landing');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('cliente');
    for (const v of [String(PRIMARY.metrics.n_clusters), PRIMARY.metrics.silhouette.toFixed(3), '2,236']) {
      await expect(page.getByText(v, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Cómo funciona' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Para qué sirve' })).toBeVisible();
    for (const s of SEGMENTS) {
      await expect(page.getByText(s.name, { exact: true }).first()).toBeVisible();
    }
  });

  test('el CTA principal abre la herramienta', async ({ page }) => {
    await page.goto('/#landing');
    await page.getByRole('button', { name: 'Segmentar un cliente' }).click();
    await expect(page).toHaveURL(/#tool$/);
    await expect(page.getByRole('heading', { name: 'Perfil del cliente' })).toBeVisible();
  });

  test('el enlace secundario abre Modelos & Dataset', async ({ page }) => {
    await page.goto('/#landing');
    await page.getByRole('button', { name: 'Cómo se eligieron los modelos' }).click();
    await expect(page).toHaveURL(/#metrics$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('cómo se eligieron');
  });

  test('la barra de navegación cambia de vista y marca la activa', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav');
    for (const [label, hash] of [['Modelos & Dataset', 'metrics'], ['Inicio', 'landing'], ['Segmentar', 'tool']]) {
      await nav.getByRole('button', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      await expect(nav.getByRole('button', { name: label })).toHaveClass(/border-brand-600/);
    }
  });

  test('el logo vuelve al inicio', async ({ page }) => {
    await page.goto('/#metrics');
    await page.getByRole('button', { name: /Segmenta/ }).first().click();
    await expect(page).toHaveURL(/#landing$/);
  });

  test('un hash desconocido cae en la herramienta', async ({ page }) => {
    await page.goto('/#no-existe');
    await expect(page.getByRole('heading', { name: 'Perfil del cliente' })).toBeVisible();
  });

  test('el botón atrás del navegador funciona', async ({ page }) => {
    await page.goto('/#landing');
    await page.locator('header nav').getByRole('button', { name: 'Modelos & Dataset' }).click();
    await expect(page).toHaveURL(/#metrics$/);
    await page.goBack();
    await expect(page).toHaveURL(/#landing$/);
    await expect(page.getByRole('heading', { name: 'Cómo funciona' })).toBeVisible();
  });

  test('el indicador muestra el servicio activo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Servicio activo')).toBeVisible({ timeout: 15_000 });
  });

  test('ninguna vista genera errores en consola', async ({ page }) => {
    const errors = trackErrors(page);
    for (const hash of ['landing', 'tool', 'metrics']) {
      await page.goto(`/#${hash}`);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });
});

//Herramienta de segmentación

test.describe('Herramienta de segmentación', () => {
  test.beforeEach(async ({ page }) => {
    //La espera se registra antes de navegar porque la respuesta podría llegar antes y no detectarse
    const samplesLoaded = page.waitForResponse((r) => r.url().endsWith('/api/samples'));
    await page.goto('/#tool');
    await samplesLoaded;
  });

  test('estado inicial con medianas y sin resultado', async ({ page }) => {
    await expect(page.getByText('Valores medianos')).toBeVisible();
    await expect(page.getByText('Esperando Ejecución')).toBeVisible();
    await expect(page.locator('#Income')).toHaveValue(String(METADATA.feature_stats.Income.median));
    await expect(page.locator('[role="tabpanel"] input[type="number"]')).toHaveCount(METADATA.features.length);
    await expect(page.locator('[role="tabpanel"] input[type="range"]')).toHaveCount(METADATA.features.length);
  });

  for (const [button, key] of [['Ahorrador', 'low'], ['Premium', 'premium'], ['Ofertas', 'deals'], ['Consolidado', 'consolidated']]) {
    test(`el cliente "${button}" se asigna a su segmento`, async ({ page }) => {
      await page.getByRole('button', { name: button, exact: true }).click();
      const body = await runAssignment(page);
      expect(body.segment_key).toBe(key);
      await expect(segmentName(page)).toHaveText(body.segment_name);
      await expect(page.getByTestId('pca-star')).toBeVisible();
    });
  }

  test('el cliente atípico activa la alerta de DBSCAN', async ({ page }) => {
    await page.getByRole('button', { name: 'Atípico', exact: true }).click();
    const body = await runAssignment(page);
    expect(body.outlier_check.is_outlier).toBe(true);
    await expect(page.getByText('Cliente atípico', { exact: true })).toBeVisible();
  });

  test('cargar una muestra rellena los campos con sus valores reales', async ({ page, request }) => {
    const samples = await (await request.get(`${API}/api/samples`)).json();
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    await expect(page.getByText('Cliente premium')).toBeVisible();
    await expect(page.locator('#Income')).toHaveValue(String(samples.premium[0].features.Income));
  });

  test('el resultado muestra afinidad, desviaciones y la tabla comparativa', async ({ page }) => {
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    const body = await runAssignment(page);
    await expect(page.getByText('Afinidad con cada segmento (K-Means)')).toBeVisible();
    await expect(page.getByText('Variables en las que más se aleja de su segmento')).toBeVisible();
    await expect(page.getByText(`${body.membership[String(body.cluster_id)].toFixed(1)}%`, { exact: true })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(METADATA.features.length);
  });

  test('editar un valor marca el cliente como personalizado y se envía', async ({ page }) => {
    await page.locator('#Income').fill('120000');
    await expect(page.getByText('Personalizado')).toBeVisible();
    const requestPromise = page.waitForRequest((r) => r.url().endsWith('/api/predict'));
    await page.getByRole('button', { name: 'Asignar Segmento' }).click();
    const sent = JSON.parse((await requestPromise).postData());
    expect(sent.features.Income).toBe(120000);
    expect(Object.keys(sent.features)).toHaveLength(METADATA.features.length);
  });

  test('las pestañas muestran un grupo de variables a la vez', async ({ page }) => {
    await expect(page.locator('#Income')).toBeVisible();
    await expect(page.locator('#MntWines')).toBeHidden();
    await page.getByRole('tab', { name: 'Gasto' }).click();
    await expect(page.locator('#MntWines')).toBeVisible();
    await expect(page.locator('#Income')).toBeHidden();
    await page.getByRole('tab', { name: 'Canales' }).click();
    await expect(page.locator('#NumWebPurchases')).toBeVisible();
  });

  test('la persona cambia con las variables', async ({ page }) => {
    const persona = page.getByRole('img', { name: /Ilustración del cliente/ });
    await page.locator('#Age').fill('70');
    await page.locator('#Children').fill('3');
    await expect(persona).toHaveAttribute('aria-label', /70 años con 3 hijos/);
    await page.locator('#Income').fill('120000');
    await expect(page.getByText('Alto poder adquisitivo')).toBeVisible();
  });

  test('los botones de menos y más ajustan el valor', async ({ page }) => {
    await page.getByRole('button', { name: 'Aumentar Ingreso anual' }).click();
    await expect(page.locator('#Income')).toHaveValue('52000');
    await page.getByRole('button', { name: 'Disminuir Hijos en casa' }).click();
    await expect(page.locator('#Children')).toHaveValue('0');
    await page.getByRole('button', { name: 'Disminuir Hijos en casa' }).click();
    await expect(page.locator('#Children')).toHaveValue('0');
  });

  test('los canales se ajustan junto a la persona', async ({ page }) => {
    await page.getByRole('button', { name: 'Aumentar Web' }).click();
    await expect(page.locator('#NumWebPurchases')).toHaveValue(String(METADATA.feature_stats.NumWebPurchases.median + 1));
  });

  test('el slider actualiza el campo numérico', async ({ page }) => {
    await page.getByLabel('Edad (control deslizante)').fill('60');
    await expect(page.locator('#Age')).toHaveValue('60');
  });

  for (const value of ['kmeans', 'dbscan', 'all']) {
    test(`el selector de modelo envía model_id=${value}`, async ({ page }) => {
      await page.getByLabel('Modelo', { exact: true }).selectOption(value);
      const requestPromise = page.waitForRequest((r) => r.url().endsWith('/api/predict'));
      await page.getByRole('button', { name: 'Asignar Segmento' }).click();
      expect(JSON.parse((await requestPromise).postData()).model_id).toBe(value);
      await expect(page.getByText('Resultado de cada modelo')).toBeVisible();
    });
  }

  test('el mapa cambia entre K-Means y DBSCAN', async ({ page }) => {
    const map = page.getByRole('img', { name: /Mapa PCA de 2236 clientes/ });
    await expect(map).toHaveAttribute('aria-label', /segmento de K-Means/);
    await page.getByRole('button', { name: 'DBSCAN', exact: true }).click();
    await expect(map).toHaveAttribute('aria-label', /cluster de DBSCAN/);
    await expect(map.locator('circle')).toHaveCount(2236);
  });

  test('restablecer limpia el resultado y los valores', async ({ page }) => {
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    await runAssignment(page);
    await page.getByRole('button', { name: 'Restablecer valores' }).click();
    await expect(page.getByText('Esperando Ejecución')).toBeVisible();
    await expect(page.getByText('Valores medianos')).toBeVisible();
    await expect(page.locator('#Income')).toHaveValue(String(METADATA.feature_stats.Income.median));
  });

  test('editar después de asignar marca el resultado como viejo y recalcula', async ({ page }) => {
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    await runAssignment(page);
    await page.locator('#Income').fill('20730');
    await expect(page.getByText('Este resultado corresponde al perfil anterior')).toBeVisible();
    await expect(page.getByText('sin recalcular')).toBeVisible();
    const body = await runAssignment(page);
    expect(body.segment_key).toBe('premium');
    await expect(page.getByText('Este resultado corresponde al perfil anterior')).toBeHidden();
    await expect(page.locator('aside')).toContainText(`${body.membership[String(body.cluster_id)].toFixed(1)}% de afinidad`);
  });

  test('cambiar el modelo también pide recalcular y oculta la estrella', async ({ page }) => {
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    await runAssignment(page);
    await expect(page.getByTestId('pca-star')).toBeVisible();
    await page.getByLabel('Modelo', { exact: true }).selectOption('dbscan');
    await expect(page.getByText('Este resultado corresponde al perfil anterior')).toBeVisible();
    await expect(page.getByTestId('pca-star')).toHaveCount(0);
    const body = await runAssignment(page);
    expect(body.model_id).toBe('dbscan');
    await expect(segmentName(page)).toHaveText(body.segment_name);
    await expect(page.locator('aside')).not.toContainText('de afinidad');
  });

  test('cambiar de muestra borra el resultado anterior', async ({ page }) => {
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    await runAssignment(page);
    await page.getByRole('button', { name: 'Ahorrador', exact: true }).click();
    await expect(page.getByText('Esperando Ejecución')).toBeVisible();
  });

  test('un error de validación de la API se muestra al usuario', async ({ page }) => {
    await page.route('**/api/predict', (route) =>
      route.fulfill({ status: 422, contentType: 'application/json',
        body: JSON.stringify({ detail: [{ loc: ['body'], msg: 'No se permiten valores negativos en Income', type: 'value_error' }] }) }));
    await page.getByRole('button', { name: 'Asignar Segmento' }).click();
    await expect(page.getByText('No se permiten valores negativos en Income')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Asignar Segmento' })).toBeEnabled();
  });

  test('el botón se deshabilita mientras calcula', async ({ page }) => {
    await page.route('**/api/predict', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Asignar Segmento' }).click();
    await expect(page.getByRole('button', { name: 'Asignando segmento...' })).toBeDisabled();
    await expect(page.getByText('Resultado de cada modelo')).toBeVisible();
  });
});

//Modelos & Dataset

test.describe('Modelos & Dataset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#metrics');
  });

  test('muestra el dataset y las variables', async ({ page }) => {
    await expect(page.getByText('2,236', { exact: true })).toBeVisible();
    await expect(page.getByText(`Las ${METADATA.features.length} variables`)).toBeVisible();
    await expect(page.getByText('Gasto en vinos', { exact: true })).toBeVisible();
  });

  test('la tabla refleja los datos de la API', async ({ page, request }) => {
    const api = await (await request.get(`${API}/api/models/comparison`)).json();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(api.models.length);
    for (const [i, m] of api.models.entries()) {
      const row = rows.nth(i);
      await expect(row).toContainText(m.name);
      await expect(row).toContainText(m.metrics.silhouette.toFixed(3));
      await expect(row).toContainText(`${m.metrics.noise_pct.toFixed(2)}%`);
      await expect(row).toContainText(m.is_recommended ? 'Modelo principal' : 'Detección de atípicos');
    }
  });

  test('K-Means está seleccionado y muestra la curva del codo', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'K-Means', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: 'Curva del codo con la inercia por K' }).locator('circle'))
      .toHaveCount(COMPARISON.k_search.length);
    await expect(page.getByRole('img', { name: 'Silhouette por K' })).toBeVisible();
  });

  test('seleccionar DBSCAN muestra el gráfico k-distancia y sus clusters', async ({ page }) => {
    await page.getByRole('button', { name: 'DBSCAN', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'DBSCAN' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Gráfico de distancia k' })).toBeVisible();
    await expect(page.getByText(`eps = ${COMPARISON.k_dist.eps}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Núcleo denso principal').first()).toBeVisible();
  });
});

//Sin backend, en modo local

test.describe('Sin backend', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API}/**`, (route) => route.abort('connectionrefused'));
  });

  test('el indicador pasa a modo local', async ({ page }) => {
    await page.goto('/#landing');
    await expect(page.getByText('Modo local')).toBeVisible();
  });

  test('Modelos & Dataset usa los datos precomputados', async ({ page }) => {
    await page.goto('/#metrics');
    await expect(page.locator('tbody tr')).toHaveCount(COMPARISON.models.length);
    await expect(page.locator('tbody tr').first()).toContainText(PRIMARY.metrics.silhouette.toFixed(3));
  });

  test('el formulario se construye y los ejemplos se deshabilitan', async ({ page }) => {
    await page.goto('/#tool');
    await expect(page.locator('[role="tabpanel"] input[type="number"]')).toHaveCount(METADATA.features.length);
    await expect(page.getByRole('button', { name: 'Premium', exact: true })).toBeDisabled();
  });

  test('la asignación informa del error de conexión', async ({ page }) => {
    await page.goto('/#tool');
    await page.getByRole('button', { name: 'Asignar Segmento' }).click();
    await expect(page.getByText('No se pudo conectar con el servicio de segmentación')).toBeVisible();
  });
});

//Móvil

test.describe('Móvil @mobile', () => {
  test('el menú móvil abre y navega @mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil');
    await page.goto('/#landing');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.locator('header').getByRole('button', { name: 'Modelos & Dataset' }).last().click();
    await expect(page).toHaveURL(/#metrics$/);
  });

  for (const hash of ['landing', 'tool', 'metrics']) {
    test(`sin scroll horizontal en #${hash} @mobile`, async ({ page }) => {
      await page.goto(`/#${hash}`);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('una asignación completa funciona en móvil @mobile', async ({ page }) => {
    const samplesLoaded = page.waitForResponse((r) => r.url().endsWith('/api/samples'));
    await page.goto('/#tool');
    await samplesLoaded;
    await page.getByRole('button', { name: 'Premium', exact: true }).click();
    const body = await runAssignment(page);
    expect(body.segment_key).toBe('premium');
  });
});
