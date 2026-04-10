from sqlalchemy import text

from app.db.session import SessionLocal
from app.schemas.geodata import BoundingBox


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
