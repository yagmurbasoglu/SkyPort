from types import SimpleNamespace

from app.schemas.geodata import BoundingBox
from app.services import criteria_data_service


def test_load_ibb_traffic_layer_uses_live_api_when_no_file_or_url(monkeypatch) -> None:
    monkeypatch.setattr(
        criteria_data_service,
        "get_settings",
        lambda: SimpleNamespace(
            ibb_traffic_enabled=True,
            ibb_traffic_geojson_path=None,
            ibb_traffic_geojson_url=None,
            ibb_traffic_timeout_sec=5.0,
        ),
    )

    def fake_load_json(url: str, _timeout_sec: float):
        if url == criteria_data_service.IBB_TRAFFIC_SEGMENT_DATA_URL:
            return {
                "Date": "2026-05-19T23:42:00+03:00",
                "Data": [
                    {"T": "FD", "S": 245, "V": 35, "C": 2, "D": "23:42"},
                ],
            }
        if url == criteria_data_service.IBB_TRAFFIC_SEGMENT_GEOMETRY_URL:
            return [
                {
                    "S": 245,
                    "G": "[[41.0247954,28.5908378],[41.0246954,28.5908283],[41.024623,28.5908824]]",
                    "Z": "BUYUKCEKMECE",
                }
            ]
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(criteria_data_service, "_load_json_from_url", fake_load_json)

    layer, warnings = criteria_data_service.load_ibb_traffic_layer(
        BoundingBox(west=28.58, east=28.61, south=41.02, north=41.03)
    )

    assert warnings == []
    assert layer["source_kind"] == "official_live_api"
    assert layer["total"] == 1
    assert layer["features"][0]["properties"]["segment_id"] == 245
    assert layer["features"][0]["properties"]["official_traffic_score"] == 0.35


def test_build_tuik_socioeconomic_layer_uses_live_api_when_no_csv_config(monkeypatch) -> None:
    monkeypatch.setattr(
        criteria_data_service,
        "get_settings",
        lambda: SimpleNamespace(
            tuik_population_enabled=True,
            tuik_population_csv_path=None,
            tuik_population_csv_url=None,
            tuik_population_timeout_sec=5.0,
        ),
    )

    def fake_load_json(url: str, _timeout_sec: float):
        if url == criteria_data_service.TUIK_DISTRICT_GEOMETRY_URL:
            return {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[28.85, 40.97], [28.99, 40.97], [28.99, 41.05], [28.85, 41.05], [28.85, 40.97]]],
                        },
                        "properties": {"duzeyKodu": "110", "name": "BAKIRKÖY", "bolgeKodu": "TR10"},
                    },
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[32.7, 39.85], [32.9, 39.85], [32.9, 40.0], [32.7, 40.0], [32.7, 39.85]]],
                        },
                        "properties": {"duzeyKodu": "999", "name": "ANKARA TEST", "bolgeKodu": "TR51"},
                    },
                ],
            }
        if url == criteria_data_service.TUIK_TOTAL_POPULATION_URL:
            return {
                "tarihler": ["2025", "2024"],
                "veriler": [
                    {"duzeyKodu": "110", "veri": ["214977", "214100"]},
                    {"duzeyKodu": "999", "veri": ["500000", "499000"]},
                ],
            }
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(criteria_data_service, "_load_json_from_url", fake_load_json)

    layer, warnings = criteria_data_service.build_tuik_socioeconomic_layer(
        {"type": "FeatureCollection", "features": []}
    )

    assert warnings == []
    assert layer["source_kind"] == "official_live_api"
    assert layer["total"] == 1
    assert layer["features"][0]["properties"]["district_name"] == "BAKIRKÖY"
    assert layer["features"][0]["properties"]["official_population_total"] == 214977.0
    assert layer["features"][0]["properties"]["official_population_year"] == "2025"
