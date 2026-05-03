from decimal import Decimal
import json
from typing import Any

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, mapping, shape
from shapely.geometry.base import BaseGeometry
from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.route import Route

_CONTROLLED_RENDER_RADIUS_M = 1.40 * 1852.0


def _route_to_dict(route: Route) -> dict[str, Any]:
    line = to_shape(route.path_geom) if route.path_geom is not None else None
    coordinates = [[lng, lat] for lng, lat in line.coords] if line is not None else []
    return {
        "id": route.id,
        "user_id": route.user_id,
        "from_vertiport_id": route.from_vertiport_id,
        "to_vertiport_id": route.to_vertiport_id,
        "status": route.status,
        "distance_km": float(route.distance_km or 0),
        "duration_min": int(route.duration_min or 0),
        "price_tl": float(route.price_tl or 0),
        "weather_snapshot": route.weather_snapshot or {},
        "coordinates": coordinates,
        "geojson": mapping(line) if line is not None else None,
        "created_at": route.created_at,
    }


def _decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))


def _line_geojson(coordinates: list[list[float]]) -> str:
    line = LineString([(lng, lat) for lng, lat in coordinates])
    return json.dumps(mapping(line))


def _line_from_coordinates(coordinates: list[list[float]]) -> LineString:
    return LineString([(lng, lat) for lng, lat in coordinates])


def get_vertiport_point(vertiport_id: int) -> dict[str, Any] | None:
    query = text(
        """
        SELECT
            id,
            name,
            ST_Y(location::geometry) AS lat,
            ST_X(location::geometry) AS lng
        FROM public.vertiports
        WHERE id = :id
          AND is_active = true
        """
    )
    with SessionLocal() as db:
        row = db.execute(query, {"id": vertiport_id}).mappings().first()
        return dict(row) if row else None


def create_route(
    *,
    user_id: int,
    from_vertiport_id: int | None,
    to_vertiport_id: int | None,
    status: str = "simulated",
    coordinates: list[list[float]],
    distance_km: float,
    duration_min: int,
    price_tl: float,
    weather_snapshot: dict[str, Any],
) -> dict[str, Any]:
    line = _line_from_coordinates(coordinates)
    with SessionLocal() as db:
        route = Route(
            user_id=user_id,
            from_vertiport_id=from_vertiport_id,
            to_vertiport_id=to_vertiport_id,
            status=status,
            distance_km=_decimal(distance_km),
            duration_min=duration_min,
            price_tl=_decimal(price_tl),
            path_geom=from_shape(line, srid=4326),
            weather_snapshot=weather_snapshot,
        )
        db.add(route)
        db.commit()
        db.refresh(route)
        return _route_to_dict(route)


def count_nfz_intersections_for_coordinates(coordinates: list[list[float]]) -> int:
    query = text(
        """
        WITH candidate AS (
            SELECT ST_SetSRID(ST_GeomFromGeoJSON(:line_geojson), 4326) AS geom
        )
        SELECT COUNT(*) AS hit_count
        FROM public.nfz_zones n
        CROSS JOIN candidate c
        WHERE n.is_active = true
          AND n.source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
          AND (n.effective_from IS NULL OR n.effective_from <= now())
          AND (n.effective_to IS NULL OR n.effective_to >= now())
          AND ST_Intersects(n.geom, c.geom)
        """
    )
    with SessionLocal() as db:
        row = db.execute(query, {"line_geojson": _line_geojson(coordinates)}).mappings().first()
        return int(row["hit_count"] or 0) if row else 0


