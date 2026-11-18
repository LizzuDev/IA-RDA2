# Guía de estudio, Segmenta AI (K-Means + DBSCAN)

Todo lo de aquí sale de tu código (`ml/`, notebook, `backend/`, `src/`). Los números son los reales del proyecto.
Cada sección tiene tres capas: **🧒 Como si tuvieras 5 años**, **🎓 Versión técnica** y **❓ Pregunta de examen**.

---

## 0. Plan para una sola noche (≈ 3 h 30 min)

| Tiempo | Qué hacer |
|---|---|
| 20 min | Leer la sección 1 y 2 (la historia completa y el pipeline). Si entiendes esto, entiendes el 70 % |
| 30 min | Secciones 3 y 4 (datos y limpieza, PCA) |
| 40 min | Secciones 5 y 6 (K-Means, DBSCAN, **calibración**) |
| 20 min | Sección 7 (por qué K-Means ganó) y 8 (los 4 segmentos) |
| 30 min | Sección 9 (cada gráfica) abriendo el notebook al lado |
| 20 min | Sección 10 y 11 (código y app) |
| 30 min | Sección 12 (preguntas de examen) **tapando las respuestas** y contestando en voz alta |
| 10 min | Sección 13 (hoja de trucos) y a dormir |

Truco: explícale el proyecto en voz alta a alguien (o a la pared) usando solo la sección 1. Si te trabas, vuelve a leer.

---

## 1. La historia completa en 60 segundos

🧒 **Imagina una tienda con 2236 clientes.** No sabemos quién es quién. Queremos ponerlos en "grupitos" de gente parecida
para mandarles el anuncio correcto (al rico, vinos caros; a la familia, ofertas 2x1).
Nadie nos dijo cuál es el grupo correcto, por eso es **aprendizaje NO supervisado** (no hay columna "respuesta", no hay y).

Pasos:
1. **Limpiamos** los datos (quitamos 4 errores, rellenamos ingresos que faltaban).
2. **Igualamos las escalas** (`StandardScaler`): el ingreso va en miles y las compras en unidades; sin esto el ingreso "gritaría" más fuerte.
3. **Resumimos** 15 variables en 2 ejes (`PCA`): "¿cuánto gasta?" (PC1) y "¿familia que busca ofertas?" (PC2).
4. **Agrupamos** con dos algoritmos: `K-Means` (reparte en K grupos) y `DBSCAN` (busca zonas apretadas de gente).
5. **Calibramos** (elegimos K, eps, min_samples) con el codo, el Silhouette y el k-dist graph.
6. **Comparamos** y ganó K-Means con K=4 (Silhouette 0.465). DBSCAN metió al 95 % en un solo grupo, pero sirve para detectar **atípicos**.
7. **Nombramos** los 4 grupos mirando sus promedios.
8. **Guardamos** todo en un `Pipeline` (joblib) y una **API FastAPI** + **web React** asignan clientes nuevos.

```
CSV → limpiar → [StandardScaler → PCA(2) → KMeans(4)]  → segmento
                 └──────── un solo Pipeline ─────────┘
                                   └→ DBSCAN (solo para marcar atípicos)
```

---

## 2. El pipeline (la palabra clave del examen)

🧒 Un `Pipeline` es una **línea de montaje**: el cliente entra crudo, pasa por la máquina 1 (escalar), luego la 2 (PCA), luego la 3 (modelo), y sale con su etiqueta.

🎓 En `ml/train.py`:

```python
Pipeline([("scaler", StandardScaler()),
          ("pca", PCA(n_components=2, random_state=42)),
          ("model", KMeans(n_clusters=4, n_init=10, random_state=42))])
```

**Por qué usar Pipeline (memoriza estas 3):**
1. **Mismo preprocesamiento** en entrenamiento y en producción: la API hace `pipeline[:-1].transform(cliente)` y obtiene exactamente el mismo escalado y PCA.
2. **Evita fuga de datos**: el scaler y el PCA aprenden (`fit`) solo de los datos de entrenamiento.
3. **Un solo archivo** (`pipeline.joblib`) que se carga y se usa.

`pipeline[:-1]` = "todo el pipeline menos el último paso" (solo scaler + PCA, sin el modelo) → te da las coordenadas PC1, PC2.

