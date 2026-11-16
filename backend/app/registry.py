"""Carga de los archivos que genera python -m ml.train."""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class LoadedModel:
    id: str
    name: str
    short_name: str
    pipeline: Any                 #StandardScaler, PCA y el modelo
    nn_core: Any = None           #solo en DBSCAN, NearestNeighbors sobre los puntos core
    core_labels: Any = None       #solo en DBSCAN, cluster de cada punto core
    eps: float | None = None      #solo en DBSCAN

    @property
    def is_density_based(self) -> bool:
        return self.nn_core is not None


@dataclass(frozen=True)
class ModelRegistry:
    models: dict[str, LoadedModel]
    primary_id: str
    comparison: dict
    metadata: dict
    samples: dict
    points: list[dict]

    @property
    def features(self) -> list[str]:
        return self.metadata["features"]

    @property
    def feature_stats(self) -> dict:
        return self.metadata["feature_stats"]

    @property
    def segments(self) -> dict:
        return self.metadata["segments"]

    @property
    def primary(self) -> LoadedModel:
        return self.models[self.primary_id]


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_registry(artifacts_dir: Path) -> ModelRegistry:
    """Carga los metadatos, la comparación y los pipelines, y falla con un error claro si falta algo."""
    comparison = _read_json(artifacts_dir / "comparison.json")
    metadata = _read_json(artifacts_dir / "metadata.json")

    models = {}
    for entry in comparison["models"]:
        obj = joblib.load(artifacts_dir / "models" / entry["id"] / "pipeline.joblib")
        if isinstance(obj, dict):          #DBSCAN se exporta junto con lo necesario para asignar clientes nuevos
            models[entry["id"]] = LoadedModel(entry["id"], entry["name"], entry["short_name"], obj["pipeline"],
                                              obj["nn_core"], obj["core_labels"], float(obj["eps"]))
        else:
            models[entry["id"]] = LoadedModel(entry["id"], entry["name"], entry["short_name"], obj)
        log.info("Modelo '%s' cargado", entry["id"])

    return ModelRegistry(
        models=models,
        primary_id=comparison["primary_model"],
        comparison=comparison,
        metadata=metadata,
        samples=_read_json(artifacts_dir / "samples.json"),
        points=_read_json(artifacts_dir / "pca_points.json"),
    )