def point_within_nfz(longitude: float, latitude: float) -> bool:
    query = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM public.nfz_zones n
            WHERE n.is_active = true
              AND n.source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
              AND (n.effective_from IS NULL OR n.effective_from <= now())
              AND (n.effective_to IS NULL OR n.effective_to >= now())
              AND ST_Intersects(
                    n.geom,
                    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
                  )
        ) AS is_inside
        """
    )
    with SessionLocal() as db:
        row = db.execute(query, {"longitude": longitude, "latitude": latitude}).mappings().first()
        return bool(row["is_inside"]) if row else False


def list_nfz_intersections_for_coordinates(coordinates: list[list[float]]) -> list[dict[str, Any]]:
    query = text(
        """
        WITH candidate AS (
            SELECT ST_SetSRID(ST_GeomFromGeoJSON(:line_geojson), 4326) AS geom
        )
        SELECT
            n.id,
            n.zone_name,
            n.zone_code,
            n.zone_type,
            n.source,
            ST_LineLocatePoint(
                c.geom,
                ST_ClosestPoint(
                    ST_Intersection(n.geom, c.geom),
                    ST_StartPoint(c.geom)
                )
            ) AS route_progress,
            ST_AsGeoJSON(
                ST_ClosestPoint(
                    ST_Intersection(n.geom, c.geom),
                    ST_StartPoint(c.geom)
                )
            )::json AS block_point
        FROM public.nfz_zones n
        CROSS JOIN candidate c
        WHERE n.is_active = true
          AND n.source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
          AND (n.effective_from IS NULL OR n.effective_from <= now())
          AND (n.effective_to IS NULL OR n.effective_to >= now())
          AND ST_Intersects(n.geom, c.geom)
        ORDER BY route_progress ASC NULLS LAST
        LIMIT 20
        """
    )
    with SessionLocal() as db:
        return [dict(row) for row in db.execute(query, {"line_geojson": _line_geojson(coordinates)}).mappings()]


def get_route(route_id: int, *, user_id: int | None = None) -> dict[str, Any] | None:
    with SessionLocal() as db:
        route = db.get(Route, route_id)
        if route is None:
            return None
        if user_id is not None and route.user_id != user_id:
            return None
        return _route_to_dict(route)


def update_route_status(route_id: int, status: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        route = db.get(Route, route_id)
        if route is None:
            return None
        route.status = status
        db.commit()
        db.refresh(route)
        return _route_to_dict(route)


def list_nfz_intersections(route_id: int) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT
            n.id,
            n.zone_name,
            n.zone_code,
            n.zone_type,
            n.source,
            ST_LineLocatePoint(
                r.path_geom,
                ST_ClosestPoint(
                    ST_Intersection(n.geom, r.path_geom),
                    ST_StartPoint(r.path_geom)
                )
            ) AS route_progress,
            ST_AsGeoJSON(
                ST_ClosestPoint(
                    ST_Intersection(n.geom, r.path_geom),
                    ST_StartPoint(r.path_geom)
                )
            )::json AS block_point
        FROM public.routes r
        JOIN public.nfz_zones n
          ON n.is_active = true
         AND n.source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
         AND (n.effective_from IS NULL OR n.effective_from <= now())
         AND (n.effective_to IS NULL OR n.effective_to >= now())
         AND ST_Intersects(n.geom, r.path_geom)
        WHERE r.id = :route_id
        ORDER BY route_progress ASC NULLS LAST
        LIMIT 20
        """
    )
    with SessionLocal() as db:
        return [dict(row) for row in db.execute(query, {"route_id": route_id}).mappings()]


