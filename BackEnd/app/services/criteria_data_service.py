import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

import httpx
from shapely.geometry import LineString, box, mapping, shape

from app.core.config import get_settings
from app.schemas.geodata import BoundingBox

IBB_TRAFFIC_SEGMENT_DATA_URL = "https://tkmservices.ibb.gov.tr/web/api/TrafficData/v4/SegmentData"
IBB_TRAFFIC_SEGMENT_GEOMETRY_URL = "https://tkmservices.ibb.gov.tr/web/api/TrafficData/v3/Segments/1"
TUIK_DISTRICT_GEOMETRY_URL = "https://cip.tuik.gov.tr/assets/geometri/nuts4.json"
TUIK_TOTAL_POPULATION_URL = (
    "https://cip.tuik.gov.tr/Home/GetMapData"
    "?kaynak=medas&duzey=4&gostergeNo=ADNKS-GK137473-O29001&kayitSayisi=5&period=yillik"
)
ISTANBUL_BBOX = BoundingBox(west=28.45, east=29.95, south=40.75, north=41.65)


def _empty_feature_collection(*, source: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "FeatureCollection",
        "features": [],
        "total": 0,
        "truncated": False,
    }
    if source:
        payload["source"] = source
    return payload


def _resolve_path(path_value: str) -> Path:
    candidate = Path(path_value).expanduser()
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate
    return candidate.resolve()


def _load_text_from_source(
    *,
    path_value: str | None,
    url_value: str | None,
    timeout_sec: float,
) -> tuple[str | None, str | None]:
    if path_value:
        path = _resolve_path(path_value)
        if not path.exists():
            return None, f"Configured file not found: {path.name}"
        return path.read_text(encoding="utf-8"), "file"
    if url_value:
        response = httpx.get(url_value, timeout=timeout_sec)
        response.raise_for_status()
        return response.text, "url"
    return None, None


def _load_json_from_url(url: str, timeout_sec: float) -> Any:
    response = httpx.get(url, timeout=timeout_sec, headers={"User-Agent": "SkyPort/1.0"})
    response.raise_for_status()
    return response.json()


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if numeric == numeric else None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("%", "")
    text = text.replace(" ", "")
    if text.count(",") == 1 and text.count(".") >= 1:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(",") == 1 and text.count(".") == 0:
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")
    try:
        numeric = float(text)
    except ValueError:
        return None
    return numeric if numeric == numeric else None


def _normalize_score(value: float) -> float:
    if value <= 1.0:
        return max(0.0, min(1.0, value))
    if value <= 10.0:
        return max(0.0, min(1.0, value / 10.0))
    if value <= 100.0:
        return max(0.0, min(1.0, value / 100.0))
    return max(0.0, min(1.0, value / 1000.0))


def _normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_only = ascii_only.lower()
    ascii_only = re.sub(r"\b(ilcesi|ilcesi belediyesi|ilce|district|belediyesi|municipality)\b", " ", ascii_only)
    ascii_only = re.sub(r"[^a-z0-9]+", " ", ascii_only)
    return " ".join(part for part in ascii_only.split() if part)


def _get_feature_name(properties: dict[str, Any]) -> str | None:
    for key in ("name", "name:tr", "official_name", "district", "district_name", "ilce", "ilce_adi"):
        value = properties.get(key)
        if value:
            return str(value).strip()
    return None


def _extract_traffic_score(properties: dict[str, Any]) -> tuple[float | None, str | None]:
    candidate_keys = (
        "traffic_density",
        "density",
        "congestion",
        "congestion_level",
        "jam_factor",
        "traffic_index",
        "intensity",
        "score",
        "value",
    )
    for key in candidate_keys:
        numeric = _safe_float(properties.get(key))
        if numeric is not None:
            return _normalize_score(numeric), key
    return None, None


def _parse_ibb_segment_geometry(geometry_text: str) -> LineString | None:
    if not geometry_text:
        return None
    try:
        lat_lng_pairs = json.loads(geometry_text)
    except json.JSONDecodeError:
        return None
    coordinates: list[tuple[float, float]] = []
    for pair in lat_lng_pairs:
        if not isinstance(pair, list | tuple) or len(pair) < 2:
            continue
        latitude = _safe_float(pair[0])
        longitude = _safe_float(pair[1])
        if latitude is None or longitude is None:
            continue
        coordinates.append((longitude, latitude))
    if len(coordinates) < 2:
        return None
    try:
        return LineString(coordinates)
    except Exception:
        return None