**¿Por qué entrenar con el 100 % de los datos y sin train/test?** En clustering no hay etiqueta real contra la cual evaluar; no hay "respuesta correcta" que predecir. Se evalúa con métricas **internas** (Silhouette, inercia).

❓ *¿Qué diferencia hay entre `fit`, `transform` y `predict`?* `fit` aprende parámetros (media/desv., componentes, centroides), `transform` aplica lo aprendido, `predict` asigna cluster a datos nuevos (K-Means sí tiene; DBSCAN **no**, por eso se hizo la regla del core más cercano).

---

## 3. Datos y limpieza

**Dataset:** Customer Personality Analysis (Kaggle). 2240 filas × 29 columnas. Cadena de supermercados, 2 años de compras.

### Las 15 variables que SÍ entran al modelo (`config.FEATURES`)
| Grupo | Variables | Significado |
|---|---|---|
| Perfil | `Income`, `Age`, `Children`, `Recency` | ingreso anual, edad, hijos en casa, días desde la última compra |
| Gasto (`Mnt`) | `MntWines`, `Fruits`, `MeatProducts`, `FishProducts`, `SweetProducts`, `GoldProds` | $ gastado en 2 años por categoría |
| Canales (`Num`) | `NumDealsPurchases`, `NumWebPurchases`, `NumCatalogPurchases`, `NumStorePurchases`, `NumWebVisitsMonth` | cuántas compras con descuento / web / catálogo / tienda y visitas web al mes |

### Las que NO entran (y por qué) — pregunta clásica
| Variable | Razón |
|---|---|
| `ID`, `Z_CostContact`, `Z_Revenue` | identificador y dos constantes (1 solo valor) → cero información |
| `Education`, `Marital_Status` | categóricas de texto (el proyecto pide numéricas) |
| `Dt_Customer` | fecha de alta, no describe comportamiento de compra |
| `AcceptedCmp1-5`, `Response`, `Complain` | **binarias**; se guardan para *interpretar* los perfiles después, no para formar grupos |
| `Kidhome`, `Teenhome` | se resumen en `Children = Kidhome + Teenhome` |
| `Year_Birth` | se reemplaza por `Age = 2014 − Year_Birth` |
| `TotalSpent`, `TotalPurchases` | son sumas exactas de variables que ya están → redundantes; solo para interpretar |

**¿Por qué 2014 y no 2026 para la edad?** El último cliente se registró en 2014; con el año actual todos tendrían ~12 años más de los que tenían al comprar.

### Limpieza (4 decisiones)
| Decisión | Por qué |
|---|---|
| Quitar 4 filas: 1 con `Income = 666666` y 3 con `Age > 100` (nacidos en 1893-1900) | Errores de captura. K-Means minimiza distancias **al cuadrado**: un punto extremo arrastra un centroide y además infla la desviación estándar del scaler |
| **NO** quitar los gastos altos | Son clientes reales de alto valor, justo los que queremos encontrar como segmento |
| `Income` faltante (24 filas, 1.07 %) → **mediana** (51 371) | Es poco, y la mediana no se deja engañar por el sesgo/atípicos como sí la media |
| `StandardScaler` | Pone todas las variables en media 0 y desv. 1. Sin esto el ingreso (decenas de miles) dominaría la distancia euclidiana |

Resultado: **2236 clientes**.

❓ *¿Por qué mediana y no media?* Porque Income es sesgada a la derecha; la media se infla con los ricos.
❓ *¿Por qué escalar si PCA/K-Means ya "calculan distancias"?* Justamente por eso: usan distancia euclidiana, que depende de las unidades.

---

## 4. PCA (reducción de dimensionalidad)

🧒 Tienes 15 fotos del mismo cliente desde 15 ángulos; muchas se parecen. PCA elige los 2 ángulos que **más información** conservan.

🎓 PCA busca nuevos ejes (componentes) que son combinaciones lineales de las variables, ordenados por cuánta **varianza** explican, y no están correlacionados entre sí.

**Por qué PCA aquí:** el mapa de correlación mostró que ingreso, gastos, catálogo y tienda están muy correlacionados (0.5-0.7) = misma información repetida.

