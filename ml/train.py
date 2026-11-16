"""Entrena, compara y exporta los modelos de clustering que usa la API.

Se ejecuta desde la raíz del repositorio con python -m ml.train

Sigue el mismo proceso del notebook del proyecto.
1. Se eliminan errores de captura (edad mayor a 100 o ingreso mayor a 200000) y se completa Income con la mediana.
2. Cada pipeline aplica StandardScaler, luego PCA con 2 componentes y luego el modelo, con el 100 % de los datos.
3. En K-Means se prueba K desde 2 hasta 9 con el codo y el Silhouette, y se fija K en 4.
4. En DBSCAN min_samples es 2 por D, con D igual a 2 componentes, y eps sale del codo del k dist graph.
5. El modelo principal es el de mayor Silhouette que no junta más del 50 % de clientes en un solo cluster.
6. Se exportan los pipelines, las métricas, los metadatos, los puntos PCA y clientes reales de ejemplo.
"""

import json
import logging
import platform
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml import config
from ml.data import Dataset, load_dataset

log = logging.getLogger("ml.train")


def _pipeline(model) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("pca", PCA(n_components=config.N_COMPONENTS, random_state=config.RANDOM_STATE)),
        ("model", model),
    ])


def _kmeans(k: int) -> KMeans:
    return KMeans(n_clusters=k, n_init=10, random_state=config.RANDOM_STATE)


def k_search(X: pd.DataFrame) -> list[dict]:
    """Calcula la inercia y el Silhouette para K desde 2 hasta 9."""
    rows = []
    for k in config.K_RANGE:
        pipe = _pipeline(_kmeans(k))
        labels = pipe.fit_predict(X)
        Z = pipe[:-1].transform(X)
        rows.append({"k": k, "inertia": round(float(pipe["model"].inertia_), 2),
                     "silhouette": round(float(silhouette_score(Z, labels)), 4)})
    return rows


def kneedle_eps(Z: np.ndarray, min_samples: int) -> tuple[float, np.ndarray, int]:
    """Elige eps como el punto del k dist graph más alejado de la recta que une sus extremos."""
    k_dist = np.sort(NearestNeighbors(n_neighbors=min_samples).fit(Z).kneighbors(Z)[0][:, -1])
    idx = np.arange(len(k_dist))
    v = np.array([idx[-1], k_dist[-1] - k_dist[0]])
    w = np.c_[idx, k_dist - k_dist[0]]
    knee = int(np.argmax(np.abs(v[0] * w[:, 1] - v[1] * w[:, 0]) / np.linalg.norm(v)))
    return float(round(k_dist[knee], 3)), k_dist, knee


def cluster_metrics(Z: np.ndarray, labels: np.ndarray) -> dict:
    mask = labels != -1
    sizes = pd.Series(labels[mask]).value_counts().sort_index()
    n = len(sizes)
    return {
        "n_clusters": int(n),
        "silhouette": round(float(silhouette_score(Z[mask], labels[mask])), 4) if n > 1 else None,
        "noise_pct": round(float((~mask).mean() * 100), 2),
        "noise_count": int((~mask).sum()),
        "cluster_sizes": {str(k): int(v) for k, v in sizes.items()},
        "largest_cluster_pct": round(float(sizes.max() / len(labels) * 100), 2) if n else 0.0,
    }


def map_segments(frame: pd.DataFrame, labels: np.ndarray) -> dict[int, str]:
    """Asigna un nombre a cada cluster según su perfil, porque los números de K-Means no tienen orden."""
    prof = frame.assign(_c=labels).groupby("_c")[["TotalSpent", "NumDealsPurchases"]].mean()
    order = prof["TotalSpent"].sort_values().index.tolist()
    middle = order[1:-1]
    deals = prof.loc[middle, "NumDealsPurchases"].idxmax()
    mapping = {order[0]: "low", order[-1]: "premium", deals: "deals"}
    mapping.update({c: "consolidated" for c in middle if c != deals})
    return {int(c): key for c, key in mapping.items()}


