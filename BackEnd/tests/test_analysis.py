from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from app.api import deps
from app.main import app
from app.repos import analysis_repo
from app.services.analysis_service import AnalysisService, validate_criteria_weights

client = TestClient(app)


def _user(role: str = "expert") -> SimpleNamespace:
    return SimpleNamespace(id=1, role=role, is_active=True)


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _as_user(role: str) -> None:
    app.dependency_overrides[deps.get_current_active_user] = lambda: _user(role)


def test_validate_criteria_weights_accepts_percentages() -> None:
    weights = validate_criteria_weights(
        {
            "obstacle": 35,
            "transport": 25,
            "land_use": 20,
            "nfz": 20,
        }
    )
    assert weights == {
        "obstacle": 0.35,
        "transport": 0.25,
        "land_use": 0.2,
        "nfz": 0.2,
    }


def test_validate_criteria_weights_rejects_bad_total() -> None:
    with pytest.raises(Exception) as exc_info:
        validate_criteria_weights(
            {
                "obstacle": 0.5,
                "transport": 0.5,
                "land_use": 0.5,
                "nfz": 0.5,
            }
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_CRITERIA_WEIGHTS"


def test_create_analysis_starts_async_job(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_geodata_job",
        lambda _job_id: {
            "job_id": "job-1",
            "region_name": "Istanbul Test",
            "status": "success",
            "layer_counts": {},
        },
    )
    monkeypatch.setattr(analysis_repo, "list_geodata_cells", lambda _job_id: ["8928308280fffff"])
    monkeypatch.setattr(
        analysis_repo,
        "create_analysis",
        lambda **_kwargs: {
            "id": 99,
            "status": "running",
        },
    )
    monkeypatch.setattr(AnalysisService, "_start_worker", lambda *_args, **_kwargs: None)

    response = client.post(
        "/api/analysis",
        json={
            "geodata_job_id": "job-1",
            "criteria_weights": {
                "obstacle": 0.35,
                "transport": 0.25,
                "land_use": 0.2,
                "nfz": 0.2,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["analysis_id"] == 99
    assert response.json()["status"] == "running"


def test_recalculate_analysis_reuses_existing_job(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 99,
            "user_id": 1,
            "geodata_job_id": "job-1",
            "status": "completed",
            "criteria_weights": {"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
        },
    )
    monkeypatch.setattr(
        analysis_repo,
        "get_geodata_job",
        lambda _job_id: {
            "job_id": "job-1",
            "region_name": "Istanbul Test",
            "status": "success",
            "layer_counts": {},
        },
    )
    monkeypatch.setattr(analysis_repo, "list_geodata_cells", lambda _job_id: ["8928308280fffff"])
    monkeypatch.setattr(
        analysis_repo,
        "reset_analysis",
        lambda _analysis_id, **_kwargs: {
            "id": 99,
            "status": "running",
        },
    )
    monkeypatch.setattr(AnalysisService, "_start_worker", lambda *_args, **_kwargs: None)

    response = client.post(
        "/api/analysis/99/recalculate",
        json={
            "criteria_weights": {
                "obstacle": 0.3,
                "transport": 0.3,
                "land_use": 0.2,
                "nfz": 0.2,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["analysis_id"] == 99
    assert response.json()["status"] == "running"


def test_create_analysis_rejects_invalid_weights() -> None:
    _as_user("expert")
    response = client.post(
        "/api/analysis",
        json={
            "geodata_job_id": "job-1",
            "criteria_weights": {
                "obstacle": 0.9,
                "transport": 0.9,
                "land_use": 0.9,
                "nfz": 0.9,
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_CRITERIA_WEIGHTS"


def test_passenger_cannot_create_analysis() -> None:
    _as_user("passenger")
    response = client.post(
        "/api/analysis",
        json={
            "geodata_job_id": "job-1",
            "criteria_weights": {
                "obstacle": 0.35,
                "transport": 0.25,
                "land_use": 0.2,
                "nfz": 0.2,
            },
        },
    )

    assert response.status_code == 403


def test_get_analysis_status(monkeypatch) -> None:
    _as_user("expert")
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 7,
            "status": "completed",
            "started_at": now,
            "completed_at": now,
        },
    )

    response = client.get("/api/analysis/7/status")

    assert response.status_code == 200
    assert response.json()["analysis_id"] == 7
    assert response.json()["status"] == "completed"


def test_get_analysis_result(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 7,
            "status": "completed",
            "region_name": "Istanbul",
            "criteria_weights": {"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
        },
    )
    monkeypatch.setattr(
        analysis_repo,
        "summarize_results",
        lambda _analysis_id: {"cell_count": 1, "average_score": 88.0, "max_score": 88.0, "min_score": 88.0},
    )
    monkeypatch.setattr(
        analysis_repo,
        "list_results",
        lambda _analysis_id, **_kwargs: [
            {
                "cell_index": "cell-1",
                "suitability_score": 88.0,
                "criteria_breakdown": {"obstacle": 0.9, "transport": 0.8, "land_use": 0.8, "nfz": 1.0},
            }
        ],
    )

    response = client.get("/api/analysis/7/result")

    assert response.status_code == 200
    assert response.json()["summary"]["cell_count"] == 1
    assert response.json()["mcdm"]["is_consistent"] is True
    assert response.json()["mcdm"]["consistency_ratio"] == 0.0
    assert response.json()["top_candidates"][0]["rank"] == 1


def test_get_analysis_heatmap(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(analysis_repo, "get_analysis", lambda _analysis_id: {"id": 7, "status": "completed"})
    monkeypatch.setattr(
        analysis_repo,
        "list_results",
        lambda _analysis_id, **_kwargs: [
            {
                "cell_index": "cell-1",
                "suitability_score": 88.0,
                "criteria_breakdown": {"obstacle": 0.9, "transport": 0.8, "land_use": 0.8, "nfz": 1.0},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[28.9, 41.0], [28.91, 41.0], [28.91, 41.01], [28.9, 41.0]]],
                },
            }
        ],
    )

    response = client.get("/api/analysis/7/heatmap")

    assert response.status_code == 200
    assert response.json()["type"] == "FeatureCollection"
    assert response.json()["features"][0]["properties"]["score_class"] == "high"
    assert response.json()["features"][0]["properties"]["mcdm_method"] == "AHP_TOPSIS"


def test_get_analysis_cell_detail(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(analysis_repo, "get_analysis", lambda _analysis_id: {"id": 7, "status": "completed"})
    monkeypatch.setattr(
        analysis_repo,
        "get_result_by_cell",
        lambda _analysis_id, _cell_index, **_kwargs: {
            "cell_index": "cell-1",
            "suitability_score": 88.0,
            "criteria_breakdown": {"criteria_scores": {"obstacle": 0.9, "transport": 0.8, "land_use": 0.8, "nfz": 1.0}},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[28.9, 41.0], [28.91, 41.0], [28.91, 41.01], [28.9, 41.0]]],
            },
        },
    )
    monkeypatch.setattr(
        analysis_repo,
        "list_results",
        lambda _analysis_id, **_kwargs: [
            {"cell_index": "cell-x", "suitability_score": 91.0, "criteria_breakdown": {}},
            {"cell_index": "cell-1", "suitability_score": 88.0, "criteria_breakdown": {}},
        ],
    )

    response = client.get("/api/analysis/7/cells/cell-1")

    assert response.status_code == 200
    assert response.json()["analysis_id"] == 7
    assert response.json()["cell_index"] == "cell-1"
    assert response.json()["rank"] == 2
    assert response.json()["score_class"] == "high"


def test_get_analysis_cell_detail_returns_404_when_missing(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(analysis_repo, "get_analysis", lambda _analysis_id: {"id": 7, "status": "completed"})
    monkeypatch.setattr(analysis_repo, "get_result_by_cell", lambda *_args, **_kwargs: None)

    response = client.get("/api/analysis/7/cells/missing-cell")

    assert response.status_code == 404
    assert response.json()["code"] == "ANALYSIS_CELL_NOT_FOUND"


def test_calculate_results_uses_topsis_breakdown() -> None:
    service = AnalysisService()
    rows = service._calculate_results(
        geodata_job={
            "layer_counts": {
                "buildings": 120,
                "roads": 45,
                "land_use": 8,
                "nfz": 0,
            }
        },
        cells=["881ec90249fffff", "881ec910b5fffff", "881ec90245fffff"],
        weights={"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
    )

    assert len(rows) == 3
    assert all(0 <= row["suitability_score"] <= 100 for row in rows)
    breakdown = rows[0]["criteria_breakdown"]
    assert breakdown["method"] == "AHP_TOPSIS"
    assert "weighted_values" in breakdown
    assert "ideal_best" in breakdown
    assert "ideal_worst" in breakdown
    assert "topsis_closeness" in breakdown


def test_compare_analysis_candidates(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(analysis_repo, "get_analysis", lambda _analysis_id: {"id": 7, "status": "completed"})
    monkeypatch.setattr(
        analysis_repo,
        "list_results",
        lambda _analysis_id, **_kwargs: [
            {"cell_index": "cell-a", "suitability_score": 90.0, "criteria_breakdown": {}},
            {"cell_index": "cell-b", "suitability_score": 70.0, "criteria_breakdown": {}},
        ],
    )

    response = client.post(
        "/api/analysis/compare",
        json={"analysis_id": 7, "cell_indexes": ["cell-a", "cell-b"]},
    )

    assert response.status_code == 200
    assert [item["rank"] for item in response.json()["ranked_candidates"]] == [1, 2]


def test_compare_requires_at_least_two_cells() -> None:
    _as_user("expert")
    response = client.post(
        "/api/analysis/compare",
        json={"analysis_id": 7, "cell_indexes": ["cell-a"]},
    )

    assert response.status_code == 422