**Resultado clave:**
| Componente | Varianza | Acumulada |
|---|---|---|
| PC1 | 40.79 % | 40.79 % |
| PC2 | 11.66 % | **52.45 %** |
| PC3 | 7.28 % | 59.73 % |

Desde PC3 cada una aporta < 8 % → el "codo" está en PC2.

**Qué significan los ejes (cargas / loadings):**
- **PC1 = poder adquisitivo y gasto.** Cargas positivas altas: Income (0.34), catálogo (0.33), carnes (0.33), vinos, tienda. Negativas: `Children` (−0.23) y `NumWebVisitsMonth` (−0.27). *PC1 alto = rico, gasta mucho, sin hijos.*
- **PC2 = familia que busca ofertas y compra en línea.** Cargas altas: `NumDealsPurchases` (0.60), `NumWebPurchases` (0.44), `Children` (0.37). *PC2 alto = tiene hijos, usa descuentos, compra por web.*
- `Recency` tiene carga ≈ 0 (0.007) en ambos → casi no importa para separar clientes (es casi uniforme de 0 a 99).

**¿Por qué entrenar sobre 2 componentes y no sobre las 15 variables?** (4 razones, memorízalas)
1. Los 2 ejes tienen **significado de negocio** → segmentos interpretables.
2. **Maldición de la dimensionalidad**: en muchas dimensiones las distancias se parecen todas. Comprobado: Silhouette de K-Means con 15 variables = 0.33 (K=2) y 0.21 (K=4); con PCA 2D = 0.55 y 0.47.
3. **DBSCAN** depende de la densidad, que en alta dimensión es casi uniforme; en 2D el k-dist graph se lee claro.
4. El **mapa 2D de la web es el mismo espacio** donde el modelo decide.

**Costo asumido:** se pierde ~48 % de la varianza (Recency, Age, diferencias dentro de categorías de gasto).

❓ *¿Es un problema tener solo 52 % de varianza?* Es la limitación principal. Se aceptó a cambio de interpretabilidad, y el Silhouette mejoró. Un Silhouette en PCA mide qué tan bien se separan **en ese espacio reducido**, no en el original.

---

## 5. K-Means

🧒 Pones 4 banderas al azar en el mapa. Cada cliente corre a la bandera más cercana. Luego cada bandera se mueve al centro de su gente. Repites hasta que nadie cambia de bandera.

🎓 Algoritmo: (1) elegir K centroides, (2) asignar cada punto al más cercano, (3) recalcular centroides = promedio, (4) repetir hasta converger. Minimiza la **inercia (WCSS)** = suma de distancias² de cada punto a su centroide.

**Hiperparámetros de tu código:**
| Parámetro | Valor | Por qué |
|---|---|---|
| `n_clusters` (K) | 4 | ver calibración abajo |
| `n_init` | 10 | corre 10 inicializaciones distintas y se queda con la de menor inercia (K-Means puede caer en un mal óptimo local) |
| `random_state` | 42 | reproducibilidad (mismos resultados siempre) |

**Limitaciones (pregunta típica):** hay que fijar K de antemano; asume grupos redondos y de tamaño parecido; sensible a atípicos; **todos** los puntos reciben grupo (no detecta ruido).

**Tamaños resultantes:** 989 (44.2 %), 474 (21.2 %), 434 (19.4 %), 339 (15.2 %). Inercia = 3188.46. Silhouette = **0.4646**.

---

## 6. DBSCAN

🧒 Imagina gente en una plaza. Si estás rodeado de al menos 3 vecinos cerca, estás en una "multitud". Las multitudes que se tocan se unen en un grupo. El que está solito lejos de todos es un **ruido**.

🎓 Basado en **densidad**. Dos hiperparámetros:
- `eps` = radio de vecindad.
- `min_samples` = mínimo de puntos dentro del radio (**incluyéndose a sí mismo**) para ser **punto core**.

Tipos de punto: **core** (tiene ≥ min_samples vecinos en eps), **border** (está en el radio de un core pero no es core), **noise** (-1, ni core ni border).
No necesita K, encuentra formas arbitrarias, detecta ruido.