def _load_ibb_live_traffic_layer(bbox: BoundingBox, timeout_sec: float) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    bbox_polygon = box(bbox.west, bbox.south, bbox.east, bbox.north)
    try:
        segment_data_payload = _load_json_from_url(IBB_TRAFFIC_SEGMENT_DATA_URL, timeout_sec)
        segment_geometry_payload = _load_json_from_url(IBB_TRAFFIC_SEGMENT_GEOMETRY_URL, timeout_sec)
    except Exception as exc:
        return _empty_feature_collection(source="ibb_official"), [
            f"IBB live traffic API unavailable: {exc.__class__.__name__}"
        ]

    segment_rows = []
    if isinstance(segment_data_payload, dict):
        segment_rows = segment_data_payload.get("Data") or []
    geometry_rows = segment_geometry_payload if isinstance(segment_geometry_payload, list) else []
    if not isinstance(segment_rows, list) or not isinstance(geometry_rows, list):
        return _empty_feature_collection(source="ibb_official"), [
            "IBB live traffic API returned an unexpected payload."
        ]

    values_by_segment: dict[int, dict[str, Any]] = {}
    for row in segment_rows:
        if not isinstance(row, dict):
            continue
        segment_id = row.get("S")
        if segment_id is None:
            continue
        try:
            normalized_segment_id = int(segment_id)
        except (TypeError, ValueError):
            continue
        values_by_segment[normalized_segment_id] = row

    features: list[dict[str, Any]] = []
    skipped_without_match = 0
    skipped_without_geometry = 0
    for row in geometry_rows:
        if not isinstance(row, dict):
            continue
        segment_id = row.get("S")
        try:
            normalized_segment_id = int(segment_id)
        except (TypeError, ValueError):
            continue
        live_values = values_by_segment.get(normalized_segment_id)
        if live_values is None:
            skipped_without_match += 1
            continue
        geometry = _parse_ibb_segment_geometry(str(row.get("G") or ""))
        if geometry is None:
            skipped_without_geometry += 1
            continue
        if geometry.is_empty or not geometry.intersects(bbox_polygon):
            continue
        traffic_value = _safe_float(live_values.get("V"))
        if traffic_value is None:
            skipped_without_match += 1
            continue
        score = _normalize_score(traffic_value)
        properties = {
            "segment_id": normalized_segment_id,
            "district_name": row.get("Z"),
            "density": traffic_value,
            "traffic_density": traffic_value,
            "official_traffic_score": round(score, 6),
            "official_traffic_property": "V",
            "official_traffic_category": live_values.get("C"),
            "official_traffic_type": live_values.get("T"),
            "official_traffic_clock": live_values.get("D"),
            "official_traffic_timestamp": (
                segment_data_payload.get("Date") if isinstance(segment_data_payload, dict) else None
            ),
        }
        features.append(
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": properties,
            }
        )

    if skipped_without_match:
        warnings.append(
            f"IBB live traffic API skipped {skipped_without_match} segments without a matching live density value."
        )
    if skipped_without_geometry:
        warnings.append(
            f"IBB live traffic API skipped {skipped_without_geometry} segments with unreadable geometry."
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
        "truncated": False,
        "source": "ibb_official",
        "source_kind": "official_live_api",
    }, warnings


def load_ibb_traffic_layer(bbox: BoundingBox) -> tuple[dict[str, Any], list[str]]:
    settings = get_settings()
    if not settings.ibb_traffic_enabled:
        return _empty_feature_collection(source="ibb_official"), []

    warnings: list[str] = []
    try:
        raw_text, source_kind = _load_text_from_source(
            path_value=settings.ibb_traffic_geojson_path,
            url_value=settings.ibb_traffic_geojson_url,
            timeout_sec=settings.ibb_traffic_timeout_sec,
        )
    except Exception as exc:
        return _empty_feature_collection(source="ibb_official"), [
            f"IBB traffic layer unavailable: {exc.__class__.__name__}"
        ]

    if not raw_text:
        return _load_ibb_live_traffic_layer(bbox, settings.ibb_traffic_timeout_sec)

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        return _empty_feature_collection(source="ibb_official"), [
            "IBB traffic source could not be parsed as GeoJSON."
        ]

    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list):
        return _empty_feature_collection(source="ibb_official"), [
            "IBB traffic source did not contain a GeoJSON FeatureCollection."
        ]

    bbox_polygon = box(bbox.west, bbox.south, bbox.east, bbox.north)
    kept_features: list[dict[str, Any]] = []
    skipped_without_score = 0
    for feature in features:
        geometry_payload = (feature or {}).get("geometry")
        if not geometry_payload:
            continue
        try:
            geometry = shape(geometry_payload)
        except Exception:
            continue
        if geometry.is_empty or not geometry.intersects(bbox_polygon):
            continue
        properties = dict((feature or {}).get("properties") or {})
        score, source_property = _extract_traffic_score(properties)
        if score is None:
            skipped_without_score += 1
            continue
        properties["official_traffic_score"] = round(score, 6)
        properties["official_traffic_property"] = source_property
        kept_features.append(
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": properties,
            }
        )

    if skipped_without_score:
        warnings.append(
            f"IBB traffic layer skipped {skipped_without_score} features without a supported density property."
        )

    return {
        "type": "FeatureCollection",
        "features": kept_features,
        "total": len(kept_features),
        "truncated": False,
        "source": "ibb_official",
        "source_kind": source_kind,
    }, warnings


