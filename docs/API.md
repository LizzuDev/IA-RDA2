# API de segmentación de clientes

La API corre en `http://127.0.0.1:8000` y su documentación interactiva está en `http://127.0.0.1:8000/docs`.

El flujo es sencillo. El archivo `ml/train.py` genera los modelos en `backend/artifacts/`, el archivo `registry.py` los
carga cuando arranca la API, `inference.py` aplica el pipeline y `main.py` define las rutas. La interfaz solo se
comunica con la API y nunca abre los archivos `.joblib` por su cuenta.

## Rutas

| Método | Ruta | Uso en la interfaz |
|---|---|---|
| GET | `/api/health` | Indicador de servicio activo |
| GET | `/api/metadata` | Construye el formulario con las variables, sus etiquetas, unidades, grupos y estadísticas. También trae los ejes del PCA y los perfiles de los segmentos |
| GET | `/api/segments` | Datos de los 4 segmentos con su nombre, color, descripción, recomendación, tamaño y promedios |
| GET | `/api/samples` | Clientes reales para los botones de ejemplo, con las claves `low`, `premium`, `deals`, `consolidated` y `noise` |
| GET | `/api/models/comparison` | Métricas de K-Means y DBSCAN, curva del codo y Silhouette en `k_search` y curva k dist en `k_dist` |
| GET | `/api/pca-points?model=kmeans` | Los 2236 puntos del mapa 2D con su cluster. También acepta `model=dbscan` |
| POST | `/api/predict` | Asigna un cliente nuevo a su segmento |

## Asignar un cliente

La ruta `POST /api/predict` recibe dos campos.

1. `features` con las 15 variables en escala original. Las que falten se completan con la mediana y las que no se
   conocen se ignoran.
2. `model_id`, que puede ser `all`, `kmeans` o `dbscan`. Con `all`, que es el valor por defecto, se usa K-Means como
   modelo principal junto con la detección de atípicos de DBSCAN. Con `dbscan`, un `cluster_id` igual a menos uno
   significa ruido.

Ejemplo de solicitud

```json
{
  "features": {
    "Income": 92533.0,
    "Age": 29.0,
    "Children": 0.0,
    "Recency": 84.0,
    "MntWines": 693.0,
    "MntFruits": 21.0,
    "MntMeatProducts": 118.0,
    "MntFishProducts": 110.0,
    "MntSweetProducts": 147.0,
    "MntGoldProds": 42.0,
    "NumDealsPurchases": 1.0,
    "NumWebPurchases": 6.0,
    "NumCatalogPurchases": 5.0,
    "NumStorePurchases": 11.0,
    "NumWebVisitsMonth": 2.0
  },
  "model_id": "all"
}
```

Respuesta real de la API, con la comparación recortada

