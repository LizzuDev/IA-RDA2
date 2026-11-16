"""Pruebas de la API de segmentación.

Se ejecutan desde la raíz del repositorio con pytest, después de instalar backend/requirements-dev.txt
"""

import json

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from ml.data import load_dataset

MODEL_IDS = ["kmeans", "dbscan"]
SEGMENT_KEYS = ["low", "premium", "deals", "consolidated"]


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def registry(client):
    return client.app.state.registry


@pytest.fixture(scope="session")
def data():
    return load_dataset()


@pytest.fixture(scope="session")
def samples(client):
    return client.get("/api/samples").json()


def predict(client, features, model_id="all"):
    res = client.post("/api/predict", json={"features": features, "model_id": model_id})
    assert res.status_code == 200, res.text
    return res.json()


#Endpoints de lectura

class TestReadEndpoints:
    def test_health(self, client, registry):
        body = client.get("/api/health").json()
        assert body["status"] == "healthy"
        assert sorted(body["loaded_models"]) == sorted(MODEL_IDS)
        assert body["recommended_model"] == registry.primary_id == "kmeans"
        assert body["features_count"] == 15
        assert body["segments_count"] == 4

    def test_metadata(self, client, data):
        body = client.get("/api/metadata").json()
        assert body["features"] == data.features
        assert set(body["feature_stats"]) == set(data.features)
        assert set(body["feature_info"]) == set(data.features)
        assert sorted(s["key"] for s in body["segments"].values()) == sorted(SEGMENT_KEYS)

    def test_segment_sizes_add_up(self, client, data):
        segs = client.get("/api/segments").json()
        assert sum(s["size"] for s in segs.values()) == len(data.X)
        assert sum(s["percentage"] for s in segs.values()) == pytest.approx(100, abs=0.05)

    def test_samples_are_real_rows_of_the_dataset(self, samples, data):
        assert set(samples) == set(SEGMENT_KEYS) | {"noise"}
        by_id = data.frame.set_index("ID")
        for cases in samples.values():
            for case in cases:
                assert case["features"]["Income"] == by_id.loc[case["id"], "Income"]

    def test_comparison_is_the_exported_artifact(self, client, registry):
        body = client.get("/api/models/comparison").json()
        assert body == registry.comparison
        assert [m["id"] for m in body["models"]] == MODEL_IDS
        assert [m["id"] for m in body["models"] if m["is_recommended"]] == [body["primary_model"]]
        assert [r["k"] for r in body["k_search"]] == list(range(2, 10))

    @pytest.mark.parametrize("model", MODEL_IDS)
    def test_pca_points(self, client, data, model):
        pts = client.get(f"/api/pca-points?model={model}").json()
        assert len(pts) == len(data.X)
        assert set(pts[0]) == {"x", "y", "cluster"}

    def test_pca_points_invalid_model_is_422(self, client):
        assert client.get("/api/pca-points?model=svm").status_code == 422

    def test_cors_headers(self, client):
        res = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
        assert res.headers.get("access-control-allow-origin") in ("*", "http://localhost:5173")

    def test_unknown_route_is_404(self, client):
        assert client.get("/api/no-existe").status_code == 404


#Asignación de segmentos

