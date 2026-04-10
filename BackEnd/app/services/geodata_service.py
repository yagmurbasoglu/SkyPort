from datetime import datetime, timezone
from math import cos, pi
from threading import Thread
from uuid import uuid4

from fastapi import HTTPException

from app.repos import geodata_repo
from app.repos.controlled_airspace_repo import (
    get_controlled_airspace_health,
    list_controlled_airspace_in_bbox,
)
from app.repos.nfz_repo import get_nfz_source_health, list_nfz_in_bbox
from app.schemas.geodata import BoundingBox, IngestRequest

try:
    import h3
except ModuleNotFoundError:  # pragma: no cover - environment-dependent
    h3 = None

try:
    import osmnx as ox
except ModuleNotFoundError:  # pragma: no cover - environment-dependent
    ox = None
else:
    ox.settings.use_cache = True
    ox.settings.timeout = 30


def _validate_bbox(req: IngestRequest) -> None:
    bbox = req.bounding_box
    if bbox.west >= bbox.east:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_BBOX", "message": "west must be smaller than east."},
        )
    if bbox.south >= bbox.north:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_BBOX", "message": "south must be smaller than north."},
        )

    max_bbox_area_km2 = 25.0
    area_km2 = _bbox_area_km2(bbox)
    if area_km2 > max_bbox_area_km2:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BBOX_TOO_LARGE",
                "message": f"Bounding box area is too large ({area_km2:.1f} km2). Please select a smaller area.",
                "details": {"max_bbox_area_km2": max_bbox_area_km2},
            },
        )


def _derive_status(warnings: list[str], layer_counts: dict[str, int]) -> str:
    osm_total = (
        layer_counts.get("buildings", 0)
        + layer_counts.get("roads", 0)
        + layer_counts.get("land_use", 0)
        + layer_counts.get("nfz", 0)
        + layer_counts.get("controlled_airspace", 0)
    )
    if osm_total == 0:
        return "failed"
    if warnings:
        return "partial_success"
    return "success"


def _bbox_area_km2(bbox: BoundingBox) -> float:
    lat_km = (bbox.north - bbox.south) * 111.32
    avg_lat = (bbox.north + bbox.south) / 2.0
    lon_km = (bbox.east - bbox.west) * 111.32 * cos(avg_lat * pi / 180.0)
    return abs(lat_km * lon_km)


def _osmnx_bbox_order(bbox: BoundingBox) -> tuple[float, float, float, float]:
    # OSMnx v2 expects bbox tuple in (left, bottom, right, top)
    # which maps to (west, south, east, north).
    return (bbox.west, bbox.south, bbox.east, bbox.north)


def _extract_features(tags: dict, bbox: BoundingBox):
    if ox is None:
        raise RuntimeError("osmnx is not installed")
    ordered = _osmnx_bbox_order(bbox)
    try:
        return ox.features_from_bbox(ordered, tags=tags)
    except TypeError:
        # Backward-compatible call style for older OSMnx versions.
        return ox.features_from_bbox(
            north=bbox.north,
            south=bbox.south,
            east=bbox.east,
            west=bbox.west,
            tags=tags,
        )


def _extract_roads(bbox: BoundingBox):
    if ox is None:
        raise RuntimeError("osmnx is not installed")
    # Faster than graph_from_bbox for ingestion counting use-case.
    # Limit to major road classes to reduce payload and latency.
    major_road_tags = {
        "highway": [
            "motorway",
            "trunk",
            "primary",
            "secondary",
            "tertiary",
        ]
    }
    return _extract_features(major_road_tags, bbox)


def extract_osm_data(bbox: BoundingBox) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    data = {
        "buildings": None,
        "roads": None,
        "land_use": None,
        "nfz": None,
        "controlled_airspace": None,
    }

    try:
        data["buildings"] = _extract_features({"building": True}, bbox)
    except Exception as exc:
        warnings.append(f"Buildings layer unavailable: {exc.__class__.__name__}")

    try:
        data["roads"] = _extract_roads(bbox)
    except Exception as exc:
        warnings.append(f"Roads layer unavailable: {exc.__class__.__name__}")

    try:
        data["land_use"] = _extract_features({"landuse": True}, bbox)
    except Exception as exc:
        warnings.append(f"Land-use layer unavailable: {exc.__class__.__name__}")

    try:
        data["nfz"] = list_nfz_in_bbox(bbox)
        health = get_nfz_source_health()
        if health.get("aip_active", 0) == 0:
            warnings.append("NFZ AIP baseline is not loaded.")
        if health.get("notam_active", 0) == 0:
            warnings.append("NFZ NOTAM overlay is not loaded.")
    except Exception as exc:
        warnings.append(f"NFZ layer unavailable: {exc.__class__.__name__}")

    try:
        data["controlled_airspace"] = list_controlled_airspace_in_bbox(bbox)
        controlled_health = get_controlled_airspace_health()
        if controlled_health.get("controlled_active", 0) == 0:
            warnings.append("Controlled airspace layer is not loaded.")
    except Exception as exc:
        warnings.append(f"Controlled airspace layer unavailable: {exc.__class__.__name__}")

    return data, warnings