**Cómo se eligieron (esto es "calibración"):**
- `min_samples = 2·D = 2·2 = 4`. Regla práctica vista en clase: MinPts ≥ D+1, se sugiere 2·D; D = 2 porque se entrena en el espacio PCA de 2 dimensiones.
- `eps` con el **k-dist graph**: para cada punto se calcula la distancia a su vecino número 4, se ordenan de menor a mayor y se busca el **codo** (donde la curva se dispara = empiezan los puntos aislados). El codo se encontró de forma objetiva con **kneedle**: el punto más alejado de la recta que une el primer y último punto de la curva. Resultado: codo en el punto 2144 de 2236 (percentil 95.9) → **eps = 0.32**.

**Resultado con eps=0.32, min_samples=4:** 10 clusters, **59 ruidos (2.64 %)**, un cluster con 2125 clientes (**95 %**) y 9 microgrupos de 4 a 10 clientes. Silhouette sin ruido = **−0.225** (negativo = mal).

**¿Por qué falló para segmentar?** Los clientes forman un **continuo** (de gasto bajo a alto) sin "valles vacíos" entre grupos. DBSCAN solo separa regiones divididas por baja densidad, así que ve casi todo como un solo bloque.

**Análisis de sensibilidad** (para probar que no fue mala suerte con eps): se probaron min_samples ∈ {4, 6, 10} y eps en percentiles 85/90/95/98. En todos, un cluster gigante (82-99 %), o clusters diminutos, o Silhouette bajo/negativo. Incluso en 15D con min_samples=30 sale 1 solo cluster.

**¿Para qué sirve entonces?** Para **detectar atípicos**: lo que queda como ruido (-1) es un cliente raro que merece revisión manual.

⚠️ **Truco de DBSCAN:** `DBSCAN` de sklearn no tiene `predict`. Para un cliente nuevo: se guarda `nn_core` (un `NearestNeighbors` sobre los puntos core) y la regla es:
`distancia al core más cercano ≤ eps → toma el cluster de ese core; si no → ruido (-1)`.

---

## 7. Comparación y por qué ganó K-Means

| | K-Means (K=4) | DBSCAN (eps .32, ms 4) |
|---|---|---|
| Clusters | 4 | 10 |
| Silhouette | **0.465** | −0.225 (sin ruido) |
| Ruido | 0 % | 2.64 % |
| Cluster más grande | 44.2 % | 95.0 % |
| Útil para marketing | 4 perfiles claros | casi todos iguales |
| Cliente nuevo | `predict()` | core más cercano |

**Regla de selección programada** (`train.py`): se elige el modelo con **mayor Silhouette** entre los que **no juntan más del 50 %** de los clientes en un solo cluster. DBSCAN queda descalificado (95 % > 50 %) y además tiene Silhouette negativo.

**Rol final:** K-Means = segmenta. DBSCAN = alerta de "cliente atípico" en la web.

---

## 8. Calibración (hiperparámetros): cómo se eligió K

> En tu proyecto "calibración" = **elegir hiperparámetros**: K (K-Means), eps y min_samples (DBSCAN) y n_components (PCA). No es calibración de probabilidades.

### Método del codo (inercia)
La inercia **siempre baja** al subir K (con K = n, sería 0). Se busca el punto donde **deja de bajar rápido**.

| K | Inercia | Silhouette |
|---|---|---|
| 2 | 6762 | **0.547** |
| 3 | 4013 | 0.510 |
| **4** | **3188** | **0.465** |
| 5 | 2692 | 0.462 |
| 6 | 2308 | 0.417 |
| 7 | 1956 | 0.365 |
| 8 | 1746 | 0.370 |
| 9 | 1541 | 0.378 |

### Coeficiente de Silhouette
Para cada punto: `s = (b − a) / max(a, b)`
- `a` = distancia promedio a los de **su** cluster (cohesión).
- `b` = distancia promedio al cluster **vecino más cercano** (separación).
- Va de −1 a 1. **Cerca de 1** = bien separado; **~0** = en la frontera; **negativo** = probablemente mal asignado. Se promedia sobre todos los puntos.

