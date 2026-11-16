"""API de segmentación de clientes hecha con FastAPI.

Se ejecuta desde la carpeta backend con uvicorn app.main:app --reload --port 8000
La documentación interactiva queda en http://127.0.0.1:8000/docs
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import inference
from app.config import settings
from app.registry import ModelRegistry, load_registry
from app.schemas import PredictionRequest, PredictionResponse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.registry = load_registry(settings.artifacts_dir)
    except Exception as exc:                       #la API arranca, pero responde con error 503
        log.error("No se pudieron cargar los archivos de %s por el error %s", settings.artifacts_dir, exc)
        app.state.registry = None
    yield


app = FastAPI(
    title="Customer Segments API",
    description="Asigna clientes nuevos a segmentos con K-Means y detecta atípicos con DBSCAN.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Devuelve el error 422 siempre con el mismo formato para el front, incluso si la entrada trae NaN."""
    detail = [{"loc": list(e.get("loc", [])), "msg": str(e.get("msg", "")), "type": e.get("type", "")}
              for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": detail})


def get_registry(request: Request) -> ModelRegistry:
    registry = request.app.state.registry
    if registry is None:
        raise HTTPException(503, "Los modelos no están disponibles. Se deben generar con python -m ml.train.")
    return registry


@app.get("/api/health")
def health(request: Request):
    registry = get_registry(request)
    return {
        "status": "healthy",
        "loaded_models": list(registry.models),
        "recommended_model": registry.primary_id,
        "features_count": len(registry.features),
        "segments_count": len(registry.segments),
    }


@app.get("/api/metadata")
def metadata(request: Request):
    """Variables con sus etiquetas para el formulario, estadísticas, PCA y perfiles de los segmentos."""
    return get_registry(request).metadata


@app.get("/api/segments")
def segments(request: Request):
    """Segmentos de negocio de K-Means con sus perfiles y recomendaciones."""
    return get_registry(request).segments


@app.get("/api/samples")
def samples(request: Request):
    """Clientes reales del dataset para probar la herramienta, por segmento y uno atípico."""
    return get_registry(request).samples


@app.get("/api/models/comparison")
def models_comparison(request: Request):
    """Métricas de ambos modelos, búsqueda de K y curva k dist."""
    return get_registry(request).comparison


@app.get("/api/pca-points")
def pca_points(request: Request, model: Literal["kmeans", "dbscan"] = Query("kmeans")):
    """Coordenadas PCA de todos los clientes con su cluster para el gráfico 2D."""
    registry = get_registry(request)
    return [{"x": p["x"], "y": p["y"], "cluster": p[model]} for p in registry.points]


@app.post("/api/predict", response_model=PredictionResponse)
def predict(body: PredictionRequest, request: Request):
    return inference.predict(get_registry(request), body)


#Prototipo de interfaz que sirve la misma API en http://127.0.0.1:8000/demo/
_PROTOTYPE = Path(__file__).resolve().parents[2] / "frontend-prototype"
if _PROTOTYPE.is_dir():
    app.mount("/demo", StaticFiles(directory=_PROTOTYPE, html=True), name="demo")
