from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest
from shapely.geometry import Polygon

from app.api import deps
from app.main import app
from app.repos import analysis_repo
from app.services import analysis_service
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
    assert response.json()["features"][0]["properties"]["score_class"] == "strong"
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
    assert response.json()["score_class"] == "strong"


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
    assert breakdown["priority_vector"]["obstacle"] == pytest.approx(0.35)
    assert breakdown["priority_vector"]["traffic_density"] == pytest.approx(0.0)


def test_calculate_results_penalizes_cells_intersecting_nfz(monkeypatch) -> None:
    service = AnalysisService()
    monkeypatch.setattr(
        analysis_service,
        "list_nfz_geojson_in_bbox",
        lambda _bbox: [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [28.98, 41.00],
                        [29.01, 41.00],
                        [29.01, 41.03],
                        [28.98, 41.03],
                        [28.98, 41.00],
                    ]],
                },
                "properties": {"zone_category": "nfz"},
            }
        ],
    )
    monkeypatch.setattr(
        analysis_service,
        "_cell_polygon",
        lambda cell_index: (
            Polygon([(28.985, 41.005), (29.005, 41.005), (29.005, 41.025), (28.985, 41.025), (28.985, 41.005)])
            if cell_index == "cell-hit"
            else Polygon([(29.03, 41.03), (29.05, 41.03), (29.05, 41.05), (29.03, 41.05), (29.03, 41.03)])
        ),
    )

    rows = service._calculate_results(
        geodata_job={
            "bounding_box": {"west": 28.95, "east": 29.05, "south": 40.99, "north": 41.04},
            "layer_counts": {
                "buildings": 120,
                "roads": 45,
                "land_use": 8,
                "nfz": 1,
            },
        },
        cells=["cell-hit", "cell-clear"],
        weights={"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
    )

    assert len(rows) == 2
    contexts = [row["criteria_breakdown"]["criteria_context"]["nfz"] for row in rows]
    scores = [row["criteria_breakdown"]["criteria_scores"]["nfz"] for row in rows]
    assert any(context["intersects_nfz"] for context in contexts)
    assert min(scores) < max(scores)
    hit_row = next(row for row in rows if row["criteria_breakdown"]["criteria_context"]["nfz"]["intersects_nfz"])
    assert hit_row["criteria_breakdown"]["criteria_scores"]["nfz"] == 0.0
    assert hit_row["suitability_score"] == 0.0
    assert hit_row["criteria_breakdown"]["hard_constraint_violation"] == "NFZ_INTERSECTION"


def test_calculate_results_prefers_official_traffic_and_tuik_layers(monkeypatch) -> None:
    service = AnalysisService()
    monkeypatch.setattr(analysis_service, "list_nfz_geojson_in_bbox", lambda _bbox: [])
    shared_polygon = Polygon([(28.985, 41.005), (29.005, 41.005), (29.005, 41.025), (28.985, 41.025), (28.985, 41.005)])
    monkeypatch.setattr(analysis_service, "_cell_polygon", lambda _cell_index: shared_polygon)

    rows = service._calculate_results(
        geodata_job={
            "bounding_box": {"west": 28.95, "east": 29.05, "south": 40.99, "north": 41.04},
            "layer_counts": {
                "buildings": 120,
                "roads": 45,
                "land_use": 8,
                "nfz": 0,
            },
            "extracted_layers": {
                "traffic_density": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "LineString",
                                "coordinates": [[28.99, 41.01], [29.0, 41.02]],
                            },
                            "properties": {
                                "official_traffic_score": 0.88,
                                "official_traffic_property": "density",
                            },
                        }
                    ],
                },
                "socioeconomic": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [[
                                    [28.98, 41.00],
                                    [29.01, 41.00],
                                    [29.01, 41.03],
                                    [28.98, 41.03],
                                    [28.98, 41.00],
                                ]],
                            },
                            "properties": {
                                "district_name": "Bakirkoy",
                                "official_population_score": 0.76,
                                "official_population_total": 230000,
                            },
                        }
                    ],
                },
            },
        },
        cells=["cell-official"],
        weights={
            "obstacle": 0.25,
            "transport": 0.2,
            "land_use": 0.15,
            "nfz": 0.15,
            "traffic_density": 0.15,
            "socioeconomic": 0.1,
        },
    )

    assert len(rows) == 1
    breakdown = rows[0]["criteria_breakdown"]
    assert breakdown["criteria_context"]["traffic_density"]["source"] == "ibb_official"
    assert breakdown["criteria_context"]["socioeconomic"]["source"] == "tuik_official"
    assert breakdown["criteria_scores"]["traffic_density"] == pytest.approx(0.88)
    assert breakdown["criteria_scores"]["socioeconomic"] == pytest.approx(0.76)
    assert breakdown["priority_vector"]["traffic_density"] == pytest.approx(0.15)
    assert breakdown["priority_vector"]["socioeconomic"] == pytest.approx(0.1)


