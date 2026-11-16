//Cliente de la API de segmentación para el prototipo
//Es igual al de src/services/api.js y toma la dirección de VITE_API_URL si existe
const API_BASE_URL = (
  import.meta.env?.VITE_API_URL ||
  (typeof location !== 'undefined' && location.port === '8000' ? location.origin : 'http://127.0.0.1:8000')
).replace(/\/$/, '');

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

//Variables con sus etiquetas, estadísticas, PCA y segmentos
export async function fetchMetadata() {
  return getJson('/api/metadata');
}

//Segmentos de negocio ordenados por número de cluster
export async function fetchSegments() {
  return getJson('/api/segments');
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

//Métricas de K-Means y DBSCAN, búsqueda de K y curva k dist
export async function fetchModelsComparison() {
  return getJson('/api/models/comparison');
}

//Puntos del mapa PCA en 2D para kmeans o dbscan
export async function fetchPcaPoints(model = 'kmeans') {
  return getJson(`/api/pca-points?model=${model}`);
}

//Asigna un cliente nuevo a su segmento con las 15 variables en escala original
//modelId puede ser all, kmeans o dbscan
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