```json
{
  "model_id": "kmeans",
  "name": "K-Means",
  "short_name": "K-Means",
  "cluster_id": 1,
  "is_noise": false,
  "segment_key": "premium",
  "segment_name": "Premium de alto gasto",
  "segment_short_name": "Premium",
  "color": "#7c3aed",
  "distance": 0.0599,
  "membership": {
    "0": 0.99,
    "1": 95.79,
    "2": 2.12,
    "3": 1.1
  },
  "description": "Clientes de ingreso alto, casi sin hijos y con el mayor gasto en vinos y carnes. Compran mucho por catálogo y en tienda, casi no usan descuentos y son los que más responden a las campañas.",
  "recommendation": "Programa VIP con catálogo de vinos, carnes y pescado, preventas exclusivas y atención personalizada, sin ofrecer descuentos.",
  "selected_model": "all",
  "primary_model": "kmeans",
  "active_model_name": "K-Means con detección de atípicos de DBSCAN",
  "pca": {
    "x": 3.6307,
    "y": -0.9075
  },
  "multi_model_summary": {
    "kmeans": {
      "model_id": "kmeans",
      "name": "K-Means",
      "short_name": "K-Means",
      "cluster_id": 1,
      "is_noise": false,
      "segment_key": "premium",
      "segment_name": "Premium de alto gasto",
      "segment_short_name": "Premium",
      "color": "#7c3aed",
      "distance": 0.0599,
      "membership": {
        "0": 0.99,
        "1": 95.79,
        "2": 2.12,
        "3": 1.1
      }
    },
    "dbscan": {
      "model_id": "dbscan",
      "name": "DBSCAN",
      "short_name": "DBSCAN",
      "cluster_id": 0,
      "is_noise": false,
      "segment_key": "dense_0",
      "segment_name": "Núcleo denso principal",
      "segment_short_name": "Núcleo",
      "color": "#22c55e",
      "distance": 0.0,
      "membership": null
    }
  },
  "outlier_check": {
    "is_outlier": false,
    "dbscan_cluster": 0,
    "distance_to_core": 0.0,
    "eps": 0.32,
    "message": "DBSCAN ubica a este cliente dentro de una zona densa de clientes."
  },
  "top_deviations": [
    {
      "feature": "MntSweetProducts",
      "label": "Gasto en dulces",
      "value": 147.0,
      "segment_mean": 74.83,
      "deviation_z": 1.75,
      "direction": "Mayor que su segmento"
    },
    {
      "feature": "MntMeatProducts",
      "label": "Gasto en carnes",
      "value": 118.0,
      "segment_mean": 495.69,
      "deviation_z": -1.67,
      "direction": "Menor que su segmento"
    },
    {
      "feature": "Age",
      "label": "Edad",
      "value": 29.0,
      "segment_mean": 44.78,
      "deviation_z": -1.35,
      "direction": "Menor que su segmento"
    },
    {
      "feature": "MntFruits",
      "label": "Gasto en frutas",
      "value": 21.0,
      "segment_mean": 71.63,
      "deviation_z": -1.27,
      "direction": "Menor que su segmento"
    },
    {
      "feature": "Recency",
      "label": "Días desde la última compra",
      "value": 84.0,
      "segment_mean": 49.78,
      "deviation_z": 1.18,
      "direction": "Mayor que su segmento"
    }
  ],
  "comparison": {
    "Income": {
      "value": 92533.0,
      "segment_mean": 77738.42,
      "global_mean": 51952.5013,
      "is_above_segment": true,
      "is_out_of_range": false
    },
    "MntWines": {
      "value": 693.0,
      "segment_mean": 602.69,
      "global_mean": 304.1275,
      "is_above_segment": true,
      "is_out_of_range": false
    },
    "...": "(15 variables)"
  },
  "out_of_range_features": []
}
```

### Campos más importantes

| Campo | Uso en la interfaz |
|---|---|
| `segment_name`, `color`, `description`, `recommendation` | Resultado principal |
| `cluster_id`, `is_noise` | Número de cluster y aviso de cliente atípico |
| `pca.x`, `pca.y` | Posición de la estrella del cliente nuevo en el mapa |
| `membership` | Afinidad en porcentaje con cada segmento, solo en K-Means |
| `outlier_check` | Alerta de cliente atípico de DBSCAN, aunque el modelo activo sea K-Means |
| `top_deviations` | Variables en las que el cliente más se aleja de su segmento |
| `comparison` | Tabla del cliente frente al promedio de su segmento y de todo el dataset |
| `out_of_range_features` | Aviso de valores fuera del rango del entrenamiento |
| `multi_model_summary` | Resultado de ambos modelos |

### Errores

La API responde con **422** cuando la solicitud no es válida, por ejemplo si falta `features`, si hay valores
negativos, valores que no son números o un `model_id` desconocido. El error siempre llega en el campo `detail` y la
interfaz muestra el texto de `detail[0].msg`.

La API responde con **503** cuando arrancó sin los modelos. En ese caso se deben generar con `python -m ml.train`.

## Cliente en JavaScript

El archivo `src/services/api.js` tiene las funciones que usa la interfaz para llamar a cada ruta. La dirección de la
API se toma de la variable `VITE_API_URL`.
