from sqlalchemy import text

from app.db.session import SessionLocal
from app.schemas.geodata import BoundingBox


def _active_time_clause() -> str:
    return """
      AND (effective_from IS NULL OR effective_from <= now())
      AND (effective_to IS NULL OR effective_to >= now())
    """


def get_nfz_source_health() -> dict[str, int]:
    query = text(
        f"""
        SELECT
            COUNT(*) FILTER (WHERE source ILIKE 'AIP%') AS aip_active,
            COUNT(*) FILTER (WHERE source ILIKE 'NOTAM%') AS notam_active
        FROM public.nfz_zones
        WHERE is_active = true
          AND source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
        {_active_time_clause()}
        """
    )

    with SessionLocal() as db:
        row = db.execute(query).mappings().first()
        if not row:
            return {"aip_active": 0, "notam_active": 0}
        return {
            "aip_active": int(row["aip_active"] or 0),
            "notam_active": int(row["notam_active"] or 0),
        }


def list_nfz_in_bbox(bbox: BoundingBox) -> list[dict]:
    query = text(
        f"""
        SELECT
            id,
            source,
            source_version,
            zone_code,
            zone_name,
            zone_type,
            lower_limit,
            upper_limit
        FROM public.nfz_zones
        WHERE is_active = true
          AND source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
          {_active_time_clause()}
          AND ST_Intersects(
              geom,
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
            },
        ).mappings()
        return [dict(row) for row in rows]


def list_nfz_geojson_in_bbox(bbox: BoundingBox) -> list[dict]:
    query = text(
        f"""
        SELECT
            id,
            source,
            source_version,
            zone_code,
            zone_name,
            zone_type,
            lower_limit,
            upper_limit,
            ST_AsGeoJSON(geom)::json AS geometry
        FROM public.nfz_zones
        WHERE is_active = true
          AND source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
          {_active_time_clause()}
          AND ST_Intersects(
              geom,
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
                        "zone_code": row["zone_code"],
                        "zone_name": row["zone_name"],
                        "zone_type": row["zone_type"],
                        "lower_limit": row["lower_limit"],
                        "upper_limit": row["upper_limit"],
                        "zone_category": "nfz",
                        "severity": "blocked",
                    },
                }
            )
        return features


def count_nfz_intersections_in_bbox(bbox: BoundingBox) -> int:
    query = text(
        f"""
        SELECT COUNT(*)
        FROM public.nfz_zones
        WHERE is_active = true
          AND source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
          {_active_time_clause()}
          AND ST_Intersects(
              geom,
              ST_MakeEnvelope(:west, :south, :east, :north, 4326)
          )
        """
    )

    with SessionLocal() as db:
        return int(
            db.execute(
                query,
                {
                    "west": bbox.west,
                    "south": bbox.south,
                    "east": bbox.east,
                    "north": bbox.north,
                },
            ).scalar_one()
            or 0
        )