def clean_and_transform(features):
    if features is None:
        return None
    if features.empty:
        return features
    if "geometry" not in features.columns:
        return features.iloc[0:0]

    cleaned = features[~features.geometry.isna()]
    cleaned = cleaned[cleaned.geometry.is_valid]
    if cleaned.empty:
        return cleaned

    if cleaned.crs is None:
        cleaned = cleaned.set_crs(epsg=4326, allow_override=True)
    elif cleaned.crs.to_epsg() != 4326:
        cleaned = cleaned.to_crs(epsg=4326)
    return cleaned


def _feature_count(features) -> int:
    if features is None:
        return 0
    if hasattr(features, "empty") and features.empty:
        return 0
    return len(features)


def generate_h3_grid(bbox: BoundingBox, resolution: int) -> list[str]:
    if h3 is None:
        raise RuntimeError("h3 is not installed")
    lat_steps = 25
    lon_steps = 25
    cells: set[str] = set()

    lat_span = bbox.north - bbox.south
    lon_span = bbox.east - bbox.west
    for i in range(lat_steps + 1):
        lat = bbox.south + (lat_span * i / lat_steps)
        for j in range(lon_steps + 1):
            lng = bbox.west + (lon_span * j / lon_steps)
            cells.add(h3.latlng_to_cell(lat, lng, resolution))
    return sorted(cells)


def ingest(req: IngestRequest) -> dict:
    return submit_ingest(req)


def _run_ingest_job(job_id: str, req_data: dict) -> None:
    started_at = datetime.now(timezone.utc)
    h3_cells: list[str] = []
    try:
        req = IngestRequest(**req_data)
        osm_data, warnings = extract_osm_data(req.bounding_box)
        buildings = clean_and_transform(osm_data.get("buildings"))
        roads = clean_and_transform(osm_data.get("roads"))
        land_use = clean_and_transform(osm_data.get("land_use"))
        nfz = osm_data.get("nfz")
        controlled_airspace = osm_data.get("controlled_airspace")

        layer_counts = {
            "buildings": _feature_count(buildings),
            "roads": _feature_count(roads),
            "land_use": _feature_count(land_use),
            "nfz": _feature_count(nfz),
            "controlled_airspace": _feature_count(controlled_airspace),
        }
        for layer in ("buildings", "roads", "land_use"):
            if layer_counts[layer] == 0:
                warnings.append(f"{layer} layer is empty.")

        try:
            h3_cells = generate_h3_grid(req.bounding_box, req.h3_resolution)
            layer_counts["h3_cells"] = len(h3_cells)
        except Exception as exc:
            layer_counts["h3_cells"] = 0
            warnings.append(f"H3 generation failed: {exc.__class__.__name__}")

        status = _derive_status(warnings=warnings, layer_counts=layer_counts)
        finished_at = datetime.now(timezone.utc)
        geodata_repo.update_job(
            job_id=job_id,
            patch={
                "status": status,
                "warnings": warnings,
                "layer_counts": layer_counts,
                "started_at": started_at,
                "finished_at": finished_at,
                "h3_cells": h3_cells,
            },
        )
    except Exception as exc:  # pragma: no cover - defensive path
        finished_at = datetime.now(timezone.utc)
        geodata_repo.update_job(
            job_id=job_id,
            patch={
                "status": "failed",
                "warnings": [f"Ingestion failed: {exc.__class__.__name__}"],
                "layer_counts": {
                    "buildings": 0,
                    "roads": 0,
                    "land_use": 0,
                    "nfz": 0,
                    "controlled_airspace": 0,
                    "h3_cells": 0,
                },
                "started_at": started_at,
                "finished_at": finished_at,
                "h3_cells": [],
            },
        )


def _start_worker(job_id: str, req_data: dict) -> None:
    worker = Thread(
        target=_run_ingest_job,
        args=(job_id, req_data),
        daemon=True,
    )
    worker.start()


def submit_ingest(req: IngestRequest) -> dict:
    _validate_bbox(req)
    started_at = datetime.now(timezone.utc)
    job_id = uuid4().hex
    payload = {
        "job_id": job_id,
        "region_name": req.region_name,
        "h3_resolution": req.h3_resolution,
        "bounding_box": req.bounding_box.model_dump(),
        "status": "running",
        "warnings": [],
        "layer_counts": {},
        "started_at": started_at,
        "finished_at": None,
        "updated_at": started_at,
    }
    geodata_repo.create_job(job_id=job_id, payload=payload)
    _start_worker(job_id=job_id, req_data=req.model_dump())
    return payload


def get_status(job_id: str) -> dict:
    job = geodata_repo.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"code": "JOB_NOT_FOUND", "message": "Ingestion job not found."},
        )
    return job
