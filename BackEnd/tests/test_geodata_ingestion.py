from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.services import geodata_service

client = TestClient(app)


def _valid_payload() -> dict:
    return {
        "region_name": "Istanbul Test",
        "h3_resolution": 8,
        "bounding_box": {
            "west": 28.95,
            "east": 28.99,
            "south": 41.00,
            "north": 41.03,
        },
    }


@pytest.fixture(autouse=True)
def _in_memory_job_repo(monkeypatch):
    jobs: dict[str, dict] = {}

    def create_job(job_id: str, payload: dict) -> dict:
        jobs[job_id] = dict(payload)
        return dict(jobs[job_id])

    def update_job(job_id: str, patch: dict) -> dict | None:
        current = jobs.get(job_id)
        if current is None:
            return None
        current.update({k: v for k, v in patch.items() if k != "h3_cells"})
        return dict(current)

    def get_job(job_id: str) -> dict | None:
        current = jobs.get(job_id)
        if current is None:
            return None
        return dict(current)

    monkeypatch.setattr(geodata_service.geodata_repo, "create_job", create_job)
    monkeypatch.setattr(geodata_service.geodata_repo, "update_job", update_job)
    monkeypatch.setattr(geodata_service.geodata_repo, "get_job", get_job)


def test_ingest_returns_job_payload(monkeypatch) -> None:
    monkeypatch.setattr(
        geodata_service,
        "_start_worker",
        lambda **_kwargs: None,
    )

    response = client.post("/api/geodata/ingest", json=_valid_payload())
    assert response.status_code == 200
    body = response.json()

    assert "job_id" in body and body["job_id"]
    assert body["status"] == "running"
    assert "layer_counts" in body
    assert body["layer_counts"] == {}


def test_invalid_bbox_returns_400() -> None:
    payload = _valid_payload()
    payload["bounding_box"]["west"] = 29.3
    payload["bounding_box"]["east"] = 29.2

    response = client.post("/api/geodata/ingest", json=payload)
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "INVALID_BBOX"


def test_too_large_bbox_returns_400() -> None:
    payload = _valid_payload()
    payload["bounding_box"] = {
        "west": 28.45,
        "east": 29.05,
        "south": 40.9,
        "north": 41.3,
    }

    response = client.post("/api/geodata/ingest", json=payload)
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "BBOX_TOO_LARGE"


def test_bbox_outside_istanbul_returns_400() -> None:
    payload = _valid_payload()
    payload["bounding_box"] = {
        "west": 28.2,
        "east": 28.5,
        "south": 40.9,
        "north": 41.1,
    }

    response = client.post("/api/geodata/ingest", json=payload)
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "OUTSIDE_ISTANBUL_BOUNDARY"


def test_missing_layers_returns_partial_success(monkeypatch) -> None:
    monkeypatch.setattr(
        geodata_service,
        "extract_osm_data",
        lambda _bbox: (
            {"buildings": [], "roads": [1], "land_use": [], "nfz": []},
            [],
        ),
    )
    monkeypatch.setattr(geodata_service, "clean_and_transform", lambda features: features)
    monkeypatch.setattr(geodata_service, "generate_h3_grid", lambda _bbox, _res: ["x"])

    def run_inline(job_id: str, req_data: dict) -> None:
        geodata_service._run_ingest_job(job_id, req_data)

    monkeypatch.setattr(geodata_service, "_start_worker", run_inline)

    created = client.post("/api/geodata/ingest", json=_valid_payload())
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    status = client.get(f"/api/geodata/ingest/{job_id}")
    assert status.status_code == 200
    assert status.json()["status"] == "partial_success"


