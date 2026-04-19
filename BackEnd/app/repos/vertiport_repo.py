from typing import Any

from sqlalchemy import text

from app.db.session import SessionLocal


def list_active_vertiports() -> list[dict[str, Any]]:
    query = text(
        """
        SELECT
            id,
            name,
            ST_Y(location::geometry) AS lat,
            ST_X(location::geometry) AS lng,
            suitability_score,
            price_per_km,
            description,
            is_active
        FROM public.vertiports
        WHERE is_active = true
        ORDER BY COALESCE(suitability_score, 0) DESC, name ASC
        """
    )
    with SessionLocal() as db:
        rows = db.execute(query).mappings()
        return [
            {
                "id": int(row["id"]),
                "name": row["name"],
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "suitability_score": float(row["suitability_score"]) if row["suitability_score"] is not None else None,
                "price_per_km": float(row["price_per_km"]) if row["price_per_km"] is not None else None,
                "description": row["description"],
                "is_active": bool(row["is_active"]),
            }
            for row in rows
        ]
