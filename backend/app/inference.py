"""Asignación de un cliente a su segmento y explicación del resultado."""

import numpy as np
import pandas as pd

from app.config import settings
from app.registry import LoadedModel, ModelRegistry
from app.schemas import (
    Deviation,
    FeatureComparison,
    OutlierCheck,
    PcaPoint,
    PredictionRequest,
    PredictionResponse,
    SegmentAssignment,
)


def build_feature_vector(registry: ModelRegistry, features: dict[str, float]) -> dict[str, float]:
    """Ordena las variables esperadas, ignora las desconocidas y completa las que faltan con la mediana."""
    return {
        name: float(features[name]) if name in features else registry.feature_stats[name]["median"]
        for name in registry.features
    }


def _dbscan_segment(registry: ModelRegistry, model: LoadedModel, cluster: int) -> dict:
    """Devuelve los textos de un cluster de DBSCAN, que puede ser ruido, el núcleo principal o un grupo pequeño."""
    if cluster == -1:
        return registry.metadata["noise_segment"]
    sizes = next(m for m in registry.comparison["models"] if m["id"] == model.id)["metrics"]["cluster_sizes"]
    main = max(sizes, key=sizes.get)
    if str(cluster) == main:
        return {"key": f"dense_{cluster}", "name": "Núcleo denso principal", "short_name": "Núcleo",
                "color": "#22c55e"}
    return {"key": f"dense_{cluster}", "name": f"Grupo pequeño {cluster}", "short_name": f"Grupo {cluster}",
            "color": "#a855f7"}


def assign_one(registry: ModelRegistry, model: LoadedModel, frame: pd.DataFrame) -> SegmentAssignment:
    z = model.pipeline[:-1].transform(frame)           #mismo StandardScaler y PCA del entrenamiento

    if model.is_density_based:
        #Regla vista en clase, se busca el core más cercano y si está a una distancia menor o igual a eps
        #el cliente toma su cluster, si no se considera ruido
        dist, idx = model.nn_core.kneighbors(z)
        distance = float(dist[0, 0])
        cluster = int(model.core_labels[idx[0, 0]]) if distance <= model.eps else -1
        seg = _dbscan_segment(registry, model, cluster)
        membership = None
    else:
        km = model.pipeline[-1]
        cluster = int(km.predict(z)[0])
        dists = np.linalg.norm(km.cluster_centers_ - z[0], axis=1)
        distance = float(dists[cluster])
        inv = 1.0 / np.maximum(dists, 1e-9)            #la afinidad es el inverso de la distancia, normalizado
        membership = {str(i): round(float(v / inv.sum() * 100), 2) for i, v in enumerate(inv)}
        seg = registry.segments[str(cluster)]

    return SegmentAssignment(
        model_id=model.id, name=model.name, short_name=model.short_name,
        cluster_id=cluster, is_noise=cluster == -1,
        segment_key=seg["key"], segment_name=seg["name"], segment_short_name=seg["short_name"],
        color=seg["color"], distance=round(distance, 4), membership=membership,
    )


def outlier_check(registry: ModelRegistry, results: dict[str, SegmentAssignment]) -> OutlierCheck:
    db = results["dbscan"]
    eps = registry.models["dbscan"].eps
    if db.is_noise:
        msg = "DBSCAN considera atípico a este cliente porque está lejos de toda zona densa de clientes."
    else:
        msg = "DBSCAN ubica a este cliente dentro de una zona densa de clientes."
    return OutlierCheck(is_outlier=db.is_noise, dbscan_cluster=db.cluster_id,
                        distance_to_core=db.distance, eps=eps, message=msg)


def deviations(registry: ModelRegistry, vector: dict[str, float], cluster: int) -> list[Deviation]:
    """Devuelve las variables en las que el cliente más se aleja del promedio de su segmento."""
    means = registry.segments[str(cluster)]["means"]
    info = registry.metadata["feature_info"]
    found = []
    for name, value in vector.items():
        z = (value - means[name]) / (registry.feature_stats[name]["std"] or 1.0)
        if abs(z) > settings.deviation_z_threshold:
            found.append(Deviation(
                feature=name, label=info[name]["label"], value=value, segment_mean=means[name],
                deviation_z=round(z, 2),
                direction="Mayor que su segmento" if z > 0 else "Menor que su segmento",
            ))
    found.sort(key=lambda d: abs(d.deviation_z), reverse=True)
    return found[: settings.max_deviations]


def comparison(registry: ModelRegistry, vector: dict[str, float], cluster: int) -> dict[str, FeatureComparison]:
    means = registry.segments[str(cluster)]["means"]
    stats = registry.feature_stats
    return {
        name: FeatureComparison(
            value=value, segment_mean=means[name], global_mean=stats[name]["mean"],
            is_above_segment=value > means[name],
            is_out_of_range=not (stats[name]["min"] <= value <= stats[name]["max"]),
        )
        for name, value in vector.items()
    }


def predict(registry: ModelRegistry, request: PredictionRequest) -> PredictionResponse:
    vector = build_feature_vector(registry, request.features)
    frame = pd.DataFrame([vector], columns=registry.features)
    results = {mid: assign_one(registry, model, frame) for mid, model in registry.models.items()}

    if request.model_id == "all":
        active = results[registry.primary_id]
        active_name = f"{active.name} con detección de atípicos de DBSCAN"
    else:
        active = results[request.model_id]
        active_name = active.name

    #El perfil siempre se compara con el segmento de K-Means, que es el único con segmentos de negocio
    km_cluster = results["kmeans"].cluster_id
    if active.model_id == "dbscan":
        seg = _dbscan_segment(registry, registry.models["dbscan"], active.cluster_id)
        km_seg = registry.segments[str(km_cluster)]
        description = seg.get("description", f"El cliente está dentro del {seg['name'].lower()} de DBSCAN. "
                                             f"Su segmento de negocio en K-Means es {km_seg['name']}.")
        recommendation = seg.get("recommendation", km_seg["recommendation"])
    else:
        seg = registry.segments[str(active.cluster_id)]
        description, recommendation = seg["description"], seg["recommendation"]

    z = registry.primary.pipeline[:-1].transform(frame)[0]
    comp = comparison(registry, vector, km_cluster)

    return PredictionResponse(
        **active.model_dump(),
        description=description,
        recommendation=recommendation,
        selected_model=request.model_id,
        primary_model=registry.primary_id,
        active_model_name=active_name,
        pca=PcaPoint(x=round(float(z[0]), 4), y=round(float(z[1]), 4)),
        multi_model_summary=results,
        outlier_check=outlier_check(registry, results),
        top_deviations=deviations(registry, vector, km_cluster),
        comparison=comp,
        out_of_range_features=[f for f, c in comp.items() if c.is_out_of_range],
    )
