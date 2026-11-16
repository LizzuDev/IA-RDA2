"""Formatos de entrada y salida de la API."""

import math
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ModelId = Literal["kmeans", "dbscan", "all"]


class PredictionRequest(BaseModel):
    features: dict[str, float] = Field(
        ..., description="Variables del cliente en escala original, las que falten se completan con la mediana.")
    model_id: ModelId = Field("all", description="Modelo que se va a usar, con all se usa el modelo principal y el resumen de ambos.")

    @field_validator("features")
    @classmethod
    def values_must_be_valid(cls, features: dict[str, float]) -> dict[str, float]:
        bad = [name for name, value in features.items() if not math.isfinite(value)]
        if bad:
            raise ValueError(f"Hay valores no válidos en {', '.join(bad)}")
        negative = [name for name, value in features.items() if value < 0]
        if negative:
            raise ValueError(f"No se permiten valores negativos en {', '.join(negative)}")
        return features


class SegmentAssignment(BaseModel):
    """Resultado de un modelo para el cliente."""
    model_id: str
    name: str                      #nombre del modelo
    short_name: str
    cluster_id: int                #el valor menos uno indica ruido y solo ocurre en DBSCAN
    is_noise: bool
    segment_key: str               #low, premium, deals, consolidated, noise o dense_n
    segment_name: str
    segment_short_name: str
    color: str                     #color del segmento para el gráfico
    distance: float                #en K-Means es la distancia al centroide y en DBSCAN al core más cercano
    membership: dict[str, float] | None = None   #afinidad en porcentaje con cada segmento, solo en K-Means


class PcaPoint(BaseModel):
    x: float
    y: float


class OutlierCheck(BaseModel):
    """Indica si DBSCAN considera al cliente típico o atípico."""
    is_outlier: bool
    dbscan_cluster: int
    distance_to_core: float
    eps: float
    message: str


class Deviation(BaseModel):
    feature: str
    label: str
    value: float
    segment_mean: float
    deviation_z: float
    direction: str


class FeatureComparison(BaseModel):
    value: float
    segment_mean: float
    global_mean: float
    is_above_segment: bool
    is_out_of_range: bool


class PredictionResponse(SegmentAssignment):
    description: str
    recommendation: str
    selected_model: ModelId
    primary_model: str
    active_model_name: str
    pca: PcaPoint
    multi_model_summary: dict[str, SegmentAssignment]
    outlier_check: OutlierCheck
    top_deviations: list[Deviation]
    comparison: dict[str, FeatureComparison]
    out_of_range_features: list[str]