def test_calculate_results_queries_nearby_nfz_outside_selected_bbox(monkeypatch) -> None:
    service = AnalysisService()
    captured_bbox = None

    def _fake_list_nfz_geojson_in_bbox(bbox):
        nonlocal captured_bbox
        captured_bbox = bbox
        return []

    monkeypatch.setattr(analysis_service, "list_nfz_geojson_in_bbox", _fake_list_nfz_geojson_in_bbox)

    rows = service._calculate_results(
        geodata_job={
            "bounding_box": {"west": 29.10, "east": 29.12, "south": 41.00, "north": 41.02},
            "layer_counts": {
                "buildings": 50,
                "roads": 45,
                "land_use": 8,
                "nfz": 0,
            },
        },
        cells=["881ec90249fffff", "881ec910b5fffff"],
        weights={"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
    )

    assert rows
    assert captured_bbox is not None
    assert captured_bbox.west < 29.10
    assert captured_bbox.east > 29.12
    assert captured_bbox.south < 41.00
    assert captured_bbox.north > 41.02


def test_multi_alternative_total_score_uses_topsis_closeness() -> None:
    rows = analysis_service._run_topsis(
        rows=[
            {
                "cell_index": "cell-a",
                "criteria_scores": {"obstacle": 0.82, "transport": 0.51, "land_use": 0.55, "nfz": 1.0},
                "criteria_context": {},
                "decision_values": {"obstacle": 0.18, "transport": 0.51, "land_use": 0.55, "nfz": 1.0},
                "geometry": None,
            },
            {
                "cell_index": "cell-b",
                "criteria_scores": {"obstacle": 0.60, "transport": 0.72, "land_use": 0.68, "nfz": 0.35},
                "criteria_context": {},
                "decision_values": {"obstacle": 0.40, "transport": 0.72, "land_use": 0.68, "nfz": 0.35},
                "geometry": None,
            },
        ],
        weights={"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
    )

    assert len(rows) == 2
    for row in rows:
        breakdown = row["criteria_breakdown"]
        assert breakdown["display_score_method"] == "TOPSIS_CLOSENESS"
        assert breakdown["priority_vector"]["transport"] == pytest.approx(0.25)
        assert row["suitability_score"] == round(breakdown["topsis_closeness"] * 100.0, 2)


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


def test_get_analysis_result_handles_zero_weight_metadata(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 8,
            "status": "completed",
            "region_name": "Istanbul",
            "criteria_weights": {"obstacle": 0.0, "transport": 0.5, "land_use": 0.3, "nfz": 0.2},
        },
    )
    monkeypatch.setattr(
        analysis_repo,
        "summarize_results",
        lambda _analysis_id: {"cell_count": 1, "average_score": 80.0, "max_score": 80.0, "min_score": 80.0},
    )
    monkeypatch.setattr(
        analysis_repo,
        "list_results",
        lambda _analysis_id, **_kwargs: [
            {
                "cell_index": "cell-1",
                "suitability_score": 80.0,
                "criteria_breakdown": {"obstacle": 0.0, "transport": 0.8, "land_use": 0.7, "nfz": 1.0},
            }
        ],
    )

    response = client.get("/api/analysis/8/result")

    assert response.status_code == 200
    assert response.json()["mcdm"]["pairwise_matrix"]


def test_save_analysis_to_profile(monkeypatch) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 12,
            "user_id": 1,
            "status": "completed",
            "region_name": "Kadikoy",
            "criteria_weights": {"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
        },
    )
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(
        analysis_repo,
        "save_analysis",
        lambda _analysis_id, **_kwargs: {
            "id": 12,
            "saved_name": _kwargs["saved_name"],
            "saved_payload": _kwargs["saved_payload"],
            "saved_at": now,
        },
    )

    response = client.post(
        "/api/analysis/12/save",
        json={
            "name": "Kadikoy 2026 UAM Plan",
            "map_view": {"center": [29.03, 40.99], "zoom": 12.5},
            "selected_bounds": {"west": 29.0, "east": 29.04, "south": 40.97, "north": 41.01},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_id"] == 12
    assert body["saved_name"] == "Kadikoy 2026 UAM Plan"


def test_get_analysis_history_returns_saved_items(monkeypatch) -> None:
    _as_user("expert")
    now = datetime.now(timezone.utc)
    monkeypatch.setattr(
        analysis_repo,
        "list_saved_analyses",
        lambda _user_id: [
            {
                "id": 21,
                "region_name": "Besiktas",
                "status": "completed",
                "created_at": now,
                "saved_name": "Besiktas Plan",
                "saved_at": now,
                "saved_payload": {"selected_bounds": {"west": 28.99}},
            }
        ],
    )
    monkeypatch.setattr(
        analysis_repo,
        "summarize_results",
        lambda _analysis_id: {"cell_count": 4, "average_score": 77.0, "max_score": 91.0, "min_score": 44.0},
    )

    response = client.get("/api/analysis/history")

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["saved_name"] == "Besiktas Plan"
    assert body["items"][0]["suitability_score"] == 91.0


def test_export_analysis_returns_download_metadata(monkeypatch, tmp_path) -> None:
    _as_user("expert")
    monkeypatch.setattr(
        analysis_repo,
        "get_analysis",
        lambda _analysis_id: {
            "id": 31,
            "user_id": 1,
            "status": "completed",
            "region_name": "Uskudar",
            "saved_name": "Uskudar Saved",
            "criteria_weights": {"obstacle": 0.35, "transport": 0.25, "land_use": 0.2, "nfz": 0.2},
        },
    )
    monkeypatch.setattr(
        AnalysisService,
        "get_heatmap",
        lambda _self, _analysis_id: {"type": "FeatureCollection", "features": []},
    )
    monkeypatch.setattr(
        analysis_service,
        "EXPORTS_DIR",
        tmp_path,
    )
    monkeypatch.setattr(
        analysis_service.report_repo,
        "create_report",
        lambda **_kwargs: {"id": 501, **_kwargs},
    )

    response = client.get("/api/analysis/31/export?format=geojson")

    assert response.status_code == 200
    body = response.json()
    assert body["report_id"] == 501
    assert body["download_url"] == "/api/analysis/reports/501/download"
    assert body["file_name"].endswith(".geojson")