### ¿Por qué K=4 si K=2 tiene mayor Silhouette? (pregunta casi segura)
1. **Codo:** gran caída hasta K=4 y luego se aplana.
2. K=2 solo separa "gasta mucho / gasta poco": demasiado básico para marketing.
3. K=4 conserva Silhouette ≈ 0.47 (estructura razonable) y baja de 0.42 desde K=6.
4. **Utilidad de negocio:** con K=4 el gasto medio se parte en dos perfiles distintos (consolidados vs. cazadores de ofertas) que con K=2 o 3 quedan mezclados.

Es decir: **métrica + criterio de negocio**, no solo el número más alto.

Resumen de la calibración:
| Cosa | Valor | Cómo se decidió |
|---|---|---|
| n_components | 2 | codo de varianza (PC3 < 8 %) + interpretabilidad + mejora Silhouette |
| K | 4 | codo + Silhouette + utilidad de negocio |
| min_samples | 4 | regla 2·D con D = 2 |
| eps | 0.32 | codo del k-dist graph (kneedle) + sensibilidad |
| random_state / n_init | 42 / 10 | reproducibilidad / evitar mal óptimo local |

---

## 9. Los 4 segmentos (qué es cada uno)

Promedios reales (escala original):
| | 0 Ahorradores | 1 Premium | 2 Consolidados | 3 Cazadores de ofertas |
|---|---|---|---|---|
| % clientes | 44.2 | 21.2 | 19.4 | 15.2 |
| Ingreso | 34 867 | 77 738 | 63 879 | 50 474 |
| Hijos | 1.2 | 0.1 | 0.85 | **1.5** |
| Gasto total | 89 | **1429** | 954 | 517 |
| Compras con descuento | 1.8 | 1.1 | 2.6 | **5.0** |
| Visitas web/mes | 6.3 | 2.4 | 4.8 | **7.0** |
| Tasa `Response` | 8 % | **28 %** | 14 % | 17 % |

🧒 **Ahorradores:** poca plata, mucho mirar la web, poco comprar. **Premium:** mucha plata, sin hijos, vinos y carnes, los que más responden. **Consolidados:** buena plata, compran por todos los canales. **Cazadores de ofertas:** familias que solo compran si hay descuento.

**Cómo se nombran (sin hacerlo a mano)** — `map_segments()`:
1. Menor `TotalSpent` → *Ahorradores de bajo ingreso*.
2. Mayor `TotalSpent` → *Premium de alto gasto*.
3. De los 2 del medio: más `NumDealsPurchases` → *Familias cazadoras de ofertas*; el otro → *Consolidados multicanal*.

**Por qué por reglas:** K-Means numera los clusters al azar (0,1,2,3 no tienen orden). Con reglas, si se re-entrena y los números cambian, los nombres siguen correctos.

⚠️ `AcceptedCmp*`, `Response` **no se usaron para formar** los grupos; se usan **después** para validar que los grupos tienen sentido (Premium responde 28 % vs. Ahorradores 8 %). Eso es validación externa.

---

## 10. Las gráficas (qué muestra, cómo leerla, qué concluir)