def list_controlled_airspace_intersections(route_id: int) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT
            c.id,
            c.zone_name,
            c.zone_code,
            c.airspace_class,
            c.source
        FROM public.routes r
        JOIN public.controlled_airspace_zones c
          ON c.is_active = true
         AND (c.effective_from IS NULL OR c.effective_from <= now())
         AND (c.effective_to IS NULL OR c.effective_to >= now())
         AND ST_Intersects(
             ST_Buffer(ST_Centroid(c.geom)::geography, :render_radius_m)::geometry,
             r.path_geom
         )
        WHERE r.id = :route_id
        LIMIT 20
        """
    )
    with SessionLocal() as db:
        return [
            dict(row)
            for row in db.execute(
                query,
                {"route_id": route_id, "render_radius_m": _CONTROLLED_RENDER_RADIUS_M},
            ).mappings()
        ]


def list_controlled_airspace_intersections_for_coordinates(coordinates: list[list[float]]) -> list[dict[str, Any]]:
    query = text(
        """
        WITH candidate AS (
            SELECT ST_SetSRID(ST_GeomFromGeoJSON(:line_geojson), 4326) AS geom
        )
        SELECT
            c.id,
            c.zone_name,
            c.zone_code,
            c.airspace_class,
            c.source
        FROM public.controlled_airspace_zones c
        CROSS JOIN candidate candidate_route
        WHERE c.is_active = true
          AND (c.effective_from IS NULL OR c.effective_from <= now())
          AND (c.effective_to IS NULL OR c.effective_to >= now())
          AND ST_Intersects(
              ST_Buffer(ST_Centroid(c.geom)::geography, :render_radius_m)::geometry,
              candidate_route.geom
          )
        LIMIT 20
        """
    )
    with SessionLocal() as db:
        return [
            dict(row)
            for row in db.execute(
                query,
                {"line_geojson": _line_geojson(coordinates), "render_radius_m": _CONTROLLED_RENDER_RADIUS_M},
            ).mappings()
        ]


def list_building_obstacle_intersections(route_id: int, *, max_hits: int = 10) -> list[dict[str, Any]]:
    route = get_route(route_id)
    if route is None or not route.get("coordinates"):
        return []
    return list_building_obstacle_intersections_for_coordinates(route["coordinates"], max_hits=max_hits)


def load_recent_building_obstacles(limit: int = 8) -> list[dict[str, Any]]:
    jobs_query = text(
        """
        SELECT job_id, region_name, extracted_layers, updated_at
        FROM public.geodata_ingest_jobs
        WHERE status IN ('success', 'partial_success')
          AND COALESCE((layer_counts ->> 'buildings')::int, 0) > 0
        ORDER BY updated_at DESC
        LIMIT :limit
        """
    )
    obstacles: list[dict[str, Any]] = []
    seen: set[str] = set()
    with SessionLocal() as db:
        jobs = [dict(row) for row in db.execute(jobs_query, {"limit": limit}).mappings()]

    for job in jobs:
        features = ((job.get("extracted_layers") or {}).get("buildings") or {}).get("features") or []
        for index, feature in enumerate(features):
            geometry = feature.get("geometry")
            if not geometry:
                continue
            key = json.dumps(geometry, sort_keys=True)
            if key in seen:
                continue
            try:
                obstacle_geom = shape(geometry)
            except Exception:
                continue
            if obstacle_geom.is_empty or not obstacle_geom.is_valid:
                continue
            seen.add(key)
            props = feature.get("properties") or {}
            obstacles.append(
                {
                    "geometry": obstacle_geom,
                    "zone_name": props.get("name") or props.get("building") or f"Building obstacle {index + 1}",
                    "job_id": job.get("job_id"),
                }
            )
    return obstacles


def list_building_obstacle_intersections_for_coordinates(
    coordinates: list[list[float]],
    *,
    max_hits: int = 10,
    obstacle_features: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if not coordinates:
        return []
    features = obstacle_features if obstacle_features is not None else load_recent_building_obstacles()
    route_line = _line_from_coordinates(coordinates)
    return _building_hits_for_line(
        route_line,
        max_hits=max_hits,
        obstacle_features=features,
    )


def _building_hits_for_line(
    route_line: LineString,
    *,
    max_hits: int,
    obstacle_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    route_bounds = route_line.bounds
    hits: list[dict[str, Any]] = []

    for obstacle in obstacle_features:
        obstacle_geom = obstacle.get("geometry")
        if not isinstance(obstacle_geom, BaseGeometry):
            continue
        if not _bounds_overlap(route_bounds, obstacle_geom.bounds):
            continue
        if not route_line.intersects(obstacle_geom):
            continue
        intersection = route_line.intersection(obstacle_geom)
        point = route_line.interpolate(route_line.project(intersection.centroid))
        progress = route_line.project(point) / route_line.length if route_line.length else 0
        hits.append(
            {
                "id": None,
                "zone_name": obstacle.get("zone_name"),
                "job_id": obstacle.get("job_id"),
                "route_progress": progress,
                "block_point": {"type": "Point", "coordinates": [point.x, point.y]},
            }
        )
        if len(hits) >= max_hits:
            break

    return sorted(hits, key=lambda item: item.get("route_progress") or 0)


def _bounds_overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]