def profile(frame: pd.DataFrame, mask: np.ndarray) -> dict:
    sub = frame[mask]
    return {
        "means": {f: round(float(sub[f].mean()), 2) for f in config.FEATURES + ["TotalSpent", "TotalPurchases"]},
        "binary_rates": {b: round(float(sub[b].mean()), 4) for b in config.BINARY},
    }


def pick_samples(data: Dataset, Z: np.ndarray, labels: np.ndarray, centers: np.ndarray,
                 db_labels: np.ndarray, segment_keys: dict[int, str]) -> dict:
    """Elige los clientes reales más cercanos a cada centroide y uno que DBSCAN marca como ruido."""
    ids = data.frame["ID"].to_numpy()
    out = {}
    for c, key in segment_keys.items():
        idx = np.where(labels == c)[0]
        nearest = idx[np.argsort(np.linalg.norm(Z[idx] - centers[c], axis=1))[: config.SAMPLES_PER_SEGMENT]]
        out[key] = [{"id": int(ids[i]), "segment_id": c,
                     "features": {f: float(data.X.iloc[i][f]) for f in config.FEATURES}} for i in nearest]
    noise_idx = np.where(db_labels == -1)[0]
    if len(noise_idx):
        far = noise_idx[np.argmax(np.linalg.norm(Z[noise_idx], axis=1))]
        out["noise"] = [{"id": int(ids[far]), "segment_id": int(labels[far]),
                         "features": {f: float(data.X.iloc[far][f]) for f in config.FEATURES}}]
    return out