### En el notebook
| # | Gráfica | Cómo se lee | Conclusión |
|---|---|---|---|
| 1 | **Histogramas** (4×4) de las 15 variables, con sesgo | Barras = cuántos clientes en cada rango | Gastos y catálogo **muy sesgados a la derecha** (muchos gastan poco, pocos mucho). `Recency` ~ uniforme → aporta poco |
| 2 | **Boxplots** (Income, Age, gasto) | Caja = 50 % central; puntos fuera = atípicos | Encuentra `Income = 666666` y edades > 100 → se eliminan |
| 3 | **Heatmap de correlación** (Pearson) | Rojo = suben juntas, azul = una sube y la otra baja | Ingreso/gastos/catálogo/tienda muy correlacionados (0.5-0.7); hijos y visitas web correlación negativa con gasto → **justifica PCA** |
| 4 | **Scatter Ingreso vs. Gasto total** coloreado por hijos | Cada punto = cliente | Ya se ven grupos: ingreso bajo/gasto mínimo y alto ingreso/sin hijos/gasto alto |
| 5 | **Varianza explicada PCA** (barras + línea acumulada, línea al 80 %) | Barras = % por componente; línea = acumulada | PC1 41 %, PC2 12 %; codo en PC2; 52 % acumulado |
| 6 | **Heatmap de cargas** (loadings) PC1-PC3 | Qué variables pesan en cada componente | PC1 = gasto/poder adquisitivo; PC2 = ofertas/familia/web |
| 7 | **Scatter PCA 2D sin colores** | Cada cliente en (PC1, PC2) | Es un continuo, sin islas claras → anticipa que DBSCAN va a sufrir |
| 8 | **Codo + Silhouette vs. K** (línea roja en K=4) | Dos curvas, K de 2 a 9 | Se elige K=4 |
| 9 | **k-dist graph** (normal + zoom) | Distancias al vecino 4 ordenadas; línea roja = eps | Codo → eps = 0.32 |
| 10 | **Scatter K-Means vs. DBSCAN** lado a lado | Colores = cluster; X negras = centroides; x = ruido | K-Means: 4 zonas; DBSCAN: una mancha gigante + puntitos |
| 11 | **Barras de tamaño de clusters** | Clientes por cluster | K-Means equilibrado; DBSCAN un cluster gigante (-1 = ruido) |
| 12 | **Heatmap de perfil z-score por cluster** (rojo-azul) | Valores estandarizados: >0 = sobre la media global | Permite comparar variables de escalas distintas y ver la "firma" de cada segmento |
| 13 | **Mapa PCA final con nombres** | Igual que 10 pero con nombres | Resultado final |

### En la web (React)
- **Vista Modelos & Dataset** (`ModelMetrics.jsx`): `LineChart` del codo (inercia), `LineChart` de Silhouette, `LineChart` del k-dist, barras de tamaño de clusters y `PcaScatter`. Son las mismas gráficas del notebook, dibujadas desde `comparison.json`.
- **Vista Segmentar** (`SegmentTool.jsx`): formulario con las 15 variables, resultado con segmento, estrategia, alerta de atípico de DBSCAN y el **mapa PCA con el cliente nuevo resaltado (estrella)**.

---

## 11. El código, archivo por archivo

### `ml/` (entrenamiento)
| Archivo | Qué hace |
|---|---|
| `config.py` | **Todas las constantes**: `FEATURES`, `RANDOM_STATE=42`, `REFERENCE_YEAR=2014`, límites de limpieza (`MAX_AGE=100`, `MAX_INCOME=200000`), `K_OPT=4`, `DBSCAN_MIN_SAMPLES = 2*N_COMPONENTS`, textos de los segmentos |
| `data.py` | `load_dataset()`: lee CSV (`sep=None` detecta tabulador), crea `Age`, `Children`, `TotalSpent`, `TotalPurchases`, filtra errores, imputa `Income` con mediana. Devuelve un `Dataset` (dataclass inmutable) |
| `train.py` | Entrena y exporta todo (ver abajo) |
| `notebooks/…ipynb` | El mismo proceso, documentado con EDA y gráficas |

**Funciones de `train.py` (aprende el orden):**
1. `_pipeline(model)` → arma scaler + PCA + modelo.
2. `k_search(X)` → para K=2..9 calcula inercia y Silhouette.
3. `kneedle_eps(Z, min_samples)` → calcula k-dist ordenado y devuelve el eps del codo (punto más lejano a la recta entre extremos).
4. `cluster_metrics(Z, labels)` → n clusters, Silhouette **sin ruido**, % ruido, tamaños, % del mayor.
5. `map_segments(frame, labels)` → nombres por reglas (sección 9).
6. `profile(...)` → promedios por segmento y tasas de campañas.
7. `pick_samples(...)` → clientes reales de ejemplo: los más cercanos al centroide de cada segmento + un ruido.
8. `main()` → entrena K-Means, calcula `eps`, entrena DBSCAN, elige modelo principal, guarda pipelines (`joblib`) y 4 JSON.

**Artefactos exportados (`backend/artifacts/`):**
`models/kmeans/pipeline.joblib`, `models/dbscan/pipeline.joblib` (incluye `nn_core`, `core_labels`, `eps`), `comparison.json` (métricas, codo, k-dist), `metadata.json` (variables, stats, PCA, segmentos), `samples.json`, `pca_points.json`.