def _detect_csv_columns(rows: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    if not rows:
        return None, None
    sample_keys = {str(key).strip().lower(): key for key in rows[0].keys()}
    district_candidates = (
        "district",
        "district_name",
        "districtname",
        "ilce",
        "ilce_adi",
        "ilce adı",
        "name",
    )
    population_candidates = (
        "population",
        "population_total",
        "total_population",
        "nufus",
        "nufus_toplam",
        "toplam_nufus",
        "toplam nüfus",
        "adnks_population",
    )
    district_column = next((sample_keys[key] for key in district_candidates if key in sample_keys), None)
    population_column = next((sample_keys[key] for key in population_candidates if key in sample_keys), None)
    return district_column, population_column


def _build_population_lookup(rows: list[dict[str, Any]]) -> tuple[dict[str, float], str | None, str | None]:
    district_column, population_column = _detect_csv_columns(rows)
    if not district_column or not population_column:
        return {}, district_column, population_column

    lookup: dict[str, float] = {}
    for row in rows:
        district_value = row.get(district_column)
        population_value = _safe_float(row.get(population_column))
        if not district_value or population_value is None:
            continue
        normalized_name = _normalize_name(str(district_value))
        if not normalized_name:
            continue
        lookup[normalized_name] = population_value
    return lookup, str(district_column), str(population_column)


def _bbox_polygon_from_district_layer(district_layer: dict[str, Any]) -> Any:
    geometries = []
    for feature in (district_layer.get("features") or []):
        geometry_payload = (feature or {}).get("geometry")
        if not geometry_payload:
            continue
        try:
            geometry = shape(geometry_payload)
        except Exception:
            continue
        if not geometry.is_empty:
            geometries.append(geometry)
    if geometries:
        min_x = min(geometry.bounds[0] for geometry in geometries)
        min_y = min(geometry.bounds[1] for geometry in geometries)
        max_x = max(geometry.bounds[2] for geometry in geometries)
        max_y = max(geometry.bounds[3] for geometry in geometries)
        return box(min_x, min_y, max_x, max_y)
    return box(ISTANBUL_BBOX.west, ISTANBUL_BBOX.south, ISTANBUL_BBOX.east, ISTANBUL_BBOX.north)


def _build_live_tuik_socioeconomic_layer(district_layer: dict[str, Any], timeout_sec: float) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    try:
        geometry_payload = _load_json_from_url(TUIK_DISTRICT_GEOMETRY_URL, timeout_sec)
        data_payload = _load_json_from_url(TUIK_TOTAL_POPULATION_URL, timeout_sec)
    except Exception as exc:
        return _empty_feature_collection(source="tuik_official"), [
            f"TUIK live population API unavailable: {exc.__class__.__name__}"
        ]

    geometry_features = geometry_payload.get("features") if isinstance(geometry_payload, dict) else None
    yearly_values = data_payload.get("veriler") if isinstance(data_payload, dict) else None
    years = data_payload.get("tarihler") if isinstance(data_payload, dict) else None
    if not isinstance(geometry_features, list) or not isinstance(yearly_values, list):
        return _empty_feature_collection(source="tuik_official"), [
            "TUIK live population API returned an unexpected payload."
        ]

    latest_year = str(years[0]) if isinstance(years, list) and years else None
    population_by_code: dict[str, float] = {}
    for row in yearly_values:
        if not isinstance(row, dict):
            continue
        code = str(row.get("duzeyKodu") or "").strip()
        values = row.get("veri") or []
        if not code or not isinstance(values, list) or not values:
            continue
        latest_population = _safe_float(values[0])
        if latest_population is None:
            continue
        population_by_code[code] = latest_population

    bbox_polygon = _bbox_polygon_from_district_layer(district_layer)
    matched: list[dict[str, Any]] = []
    for feature in geometry_features:
        if not isinstance(feature, dict):
            continue
        geometry_payload = feature.get("geometry")
        if not geometry_payload:
            continue
        try:
            geometry = shape(geometry_payload)
        except Exception:
            continue
        if geometry.is_empty or not geometry.intersects(bbox_polygon):
            continue
        properties = dict(feature.get("properties") or {})
        district_code = str(properties.get("duzeyKodu") or "").strip()
        population_total = population_by_code.get(district_code)
        if population_total is None:
            continue
        district_name = _get_feature_name(properties) or district_code
        matched.append(
            {
                "geometry": geometry,
                "district_name": district_name,
                "district_code": district_code,
                "population_total": population_total,
                "properties": properties,
            }
        )

    if not matched:
        return _empty_feature_collection(source="tuik_official"), [
            "No official TUIK district population rows matched the Istanbul analysis area."
        ]

    populations = [item["population_total"] for item in matched]
    minimum = min(populations)
    maximum = max(populations)
    span = maximum - minimum

    features: list[dict[str, Any]] = []
    for item in matched:
        normalized_score = 0.7 if span <= 0 else (item["population_total"] - minimum) / span
        properties = dict(item["properties"])
        properties["district_name"] = item["district_name"]
        properties["official_population_total"] = round(item["population_total"], 3)
        properties["official_population_score"] = round(max(0.0, min(1.0, normalized_score)), 6)
        properties["official_population_metric"] = "district_total_population"
        properties["official_population_year"] = latest_year
        features.append(
            {
                "type": "Feature",
                "geometry": mapping(item["geometry"]),
                "properties": properties,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
        "truncated": False,
        "source": "tuik_official",
        "source_kind": "official_live_api",
    }, warnings


def build_tuik_socioeconomic_layer(district_layer: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    settings = get_settings()
    if not settings.tuik_population_enabled:
        return _empty_feature_collection(source="tuik_official"), []

    warnings: list[str] = []
    try:
        raw_text, source_kind = _load_text_from_source(
            path_value=settings.tuik_population_csv_path,
            url_value=settings.tuik_population_csv_url,
            timeout_sec=settings.tuik_population_timeout_sec,
        )
    except Exception as exc:
        return _empty_feature_collection(source="tuik_official"), [
            f"TUIK population source unavailable: {exc.__class__.__name__}"
        ]

    if not raw_text:
        return _build_live_tuik_socioeconomic_layer(district_layer, settings.tuik_population_timeout_sec)

    rows = list(csv.DictReader(raw_text.splitlines()))
    population_lookup, district_column, population_column = _build_population_lookup(rows)
    if not population_lookup:
        return _empty_feature_collection(source="tuik_official"), [
            "TUIK population CSV did not contain detectable district and population columns."
        ]

    matched: list[dict[str, Any]] = []
    for feature in (district_layer.get("features") or []):
        properties = dict((feature or {}).get("properties") or {})
        district_name = _get_feature_name(properties)
        if not district_name:
            continue
        normalized_name = _normalize_name(district_name)
        population_total = population_lookup.get(normalized_name)
        if population_total is None:
            continue
        matched.append(
            {
                "feature": feature,
                "district_name": district_name,
                "population_total": population_total,
            }
        )

    if not matched:
        return _empty_feature_collection(source="tuik_official"), [
            "No TUIK population rows matched the extracted Istanbul district boundaries."
        ]

    populations = [item["population_total"] for item in matched]
    minimum = min(populations)
    maximum = max(populations)
    span = maximum - minimum

    features: list[dict[str, Any]] = []
    for item in matched:
        normalized_score = 0.7 if span <= 0 else (item["population_total"] - minimum) / span
        properties = dict((item["feature"] or {}).get("properties") or {})
        properties["district_name"] = item["district_name"]
        properties["official_population_total"] = round(item["population_total"], 3)
        properties["official_population_score"] = round(max(0.0, min(1.0, normalized_score)), 6)
        properties["official_population_metric"] = "district_total_population"
        properties["official_population_column"] = population_column
        features.append(
            {
                "type": "Feature",
                "geometry": (item["feature"] or {}).get("geometry"),
                "properties": properties,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
        "truncated": False,
        "source": "tuik_official",
        "source_kind": source_kind,
    }, warnings
