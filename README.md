# Segmenta AI, segmentación de clientes con K-Means y DBSCAN

Proyecto 2 de Inteligencia Artificial. La aplicación asigna clientes nuevos a segmentos de marketing usando el dataset
[Customer Personality Analysis](https://www.kaggle.com/datasets/imakash3011/customer-personality-analysis) de Kaggle.
El backend es una API hecha con **FastAPI** y la interfaz está hecha con **React**.

Integrantes Joselyn Cadena y Gabriel Aguinaga.

## Estructura

```
data/marketing_campaign.csv          dataset original
ml/                                  limpieza, entrenamiento y notebook del proyecto
  notebooks/                         notebook con todo el proceso documentado
  train.py                           genera los modelos con python -m ml.train
backend/artifacts/                   archivos que genera el entrenamiento
  models/kmeans/pipeline.joblib      StandardScaler, PCA con 2 componentes y KMeans con 4 grupos
  models/dbscan/pipeline.joblib      el mismo proceso con DBSCAN y NearestNeighbors sobre los puntos core
  comparison.json                    métricas de ambos modelos, codo, Silhouette y k dist
  metadata.json                      variables, etiquetas, estadísticas, PCA y segmentos
  samples.json                       clientes reales de ejemplo
  pca_points.json                    puntos del mapa en 2D
backend/app/                         API
  config.py                          variables de entorno
  registry.py                        carga los modelos al arrancar
  schemas.py                         formatos de entrada y salida
  inference.py                       preprocesamiento, asignación y explicación del resultado
  main.py                            rutas de la API
src/                                 interfaz web en React
e2e/                                 pruebas de la interfaz
docs/                                documentación de la API
```

## Cómo ejecutar el backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements-dev.txt
cd backend
uvicorn app.main:app --reload --port 8000
```

En Linux o Mac el entorno se activa con `source venv/bin/activate`. Los modelos ya vienen incluidos y, si se quieren
generar otra vez, se usa `python -m ml.train` desde la raíz.

La API queda en <http://127.0.0.1:8000/api/health> y su documentación en <http://127.0.0.1:8000/docs>. También existe
un prototipo sencillo en <http://127.0.0.1:8000/demo/>.

Las pruebas del backend se ejecutan desde la raíz con `pytest` y son 38 en total.

## Cómo ejecutar la interfaz

Se necesita Node 18 o superior. En otra terminal, desde la raíz

```bash
npm ci
npm run dev
```

La interfaz se abre en <http://localhost:3000> y necesita que la API esté corriendo en el puerto 8000. Si la API usa
otra dirección, se crea un archivo `.env` con `VITE_API_URL`, como se muestra en `.env.example`.

La interfaz tiene tres vistas.

1. **Inicio** explica para qué sirve la segmentación y muestra los 4 segmentos con su campaña sugerida.
2. **Segmentar** tiene el formulario con las 15 variables en escala original, clientes reales de ejemplo y el botón
   *Asignar Segmento*. El resultado muestra el número y nombre del segmento, la estrategia recomendada, la alerta de
   cliente atípico de DBSCAN y el mapa PCA con el cliente nuevo resaltado.
3. **Modelos & Dataset** compara K-Means con DBSCAN y muestra el codo, el Silhouette, la curva k dist y el tamaño de
   cada cluster.

Si la API no responde, la interfaz muestra las métricas que vienen incluidas, pero no puede asignar clientes.

Las pruebas de la interfaz levantan la API y el front por su cuenta y usan el Chrome o Edge instalado.

```bash
npm run test:e2e
```

## Notebook

El notebook `ml/notebooks/Proyecto2_Clustering_CustomerPersonality.ipynb` documenta el EDA, la preparación de los
datos, PCA, la elección de K, el k dist graph, la comparación de modelos y la interpretación de los segmentos. Para
ejecutarlo se instalan las dependencias con `pip install -r ml/requirements.txt`. Se puede abrir desde su carpeta o
desde la raíz, porque busca solo la carpeta `data` y guarda sus modelos en `models`.

El archivo `ml/train.py` repite el mismo proceso y llega a los mismos resultados, con un Silhouette de 0.465 en K-Means y
un 2.64 % de ruido en DBSCAN.

## Documentación

La descripción de cada ruta de la API, con ejemplos, está en [`docs/API.md`](docs/API.md).
