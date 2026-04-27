from typing import Any

from sqlalchemy import text

from app.db.session import SessionLocal


def list_active_vertiports(
    min_score: float | None = None,
    max_price: float | None = None,
) -> list[dict[str, Any]]:
    query_str = """
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
    """
    params = {}
    if min_score is not None:
        query_str += " AND suitability_score >= :min_score"
        params["min_score"] = min_score
    if max_price is not None:
        query_str += " AND price_per_km <= :max_price"
        params["max_price"] = max_price

    query_str += " ORDER BY COALESCE(suitability_score, 0) DESC, name ASC"
    query = text(query_str)

    with SessionLocal() as db:
        rows = db.execute(query, params).mappings()
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
