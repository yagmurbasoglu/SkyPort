from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from app.api import deps
from app.api.routes import vertiports as vertiports_route
from app.main import app
from app.repos import route_repo
from app.services.weather_service import WeatherService

client = TestClient(app)


def _user(role: str = "passenger") -> SimpleNamespace:
    return SimpleNamespace(id=11, role=role, is_active=True)


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def _route_repo_stubs(monkeypatch):
    stored: dict[int, dict] = {}

    def create_route(**kwargs):
        route = {
            "id": 42,
            "user_id": kwargs["user_id"],
            "from_vertiport_id": kwargs["from_vertiport_id"],
            "to_vertiport_id": kwargs["to_vertiport_id"],
            "status": kwargs.get("status", "simulated"),
            "distance_km": round(kwargs["distance_km"], 2),
            "duration_min": kwargs["duration_min"],
            "price_tl": kwargs["price_tl"],
            "weather_snapshot": kwargs["weather_snapshot"],
            "coordinates": kwargs["coordinates"],
            "geojson": {"type": "LineString", "coordinates": kwargs["coordinates"]},
            "created_at": datetime.now(timezone.utc),
        }
        stored[42] = route
        return route

    def get_route(route_id: int, user_id: int | None = None):
        route = stored.get(route_id)
        if route is None:
            return None
        if user_id is not None and route["user_id"] != user_id:
            return None
        return route

    def update_route_status(route_id: int, status: str):
        stored[route_id]["status"] = status
        return stored[route_id]

    monkeypatch.setattr(route_repo, "create_route", create_route)
    monkeypatch.setattr(route_repo, "get_route", get_route)
    monkeypatch.setattr(route_repo, "update_route_status", update_route_status)
    monkeypatch.setattr(route_repo, "count_nfz_intersections_for_coordinates", lambda _coordinates: 0)
    monkeypatch.setattr(route_repo, "point_within_nfz", lambda _longitude, _latitude: False)
    monkeypatch.setattr(route_repo, "list_nfz_intersections_for_coordinates", lambda _coordinates: [])
    monkeypatch.setattr(route_repo, "list_nfz_intersections", lambda _route_id: [])
    monkeypatch.setattr(route_repo, "list_controlled_airspace_intersections_for_coordinates", lambda _coordinates: [])
    monkeypatch.setattr(route_repo, "list_controlled_airspace_intersections", lambda _route_id: [])
    monkeypatch.setattr(route_repo, "load_recent_building_obstacles", lambda: [])
    monkeypatch.setattr(
        route_repo,
        "list_building_obstacle_intersections_for_coordinates",
        lambda _coordinates, max_hits=10, obstacle_features=None: [],
    )
    monkeypatch.setattr(route_repo, "list_building_obstacle_intersections", lambda _route_id: [])
    monkeypatch.setattr(
        WeatherService,
        "get_route_weather",
        lambda _self, _coordinates, max_wind_kmh: {
            "source": "fallback",
            "condition": "standard",
            "wind_kmh": 12.0,
            "wind_direction_deg": None,
            "wind_gusts_kmh": None,
            "wind_80m_kmh": 12.0,
            "wind_80m_direction_deg": None,
            "wind_120m_kmh": 12.0,
            "wind_120m_direction_deg": None,
            "temperature_2m_c": None,
            "precipitation_mm": None,
            "visibility_m": None,
            "weather_code": None,
            "is_fallback": True,
            "is_safe": 12.0 <= max_wind_kmh,
            "warning": "Live weather data could not be obtained; standard conditions are applied.",
        },
    )
    return stored


def _as_user(role: str = "passenger") -> None:
    app.dependency_overrides[deps.get_current_active_user] = lambda: _user(role)


def _point_payload() -> dict:
    return {
        "from_point": {"lat": 41.0369, "lng": 28.985, "name": "Taksim"},
        "to_point": {"lat": 41.022, "lng": 29.0151, "name": "Uskudar"},
        "constraints": {"avoid_nfz": True, "avoid_obstacles": True, "max_wind_kmh": 35},
    }


