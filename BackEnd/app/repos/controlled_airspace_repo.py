from sqlalchemy import text

from app.db.session import SessionLocal
from app.schemas.geodata import BoundingBox

_CONTROLLED_RENDER_RADIUS_M = 1.40 * 1852.0


def _active_time_clause() -> str:
    return """
      AND (effective_from IS NULL OR effective_from <= now())
      AND (effective_to IS NULL OR effective_to >= now())
    """


def get_controlled_airspace_health() -> dict[str, int]:
    query = text(
        f"""
        SELECT
            COUNT(*) AS controlled_active
        FROM public.controlled_airspace_zones
        WHERE is_active = true
        {_active_time_clause()}
        """
    )

    with SessionLocal() as db:
        row = db.execute(query).mappings().first()
        if not row:
            return {"controlled_active": 0}
        return {"controlled_active": int(row["controlled_active"] or 0)}


def list_controlled_airspace_in_bbox(bbox: BoundingBox) -> list[dict]:
    query = text(
        f"""
        SELECT
            id,
            source,
            source_version,
            airspace_class,
            zone_code,
            zone_name,
            lower_limit,
            upper_limit
        FROM public.controlled_airspace_zones
        WHERE is_active = true
          {_active_time_clause()}
          AND ST_Intersects(
              ST_Buffer(ST_Centroid(geom)::geography, :render_radius_m)::geometry,
              ST_MakeEnvelope(:west, :south, :east, :north, 4326)
          )
        """
    )

    with SessionLocal() as db:
        rows = db.execute(
            query,
            {
                "west": bbox.west,
                "south": bbox.south,
                "east": bbox.east,
                "north": bbox.north,
                "render_radius_m": _CONTROLLED_RENDER_RADIUS_M,
            },
        ).mappings()
        return [dict(row) for row in rows]


def list_controlled_airspace_geojson_in_bbox(bbox: BoundingBox) -> list[dict]:
    query = text(
        f"""
        SELECT
            id,
            source,
            source_version,
            airspace_class,
            zone_code,
            zone_name,
            lower_limit,
            upper_limit,
            ST_AsGeoJSON(
                ST_Buffer(ST_Centroid(geom)::geography, :render_radius_m)::geometry
            )::json AS geometry
        FROM public.controlled_airspace_zones
        WHERE is_active = true
          {_active_time_clause()}
          AND ST_Intersects(
              ST_Buffer(ST_Centroid(geom)::geography, :render_radius_m)::geometry,
              ST_MakeEnvelope(:west, :south, :east, :north, 4326)
          )
        """
    )

    with SessionLocal() as db:
        rows = db.execute(
            query,
            {
                "west": bbox.west,
                "south": bbox.south,
                "east": bbox.east,
                "north": bbox.north,
                "render_radius_m": _CONTROLLED_RENDER_RADIUS_M,
            },
        ).mappings()
        features: list[dict] = []
        for row in rows:
            features.append(
                {
                    "type": "Feature",
                    "geometry": row["geometry"],
                    "properties": {
                        "id": row["id"],
                        "source": row["source"],
                        "source_version": row["source_version"],
                        "airspace_class": row["airspace_class"],
                        "zone_code": row["zone_code"],
                        "zone_name": row["zone_name"],
                        "lower_limit": row["lower_limit"],
                        "upper_limit": row["upper_limit"],
                        "zone_category": "controlled_airspace",
                        "severity": "caution",
                    },
                }
            )
        return features
