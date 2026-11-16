"""Carga y limpieza del dataset Customer Personality Analysis de Kaggle."""

from dataclasses import dataclass

import pandas as pd

from ml import config


@dataclass(frozen=True)
class Dataset:
    frame: pd.DataFrame          #dataset limpio con ID, variables binarias y variables derivadas
    X: pd.DataFrame              #solo las variables del modelo, en orden
    income_median: float         #valor usado para completar los ingresos faltantes

    @property
    def features(self) -> list[str]:
        return list(config.FEATURES)


def load_dataset(path=config.DATA_PATH) -> Dataset:
    """Lee el CSV, crea Age y Children, elimina errores y completa Income con la mediana."""
    df = pd.read_csv(path, sep=None, engine="python")
    df["Age"] = config.REFERENCE_YEAR - df["Year_Birth"]
    df["Children"] = df["Kidhome"] + df["Teenhome"]
    df["TotalSpent"] = df[config.SPENDING].sum(axis=1)
    df["TotalPurchases"] = df[config.PURCHASES].sum(axis=1)

    df = df[(df["Age"] <= config.MAX_AGE) & ~(df["Income"] > config.MAX_INCOME)].copy()
    median = float(df["Income"].median())
    df["Income"] = df["Income"].fillna(median)
    df = df.reset_index(drop=True)
    return Dataset(frame=df, X=df[config.FEATURES].astype(float), income_median=median)