### `backend/app/` (API FastAPI)
| Archivo | Rol |
|---|---|
| `config.py` | Configuración (env vars; `deviation_z_threshold=1.0`, `max_deviations=6`) |
| `registry.py` | Carga los modelos **una vez al arrancar** (`joblib.load`) |
| `schemas.py` | Modelos **Pydantic**: validan la entrada y definen la salida |
| `inference.py` | Corazón de la predicción (abajo) |
| `main.py` | Rutas |

**Rutas:** `GET /api/health`, `/api/metadata`, `/api/segments`, `/api/samples`, `/api/models/comparison`, `/api/pca-points` y **`POST /api/predict`**.

**Flujo de `predict()` (aprende esto):**
1. `build_feature_vector`: ordena las 15 variables; si falta una, usa la **mediana**; ignora las desconocidas.
2. `DataFrame` de 1 fila → `assign_one` para cada modelo:
   - **K-Means:** `pipeline[:-1].transform` → `km.predict` → distancia al centroide; `membership` = **inverso de la distancia normalizado** (afinidad relativa, **no** es una probabilidad real).
   - **DBSCAN:** `nn_core.kneighbors` → si `dist ≤ eps` toma el cluster del core, si no `-1` (atípico).
3. `outlier_check`: alerta si DBSCAN dice ruido.
4. `deviations`: `z = (valor − media del segmento) / desv. global`; reporta variables con |z| > 1 (máx. 6): "en qué se aleja este cliente de su segmento".
5. `comparison`: valor vs. media del segmento vs. media global, y marca `is_out_of_range` si cae fuera del [min, max] del dataset.
6. Devuelve segmento + descripción + recomendación + punto PCA para el mapa.

La descripción de negocio **siempre** sale del segmento de K-Means (es el único con segmentos de negocio).

### `src/` (React + Vite + Tailwind)
`LandingHero` (inicio con los 4 segmentos), `SegmentTool` (formulario y resultado), `ModelMetrics` (comparación), `PcaScatter` (mapa), `Persona` (tarjetas de segmento), `services/api.js` (llamadas a la API; si falla, usa métricas incluidas). Pruebas: `pytest` (38, backend) y Playwright (`e2e/`, interfaz).

---

## 12. Preguntas de examen (tapa la respuesta y contesta)

1. **¿Supervisado o no supervisado? ¿Por qué?** No supervisado: no hay variable objetivo.
2. **¿Por qué no entran las campañas (`AcceptedCmp`, `Response`)?** Son binarias y se reservan para interpretar/validar los perfiles después.
3. **¿Por qué escalar?** K-Means, PCA y DBSCAN usan distancia/varianza; sin escalar, el ingreso dominaría.
4. **¿Por qué mediana para imputar?** Robusta a sesgo y atípicos; falta solo 1.07 %.
5. **¿Por qué quitar la edad > 100 y el ingreso 666666 pero no los gastos altos?** Los primeros son errores; los segundos son clientes reales valiosos.
6. **¿Qué es PCA y por qué se usó?** Reduce dimensiones conservando varianza; hay variables muy correlacionadas; da ejes interpretables; mejora Silhouette y permite graficar.
7. **¿Cuánta varianza retienen 2 componentes?** 52.45 % (PC1 40.79, PC2 11.66).
8. **¿Qué significa PC1? ¿PC2?** PC1 = poder adquisitivo y gasto; PC2 = familia que busca ofertas y compra por web.
9. **¿Cómo elegiste K?** Codo + Silhouette + utilidad de negocio; K=4.
10. **Si K=2 tiene mejor Silhouette, ¿por qué K=4?** K=2 es demasiado simple para marketing; el codo se aplana en 4; K=4 separa dos perfiles medios distintos.
11. **¿Qué es la inercia?** Suma de distancias² de cada punto a su centroide. Siempre baja con K.
12. **¿Qué mide el Silhouette?** (b−a)/max(a,b): cohesión vs. separación, de −1 a 1.
13. **¿Cómo elegiste `eps` y `min_samples`?** min_samples = 2·D = 4; eps = codo del k-dist graph con kneedle = 0.32.
14. **¿Qué es el k-dist graph?** Distancias al k-ésimo vecino ordenadas; el codo separa puntos densos de aislados.
15. **¿Por qué DBSCAN falló como segmentador?** Los datos son un continuo sin zonas de baja densidad: 95 % en un cluster, Silhouette −0.225.
16. **¿Para qué se mantiene DBSCAN?** Detectar clientes atípicos (ruido).
17. **¿Cómo asignas un cliente nuevo con DBSCAN si no tiene `predict`?** Core más cercano; si dist ≤ eps toma su cluster, si no es ruido.
18. **¿Por qué no hay train/test?** Clustering no tiene etiqueta; se entrena con el 100 % y se evalúa con métricas internas.
19. **¿Para qué sirve `random_state` y `n_init`?** Reproducibilidad y evitar óptimos locales.
20. **¿Por qué usar `Pipeline`?** Mismo preprocesamiento en train e inferencia, evita fuga de datos, un solo objeto.
21. **¿Cómo se nombran los segmentos?** Reglas sobre el gasto total y las compras con descuento, no a mano.
22. **¿Qué es `membership` en la API?** Inverso de distancia normalizado; afinidad relativa, no probabilidad.
23. **¿Qué es `top_deviations`?** Variables donde el cliente se aleja >1 desviación estándar de la media de su segmento.
24. **¿Qué pasa si falta una variable en la petición?** Se completa con la mediana del dataset.
25. **¿Cuál es la limitación principal del proyecto?** Solo 52 % de varianza en 2D; el Silhouette se mide en ese espacio; K-Means asume grupos esféricos; no hay validación con datos nuevos.