def test_create_route_from_points_returns_simulation_payload(_route_repo_stubs) -> None:
    _as_user("passenger")

    response = client.post("/api/route", json=_point_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["route_id"] == 42
    assert body["safety_status"] == "warning"
    assert body["is_safe"] is True
    assert body["obstacle_data_status"] == "missing"
    assert body["obstacle_feature_count"] == 0
    assert body["blocking_type"] is None
    assert body["blocking_reason"] is None
    assert len(body["coordinates"]) >= 2
    assert body["distance_km"] > 0
    assert body["duration_min"] >= 3
    assert body["price_tl"] > 0
    assert body["weather"]["source"] == "fallback"
    assert body["weather"]["wind_80m_kmh"] == 12.0
    assert body["weather"]["wind_120m_kmh"] == 12.0
    assert "geodata ingest" in " ".join(body["warnings"])


def test_create_route_rejects_missing_destination() -> None:
    _as_user("passenger")

    response = client.post("/api/route", json={"from_point": {"lat": 41.0, "lng": 29.0}})

    assert response.status_code == 422


def test_create_route_checks_nfz_edges_before_selecting_route(monkeypatch, _route_repo_stubs) -> None:
    _as_user("passenger")
    calls = {"count": 0}

    def count_hits(_coordinates):
        calls["count"] += 1
        return 1 if calls["count"] == 1 else 0

    monkeypatch.setattr(route_repo, "count_nfz_intersections_for_coordinates", count_hits)

    response = client.post("/api/route", json=_point_payload())

    assert response.status_code == 200
    assert calls["count"] >= 2
    assert response.json()["route_id"] == 42


def test_create_route_uses_astar_grid_when_direct_edge_is_blocked(monkeypatch, _route_repo_stubs) -> None:
    _as_user("passenger")
    calls = {"count": 0}

    def count_hits(coordinates):
        calls["count"] += 1
        start, end = coordinates[0], coordinates[-1]
        crosses_middle = start[0] < 29.0 < end[0] or end[0] < 29.0 < start[0]
        near_direct_corridor = abs(start[1] - 41.0) < 0.015 and abs(end[1] - 41.0) < 0.015
        return 1 if crosses_middle and near_direct_corridor else 0

    monkeypatch.setattr(route_repo, "count_nfz_intersections_for_coordinates", count_hits)
    payload = {
        "from_point": {"lat": 41.0, "lng": 28.98, "name": "West"},
        "to_point": {"lat": 41.0, "lng": 29.02, "name": "East"},
        "constraints": {"avoid_nfz": True, "avoid_obstacles": False, "max_wind_kmh": 35},
    }

    response = client.post("/api/route", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert len(body["coordinates"]) > 3
    assert calls["count"] > 2


def test_create_route_checks_obstacle_edges_before_selecting_route(monkeypatch, _route_repo_stubs) -> None:
    _as_user("passenger")
    calls = {"count": 0}
    obstacle_features = [{"geometry": object(), "zone_name": "Tower", "job_id": "job-1"}]

    monkeypatch.setattr(route_repo, "load_recent_building_obstacles", lambda: obstacle_features)

    def obstacle_hits(coordinates, *, max_hits=10, obstacle_features=None):
        calls["count"] += 1
        start, end = coordinates[0], coordinates[-1]
        crosses_middle = start[0] < 29.0 < end[0] or end[0] < 29.0 < start[0]
        near_direct_corridor = abs(start[1] - 41.0) < 0.015 and abs(end[1] - 41.0) < 0.015
        if obstacle_features and crosses_middle and near_direct_corridor:
            return [
                {
                    "id": None,
                    "zone_name": "Tower obstacle",
                    "route_progress": 0.5,
                    "block_point": {"type": "Point", "coordinates": [29.0, 41.0]},
                }
            ]
        return []

    monkeypatch.setattr(
        route_repo,
        "list_building_obstacle_intersections_for_coordinates",
        obstacle_hits,
    )

    payload = {
        "from_point": {"lat": 41.0, "lng": 28.98, "name": "West"},
        "to_point": {"lat": 41.0, "lng": 29.02, "name": "East"},
        "constraints": {"avoid_nfz": False, "avoid_obstacles": True, "max_wind_kmh": 35},
    }

    response = client.post("/api/route", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["safety_status"] == "blocked"
    assert body["blocking_type"] == "obstacle"
    assert body["obstacle_data_status"] == "available"
    assert len(body["coordinates"]) > 3
    assert calls["count"] > 2


def test_safety_check_marks_nfz_intersection_unsafe(monkeypatch, _route_repo_stubs) -> None:
    _as_user("expert")
    client.post("/api/route", json=_point_payload())
    monkeypatch.setattr(
        route_repo,
        "list_nfz_intersections",
        lambda _route_id: [
            {
                "id": 5,
                "zone_name": "Test NFZ",
                "zone_code": "NFZ-1",
                "route_progress": 0.42,
                "block_point": {"type": "Point", "coordinates": [29.0, 41.0]},
            }
        ],
    )

    response = client.post("/api/route/42/safety-check")

    assert response.status_code == 200
    body = response.json()
    assert body["safety_status"] == "blocked"
    assert body["is_safe"] is False
    assert body["blocking_type"] == "nfz"
    assert body["blocking_reason"] == "Blocked by no-fly zone."
    assert body["stop_progress"] == 0.42
    assert body["stop_point"] == [29.0, 41.0]
    assert body["conflicts"][0]["type"] == "nfz"
    assert body["conflicts"][0]["severity"] == "blocker"
    assert body["conflicts"][0]["route_progress"] == 0.42
    assert body["conflicts"][0]["block_point"] == [29.0, 41.0]


def test_safety_check_marks_building_obstacle_intersection_unsafe(monkeypatch, _route_repo_stubs) -> None:
    _as_user("expert")
    client.post("/api/route", json=_point_payload())
    monkeypatch.setattr(
        route_repo,
        "list_building_obstacle_intersections",
        lambda _route_id: [
            {
                "id": None,
                "zone_name": "Hospital roof obstacle",
                "route_progress": 0.35,
                "block_point": {"type": "Point", "coordinates": [28.99, 41.03]},
            }
        ],
    )

    response = client.post("/api/route/42/safety-check")

    assert response.status_code == 200
    body = response.json()
    assert body["safety_status"] == "blocked"
    assert body["is_safe"] is False
    assert body["blocking_type"] == "obstacle"
    assert body["blocking_reason"] == "Blocked by obstacle geometry."
    assert body["stop_progress"] == 0.35
    assert body["stop_point"] == [28.99, 41.03]
    assert body["conflicts"][0]["type"] == "obstacle"
    assert body["conflicts"][0]["zone_name"] == "Hospital roof obstacle"
    assert body["conflicts"][0]["route_progress"] == 0.35
    assert body["conflicts"][0]["block_point"] == [28.99, 41.03]


def test_safety_check_keeps_controlled_airspace_as_warning(monkeypatch, _route_repo_stubs) -> None:
    _as_user("expert")
    client.post("/api/route", json=_point_payload())
    monkeypatch.setattr(
        route_repo,
        "list_controlled_airspace_intersections",
        lambda _route_id: [
            {
                "id": 3,
                "zone_name": "CTR Blue Zone",
                "zone_code": "CTR-1",
            }
        ],
    )

    response = client.post("/api/route/42/safety-check")

    assert response.status_code == 200
    body = response.json()
    assert body["safety_status"] == "warning"
    assert body["is_safe"] is True
    assert body["blocking_type"] is None
    assert body["obstacle_data_status"] == "missing"
    assert body["conflicts"][0]["type"] == "controlled_airspace"
    assert body["conflicts"][0]["severity"] == "warning"


def test_create_route_reports_obstacle_data_availability(monkeypatch, _route_repo_stubs) -> None:
    _as_user("passenger")
    monkeypatch.setattr(
        route_repo,
        "load_recent_building_obstacles",
        lambda: [{"geometry": object(), "zone_name": "Tower obstacle", "job_id": "job-1"}],
    )

    response = client.post("/api/route", json=_point_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["obstacle_data_status"] == "available"
    assert body["obstacle_feature_count"] == 1


def test_create_route_marks_weather_blocked(monkeypatch, _route_repo_stubs) -> None:
    _as_user("passenger")
    monkeypatch.setattr(
        WeatherService,
        "get_route_weather",
        lambda _self, _coordinates, _max_wind_kmh: {
            "source": "open_meteo",
            "condition": "windy",
            "wind_kmh": 48.0,
            "wind_direction_deg": None,
            "wind_gusts_kmh": 55.0,
            "wind_80m_kmh": 50.0,
            "wind_80m_direction_deg": None,
            "wind_120m_kmh": 52.0,
            "wind_120m_direction_deg": None,
            "temperature_2m_c": None,
            "precipitation_mm": None,
            "visibility_m": None,
            "weather_code": None,
            "is_fallback": False,
            "is_safe": False,
            "warning": "Wind levels exceed the configured limit.",
        },
    )

    response = client.post("/api/route", json=_point_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["safety_status"] == "blocked"
    assert body["is_safe"] is False
    assert body["blocking_type"] == "weather"
    assert "Blocked by weather conditions" in body["blocking_reason"]
    assert "55.0 km/h" in body["blocking_reason"]
    assert "35.0 km/h" in body["blocking_reason"]
    assert body["stop_progress"] == 0.06
    assert body["stop_point"] == body["coordinates"][0]


def test_route_simulation_returns_geojson(_route_repo_stubs) -> None:
    _as_user("passenger")
    client.post("/api/route", json=_point_payload())

    response = client.get("/api/route/42/simulation")

    assert response.status_code == 200
    body = response.json()
    assert body["route_id"] == 42
    assert body["geojson"]["type"] == "Feature"
    assert body["geojson"]["geometry"]["type"] == "LineString"


def test_route_requires_authentication() -> None:
    response = client.post("/api/route", json=_point_payload())

    assert response.status_code in {401, 403}


def test_list_active_vertiports_returns_db_payload(monkeypatch) -> None:
    _as_user("passenger")
    monkeypatch.setattr(
        vertiports_route,
        "list_active_vertiports",
        lambda **_kwargs: [
            {
                "id": 7,
                "name": "DB Vertiport",
                "lat": 41.01,
                "lng": 29.02,
                "suitability_score": 88.5,
                "price_per_km": 3.2,
                "description": "Active test vertiport",
                "features": ["metro", "low_noise"],
                "noise_level": "low",
                "distance_from_center_km": 4.2,
                "is_active": True,
            }
        ],
    )

    response = client.get("/api/vertiports")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["id"] == 7
    assert body[0]["lat"] == 41.01
    assert body[0]["is_active"] is True
    assert body[0]["features"] == ["metro", "low_noise"]
    assert body[0]["distance_from_center_km"] == 4.2


def test_list_active_vertiports_accepts_advanced_filters(monkeypatch) -> None:
    _as_user("passenger")
    seen = {}

    def fake_repo(**kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(vertiports_route, "list_active_vertiports", fake_repo)

    response = client.get(
        "/api/vertiports?min_score=80&max_price=250&max_distance_km=5&center_lat=41.03&center_lng=28.98&low_noise=true&metro=true&parking=true&ev_charging=true"
    )

    assert response.status_code == 200
    assert seen["min_score"] == 80
    assert seen["max_price"] == 250
    assert seen["max_distance_km"] == 5
    assert seen["center_lat"] == 41.03
    assert seen["center_lng"] == 28.98
    assert seen["low_noise"] is True
    assert seen["metro"] is True
    assert seen["parking"] is True
    assert seen["ev_charging"] is True