def _write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def main(artifacts_dir: Path = config.ARTIFACTS_DIR) -> dict:
    data = load_dataset()
    X = data.X
    log.info("Dataset limpio con %d clientes y %d variables", len(X), len(config.FEATURES))

    #K-Means
    search = k_search(X)
    km = _pipeline(_kmeans(config.K_OPT))
    km_labels = km.fit_predict(X)
    Z = km[:-1].transform(X)
    km_metrics = cluster_metrics(Z, km_labels)
    km_metrics["inertia"] = round(float(km["model"].inertia_), 2)

    #DBSCAN en el mismo espacio PCA
    eps, k_dist, knee = kneedle_eps(Z, config.DBSCAN_MIN_SAMPLES)
    db = _pipeline(DBSCAN(eps=eps, min_samples=config.DBSCAN_MIN_SAMPLES))
    db_labels = db.fit_predict(X)
    db_metrics = cluster_metrics(Z, db_labels)
    dbm = db["model"]
    db_bundle = {
        "pipeline": db,
        "nn_core": NearestNeighbors(n_neighbors=1).fit(dbm.components_),
        "core_labels": dbm.labels_[dbm.core_sample_indices_],
        "eps": eps,
    }

    #Selección del modelo principal
    candidates = {"kmeans": km_metrics, "dbscan": db_metrics}
    eligible = {m: v for m, v in candidates.items()
                if v["silhouette"] is not None and v["largest_cluster_pct"] < 50}
    primary = max(eligible, key=lambda m: eligible[m]["silhouette"])

    #Segmentos
    keys = map_segments(data.frame, km_labels)
    centers = km["model"].cluster_centers_
    segments = {}
    for c, key in sorted(keys.items()):
        mask = km_labels == c
        segments[str(c)] = {
            "id": c, "key": key, **config.SEGMENT_TEXTS[key],
            "size": int(mask.sum()), "percentage": round(float(mask.mean() * 100), 2),
            "centroid_pca": [round(float(v), 4) for v in centers[c]],
            **profile(data.frame, mask),
        }

    stats = {f: {"mean": round(float(X[f].mean()), 4), "std": round(float(X[f].std()), 4),
                 "min": float(X[f].min()), "max": float(X[f].max()), "median": float(X[f].median())}
             for f in config.FEATURES}
    pca = km["pca"]

    metadata = {
        "dataset": "Customer Personality Analysis (Kaggle, imakash3011)",
        "n_customers": len(X),
        "features": config.FEATURES,
        "feature_info": config.FEATURE_INFO,
        "feature_stats": stats,
        "income_imputation_median": data.income_median,
        "pca": {
            "n_components": config.N_COMPONENTS,
            "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
            "total_explained_variance": round(float(pca.explained_variance_ratio_.sum()), 4),
            "axis_labels": ["PC1, poder adquisitivo y gasto", "PC2, ofertas, familia y web"],
            "loadings": {f: [round(float(pca.components_[i, j]), 4) for i in range(config.N_COMPONENTS)]
                         for j, f in enumerate(config.FEATURES)},
        },
        "segments": segments,
        "noise_segment": {"id": -1, "key": "noise", **config.NOISE_SEGMENT},
        "global_binary_rates": {b: round(float(data.frame[b].mean()), 4) for b in config.BINARY},
    }

    step = max(1, len(k_dist) // 200)
    comparison = {
        "dataset": {"total": len(X), "n_features": len(config.FEATURES), "n_components": config.N_COMPONENTS},
        "primary_model": primary,
        "selection_criterion": "Se elige el modelo con mayor Silhouette, calculado sin ruido en DBSCAN, entre "
                               "los modelos que no juntan más del 50 % de los clientes en un solo cluster.",
        "models": [
            {
                "id": "kmeans", "name": "K-Means", "short_name": "K-Means",
                "description": "Divide a los clientes en K grupos compactos alrededor de sus centroides. "
                               "Todos los clientes reciben un segmento.",
                "is_recommended": primary == "kmeans",
                "hyperparameters": {"n_clusters": config.K_OPT, "n_init": 10, "random_state": config.RANDOM_STATE},
                "metrics": km_metrics,
            },
            {
                "id": "dbscan", "name": "DBSCAN", "short_name": "DBSCAN",
                "description": "Agrupa por densidad y marca como ruido a los clientes aislados, "
                               "por eso sirve para detectar atípicos.",
                "is_recommended": primary == "dbscan",
                "hyperparameters": {"eps": eps, "min_samples": config.DBSCAN_MIN_SAMPLES},
                "metrics": db_metrics,
            },
        ],
        "k_search": search,
        "k_dist": {"eps": eps, "knee_index": knee, "min_samples": config.DBSCAN_MIN_SAMPLES,
                   "curve": [round(float(v), 4) for v in k_dist[::step]], "step": step},
        "environment": {"python": platform.python_version(), "scikit_learn": sklearn.__version__},
    }

    points = [{"x": round(float(z[0]), 4), "y": round(float(z[1]), 4),
               "kmeans": int(a), "dbscan": int(b)} for z, a, b in zip(Z, km_labels, db_labels)]
    samples = pick_samples(data, Z, km_labels, centers, db_labels, keys)

    #Exportación de los archivos
    (artifacts_dir / "models" / "kmeans").mkdir(parents=True, exist_ok=True)
    (artifacts_dir / "models" / "dbscan").mkdir(parents=True, exist_ok=True)
    joblib.dump(km, artifacts_dir / "models" / "kmeans" / "pipeline.joblib")
    joblib.dump(db_bundle, artifacts_dir / "models" / "dbscan" / "pipeline.joblib")
    _write_json(artifacts_dir / "comparison.json", comparison)
    _write_json(artifacts_dir / "metadata.json", metadata)
    _write_json(artifacts_dir / "pca_points.json", points)
    _write_json(artifacts_dir / "samples.json", samples)

    log.info("Métricas de K-Means %s", km_metrics)
    log.info("Métricas de DBSCAN %s", db_metrics)
    log.info("Modelo principal %s, archivos guardados en %s", primary, artifacts_dir)
    return comparison


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    main()