### Preguntas "trampa" y respuestas honestas
- *"¿0.465 es un buen Silhouette?"* Moderado: estructura razonable, pero no grupos perfectamente separados (los clientes son un continuo). Por eso el valor de K=4 se justifica también por negocio.
- *"¿K-Means ganó porque es mejor algoritmo?"* No: ganó porque los datos **no tienen valles de baja densidad**, que es lo que DBSCAN necesita.
- *"¿Compararon Silhouettes de forma justa?"* El de DBSCAN se calcula sin ruido; aun así es negativo. Y se usó además el criterio de que ningún cluster tenga > 50 %.
- *"¿Por qué la edad con 2014?"* Fecha del último registro del dataset.
- *"¿Si re-entrenas, cambian los números de cluster?"* Pueden cambiar; por eso los nombres se asignan por reglas.

---

## 13. Hoja de trucos (léela antes de dormir y al despertar)

```
DATOS    2240 → 2236 (−4 errores) | 15 variables | Income NaN (24) → mediana 51 371
PIPELINE StandardScaler → PCA(2) → KMeans(4) | random_state 42 | n_init 10
PCA      PC1 40.79 % (gasto) + PC2 11.66 % (ofertas/familia/web) = 52.45 %
K        2..9 | codo + Silhouette | K=4 → Silhouette 0.465, inercia 3188
SIZES    989 (44 %) · 474 (21 %) · 434 (19 %) · 339 (15 %)
DBSCAN   min_samples = 2·D = 4 | eps = 0.32 (k-dist, kneedle, percentil 95.9)
         10 clusters, 59 ruido (2.64 %), 95 % en uno, Silhouette −0.225
GANADOR  K-Means (Silhouette mayor y ningún cluster > 50 %)
ROL      K-Means = segmentar | DBSCAN = detectar atípicos
SEGMENTOS bajo gasto → Ahorradores | mayor gasto → Premium |
          medios: más descuentos → Cazadores de ofertas; otro → Consolidados
SIN SUPERVISIÓN → sin train/test → métricas internas
API      POST /api/predict → transform → KMeans.predict + core más cercano (DBSCAN)
```

Frase resumen para el examen:
> "Limpiamos y escalamos 15 variables, las proyectamos a 2 componentes con PCA (gasto, y familia/ofertas), calibramos K con el codo y el Silhouette y eps con el k-dist graph, y comparamos K-Means y DBSCAN. K-Means con K=4 segmenta mejor (Silhouette 0.465) y DBSCAN se usa para detectar atípicos, porque los clientes forman un continuo sin zonas de baja densidad."
