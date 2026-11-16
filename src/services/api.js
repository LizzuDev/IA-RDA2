//Cliente de la API de segmentación hecha con FastAPI
//La dirección de la API se configura con VITE_API_URL, como se indica en .env.example
import comparisonArtifact from '../../backend/artifacts/comparison.json';
import metadataArtifact from '../../backend/artifacts/metadata.json';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

//Métricas y datos del entrenamiento incluidos en el build
//Con ellos la interfaz muestra cifras reales y el formulario aunque la API no responda
export const MODEL_COMPARISON = comparisonArtifact;
export const METADATA = metadataArtifact;

async function getJson(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Error ${res.status} en ${path}`);
  return res.json();
}

//Estado del servicio, si la API no responde se devuelve status offline
export async function checkApiHealth() {
  try {
    return await getJson('/api/health');
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

//Variables con su etiqueta, unidad y grupo, junto con estadísticas, PCA y segmentos
export async function fetchMetadata() {
  try {
    return await getJson('/api/metadata');
  } catch (err) {
    console.warn('La API de metadatos no está disponible. Se usan los datos incluidos en el build.', err);
    return METADATA;
  }
}

//Clientes reales de ejemplo para cada segmento y uno atípico
export async function fetchSamples() {
  try {
    return await getJson('/api/samples');
  } catch (err) {
    console.warn('La API de muestras no está disponible.', err);
    return null;
  }
}

//Métricas de K-Means y DBSCAN, búsqueda de K con codo y Silhouette, y curva k dist
export async function fetchModelsComparison() {
  try {
    return await getJson('/api/models/comparison');
  } catch (err) {
    console.warn('La API de comparación no está disponible. Se usan las métricas incluidas en el build.', err);
    return MODEL_COMPARISON;
  }
}

const pcaCache = new Map();

//Puntos del mapa PCA en 2D para kmeans o dbscan, devuelve null si la API no responde
export async function fetchPcaPoints(model = 'kmeans') {
  if (pcaCache.has(model)) return pcaCache.get(model);
  try {
    const points = await getJson(`/api/pca-points?model=${model}`);
    pcaCache.set(model, points);
    return points;
  } catch (err) {
    console.warn('La API de puntos PCA no está disponible.', err);
    return null;
  }
}

//Asigna un cliente nuevo a su segmento
//features lleva las 15 variables en escala original y las que falten se completan con la mediana
//modelId puede ser all (K-Means con detección de atípicos), kmeans o dbscan
export async function predictSegment(features, modelId = 'all') {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, model_id: modelId }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servicio de segmentación. Se debe verificar que la API esté en ejecución.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const detail = Array.isArray(errorData.detail) ? errorData.detail[0]?.msg : errorData.detail;
    throw new Error(detail || 'Ocurrió un error en el servidor de segmentación.');
  }
  return res.json();
}