def test_h3_only_ingest_returns_partial_success(monkeypatch) -> None:
    monkeypatch.setattr(
        geodata_service,
        "extract_osm_data",
        lambda _bbox: (
            {"buildings": [], "roads": [], "land_use": [], "nfz": [], "controlled_airspace": []},
            ["Buildings layer unavailable: InsufficientResponseError"],
        ),
    )
    monkeypatch.setattr(geodata_service, "clean_and_transform", lambda features: features)
    monkeypatch.setattr(geodata_service, "generate_h3_grid", lambda _bbox, _res: ["x"])

    def run_inline(job_id: str, req_data: dict) -> None:
        geodata_service._run_ingest_job(job_id, req_data)

    monkeypatch.setattr(geodata_service, "_start_worker", run_inline)

    created = client.post("/api/geodata/ingest", json=_valid_payload())
    assert created.status_code == 200
    job_id = created.json()["job_id"]

    status = client.get(f"/api/geodata/ingest/{job_id}")
    assert status.status_code == 200
    assert status.json()["status"] == "partial_success"


def test_get_ingest_status_returns_saved_job(monkeypatch) -> None:
    monkeypatch.setattr(
        geodata_service,
        "extract_osm_data",
        lambda _bbox: (
            {"buildings": [1], "roads": [1], "land_use": [1], "nfz": []},
            [],
        ),
    )
    monkeypatch.setattr(geodata_service, "clean_and_transform", lambda features: features)
    monkeypatch.setattr(geodata_service, "generate_h3_grid", lambda _bbox, _res: ["c1", "c2"])

    def run_inline(job_id: str, req_data: dict) -> None:
        geodata_service._run_ingest_job(job_id, req_data)

    monkeypatch.setattr(geodata_service, "_start_worker", run_inline)

    created = client.post("/api/geodata/ingest", json=_valid_payload())
    job_id = created.json()["job_id"]

    response = client.get(f"/api/geodata/ingest/{job_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == job_id
    assert body["status"] in {"success", "partial_success", "failed", "running"}


def test_get_ingest_layers_returns_building_feature_collection(monkeypatch) -> None:
    monkeypatch.setattr(
        geodata_service,
        "extract_osm_data",
        lambda _bbox: (
            {"buildings": [1], "roads": [1], "land_use": [1], "nfz": [], "controlled_airspace": []},
            [],
        ),
    )
    monkeypatch.setattr(geodata_service, "clean_and_transform", lambda features: features)
    monkeypatch.setattr(geodata_service, "generate_h3_grid", lambda _bbox, _res: ["c1"])
    monkeypatch.setattr(
        geodata_service,
        "_serialize_geo_features",
        lambda _features: {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[28.95, 41.0], [28.96, 41.0], [28.96, 41.01], [28.95, 41.01], [28.95, 41.0]]],
                    },
                    "properties": {"name": "Building A"},
                }
            ],
        },
    )

    def run_inline(job_id: str, req_data: dict) -> None:
        geodata_service._run_ingest_job(job_id, req_data)

    monkeypatch.setattr(geodata_service, "_start_worker", run_inline)

    created = client.post("/api/geodata/ingest", json=_valid_payload())
    job_id = created.json()["job_id"]

    response = client.get(f"/api/geodata/ingest/{job_id}/layers")
    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == job_id
    assert body["buildings"]["type"] == "FeatureCollection"
    assert len(body["buildings"]["features"]) == 1
    assert body["roads"]["type"] == "FeatureCollection"


def test_extract_osm_data_warns_when_notam_overlay_missing(monkeypatch) -> None:
    bbox = geodata_service.BoundingBox(west=29.0, east=29.02, south=41.035, north=41.05)

    monkeypatch.setattr(geodata_service, "_extract_features", lambda _tags, _bbox: [])
    monkeypatch.setattr(geodata_service, "_extract_roads", lambda _bbox: [])
    monkeypatch.setattr(geodata_service, "list_nfz_in_bbox", lambda _bbox: [])
    monkeypatch.setattr(geodata_service, "list_controlled_airspace_in_bbox", lambda _bbox: [])
    monkeypatch.setattr(
        geodata_service,
        "get_nfz_source_health",
        lambda: {"aip_active": 1, "notam_active": 0},
    )
    monkeypatch.setattr(
        geodata_service,
        "get_controlled_airspace_health",
        lambda: {"controlled_active": 0},
    )

    _data, warnings = geodata_service.extract_osm_data(bbox)
    assert "NFZ NOTAM overlay is not loaded." in warnings
    assert "Controlled airspace layer is not loaded." in warnings
