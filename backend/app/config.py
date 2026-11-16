"""Configuración de la API, se lee de las variables de entorno descritas en .env.example."""

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "*")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    artifacts_dir: Path = field(
        default_factory=lambda: Path(os.getenv("ARTIFACTS_DIR", BACKEND_DIR / "artifacts")))
    cors_origins: list[str] = field(default_factory=_origins)
    #Se reportan las variables que se alejan del promedio de su segmento más que este valor z
    deviation_z_threshold: float = 1.0
    max_deviations: int = 6


settings = Settings()
