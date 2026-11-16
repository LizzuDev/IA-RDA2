//Convierte una proporción entre 0 y 1 en porcentaje
export const pct = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;

//Da formato a un valor que ya viene en porcentaje, como los que envía la API
export const pctValue = (value, digits = 1) => `${Number(value).toFixed(digits)}%`;

//Número con separador de miles y punto decimal, igual que toFixed en el resto de la interfaz
export const num = (value, digits = 0) =>
  Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });

//Devuelve el modelo principal de la comparación generada en el entrenamiento
export const primaryModel = (comparison) =>
  comparison.models.find((m) => m.id === comparison.primary_model) ?? comparison.models[0];

//Lista de segmentos de K-Means ordenada por número de cluster
export const segmentList = (metadata) =>
  Object.values(metadata.segments).sort((a, b) => a.id - b.id);

//Valores iniciales del formulario, que corresponden a la mediana de cada variable
export const medianFeatures = (metadata) =>
  Object.fromEntries(metadata.features.map((f) => [f, metadata.feature_stats[f].median]));

//Agrupa las variables igual que en el formulario (perfil, gasto y canales)
export const featureGroups = (metadata) => {
  const groups = [];
  for (const key of metadata.features) {
    const { group } = metadata.feature_info[key];
    let entry = groups.find((g) => g.group === group);
    if (!entry) {
      entry = { group, features: [] };
      groups.push(entry);
    }
    entry.features.push(key);
  }
  return groups;
};

//Colores de DBSCAN para el núcleo principal, los grupos pequeños y el ruido, iguales a los de la API
export const DBSCAN_COLORS = { main: '#22c55e', micro: '#a855f7', noise: '#ef4444' };

//Color de un cluster según el modelo elegido
export function clusterColor(model, cluster, metadata) {
  if (model === 'kmeans') return metadata.segments[String(cluster)]?.color ?? '#9ca3af';
  if (cluster === -1) return DBSCAN_COLORS.noise;
  return cluster === 0 ? DBSCAN_COLORS.main : DBSCAN_COLORS.micro;
}