class TestPredict:
    @pytest.mark.parametrize("model_id", MODEL_IDS + ["all"])
    def test_response_contract(self, client, samples, model_id):
        body = predict(client, samples["premium"][0]["features"], model_id)
        assert body["selected_model"] == model_id
        assert sorted(body["multi_model_summary"]) == sorted(MODEL_IDS)
        assert len(body["comparison"]) == 15
        assert {"x", "y"} == set(body["pca"])
        assert body["color"].startswith("#")

    def test_default_model_is_primary(self, client, samples, registry):
        res = client.post("/api/predict", json={"features": samples["low"][0]["features"]})
        assert res.json()["selected_model"] == "all"
        assert res.json()["model_id"] == registry.primary_id

    @pytest.mark.parametrize("key", SEGMENT_KEYS)
    def test_each_sample_lands_in_its_segment(self, client, samples, key):
        for case in samples[key]:
            body = predict(client, case["features"])
            assert body["segment_key"] == key
            assert body["cluster_id"] == case["segment_id"]
            assert body["outlier_check"]["is_outlier"] is False

    def test_noise_sample_is_flagged_by_dbscan(self, client, samples):
        body = predict(client, samples["noise"][0]["features"], "dbscan")
        assert body["is_noise"] is True and body["cluster_id"] == -1
        assert body["segment_key"] == "noise"
        assert body["outlier_check"]["is_outlier"] is True
        assert body["distance"] > body["outlier_check"]["eps"]

    def test_api_matches_direct_pipeline(self, client, registry, data):
        """La API aplica exactamente el mismo pipeline exportado."""
        rows = data.X.sample(20, random_state=0)
        expected = registry.models["kmeans"].pipeline.predict(rows)
        for (_, row), exp in zip(rows.iterrows(), expected):
            assert predict(client, row.to_dict())["cluster_id"] == int(exp)

    def test_dbscan_matches_training_labels_for_core_points(self, client, registry, data):
        model = registry.models["dbscan"]
        core_idx = model.pipeline[-1].core_sample_indices_[:15]
        for i in core_idx:
            body = predict(client, data.X.iloc[i].to_dict(), "dbscan")
            assert body["cluster_id"] == int(model.pipeline[-1].labels_[i])

    def test_pca_coordinates_match_points_artifact(self, client, registry, data):
        body = predict(client, data.X.iloc[0].to_dict())
        assert body["pca"]["x"] == pytest.approx(registry.points[0]["x"], abs=1e-3)
        assert body["pca"]["y"] == pytest.approx(registry.points[0]["y"], abs=1e-3)

    def test_membership_is_coherent(self, client, samples):
        body = predict(client, samples["deals"][0]["features"])
        m = body["membership"]
        assert sum(m.values()) == pytest.approx(100, abs=0.05)
        assert max(m, key=m.get) == str(body["cluster_id"])
        assert predict(client, samples["deals"][0]["features"], "dbscan")["membership"] is None

    def test_missing_features_are_filled_with_median(self, client, registry):
        body = predict(client, {"Income": 80000.0})
        assert body["comparison"]["Income"]["value"] == 80000.0
        assert body["comparison"]["Age"]["value"] == registry.feature_stats["Age"]["median"]

    def test_unknown_feature_keys_are_ignored(self, client, samples):
        base = samples["low"][0]["features"]
        assert predict(client, {**base, "foo": 999.0})["pca"] == predict(client, base)["pca"]

    def test_top_deviations_sorted_and_capped(self, client, samples):
        devs = predict(client, samples["noise"][0]["features"])["top_deviations"]
        z = [abs(d["deviation_z"]) for d in devs]
        assert 0 < len(devs) <= 6
        assert z == sorted(z, reverse=True)
        assert all(v > 1.0 for v in z)

    def test_higher_spending_moves_to_premium(self, client, samples):
        base = dict(samples["low"][0]["features"])
        rich = {**base, "Income": 90000, "Children": 0, "MntWines": 1000, "MntMeatProducts": 700,
                "MntFruits": 100, "MntFishProducts": 150, "MntSweetProducts": 100,
                "NumCatalogPurchases": 8, "NumStorePurchases": 10, "NumWebVisitsMonth": 2}
        assert predict(client, rich)["segment_key"] == "premium"

    def test_out_of_range_is_reported(self, client, samples):
        body = predict(client, {**samples["low"][0]["features"], "Income": 500000})
        assert "Income" in body["out_of_range_features"]

    def test_extreme_values_do_not_crash(self, client):
        body = predict(client, {"Income": 1e9, "MntWines": 1e7})
        assert np.isfinite(body["pca"]["x"])


#Validación de entrada

class TestValidation:
    @pytest.mark.parametrize("payload", [
        {},
        {"features": "texto"},
        {"features": {"Income": "abc"}},
        {"features": {"Income": 1}, "model_id": "svm"},
        {"features": {"Income": -10}},
    ])
    def test_invalid_payload_returns_422(self, client, payload):
        assert client.post("/api/predict", json=payload).status_code == 422

    def test_non_finite_values_return_422(self, client):
        body = '{"features": {"Income": NaN}}'
        res = client.post("/api/predict", content=body, headers={"Content-Type": "application/json"})
        assert res.status_code == 422

    def test_numeric_strings_are_coerced(self, client):
        res = client.post("/api/predict", json={"features": {"Income": "45000"}})
        assert res.status_code == 200
        assert res.json()["comparison"]["Income"]["value"] == 45000


def test_returns_503_without_models(monkeypatch, tmp_path):
    from app import main
    monkeypatch.setattr(main, "settings", type(main.settings)(artifacts_dir=tmp_path))
    with TestClient(main.app) as bare:
        assert bare.get("/api/health").status_code == 503
        assert bare.post("/api/predict", json={"features": {}}).status_code == 503


def test_artifacts_are_valid_json(registry):
    from app.config import settings
    for name in ["comparison.json", "metadata.json", "samples.json", "pca_points.json"]:
        json.loads((settings.artifacts_dir / name).read_text(encoding="utf-8"))
    assert len(pd.DataFrame(registry.points)) == registry.metadata["n_customers"]
