from typing import Any

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.vertiport import Vertiport


def list_active_vertiports(
    min_score: float | None = None,
    max_price: float | None = None,
    max_distance_km: float | None = None,
    center_lat: float | None = None,
    center_lng: float | None = None,
    low_noise: bool = False,
    metro: bool = False,
    parking: bool = False,
    ev_charging: bool = False,
) -> list[dict[str, Any]]:
    query_str = """
        SELECT
            id,
            name,
            ST_Y(location::geometry) AS lat,
            ST_X(location::geometry) AS lng,
            suitability_score,
            120.0 AS price_per_km,
            description,
            features,
            noise_level,
            review_stats.average_rating,
            COALESCE(review_stats.review_count, 0) AS review_count,
            CASE
                WHEN :center_lat IS NULL OR :center_lng IS NULL THEN NULL
                ELSE ST_DistanceSphere(
                    location::geometry,
                    ST_SetSRID(ST_Point(:center_lng, :center_lat), 4326)
                ) / 1000.0
            END AS distance_from_center_km,
            is_active
        FROM public.vertiports
        LEFT JOIN (
            SELECT
                vertiport_id,
                ROUND(AVG((satisfaction_rating + pilot_rating + comfort_rating) / 3.0)::numeric, 2) AS average_rating,
                COUNT(*)::integer AS review_count
            FROM public.vertiport_reviews
            GROUP BY vertiport_id
        ) AS review_stats ON review_stats.vertiport_id = vertiports.id
        WHERE is_active = true
          AND NOT EXISTS (
              SELECT 1
              FROM public.nfz_zones n
              WHERE n.is_active = true
                AND n.source NOT ILIKE 'CONTROLLED_AIRSPACE%%'
                AND (n.effective_from IS NULL OR n.effective_from <= now())
                AND (n.effective_to IS NULL OR n.effective_to >= now())
                AND ST_Intersects(n.geom, location::geometry)
          )
    """
    params = {"center_lat": center_lat, "center_lng": center_lng}
    if min_score is not None:
        query_str += " AND suitability_score >= :min_score"
        params["min_score"] = min_score
    if max_price is not None:
        query_str += " AND 120.0 <= :max_price"
        params["max_price"] = max_price
    if max_distance_km is not None and center_lat is not None and center_lng is not None:
        query_str += """
            AND ST_DistanceSphere(
                location::geometry,
                ST_SetSRID(ST_Point(:center_lng, :center_lat), 4326)
            ) / 1000.0 <= :max_distance_km
        """
        params["max_distance_km"] = max_distance_km
    if low_noise:
        query_str += " AND (noise_level = 'low' OR COALESCE(features, '[]'::json)::jsonb ? 'low_noise')"
    if metro:
        query_str += " AND COALESCE(features, '[]'::json)::jsonb ? 'metro'"
    if parking:
        query_str += " AND COALESCE(features, '[]'::json)::jsonb ? 'parking'"
    if ev_charging:
        query_str += " AND COALESCE(features, '[]'::json)::jsonb ? 'ev_charging'"

    query_str += """
        ORDER BY
            CASE
                WHEN :center_lat IS NULL OR :center_lng IS NULL THEN NULL
                ELSE ST_DistanceSphere(
                    location::geometry,
                    ST_SetSRID(ST_Point(:center_lng, :center_lat), 4326)
                ) / 1000.0
            END ASC NULLS LAST,
            COALESCE(suitability_score, 0) DESC,
            name ASC
    """
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
                "features": list(row["features"] or []),
                "noise_level": row["noise_level"],
                "distance_from_center_km": round(float(row["distance_from_center_km"]), 2) if row["distance_from_center_km"] is not None else None,
                "average_rating": float(row["average_rating"]) if row["average_rating"] is not None else None,
                "review_count": int(row["review_count"] or 0),
                "is_active": bool(row["is_active"]),
            }
            for row in rows
        ]


def get_vertiport(vertiport_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        vertiport = db.get(Vertiport, vertiport_id)
        if vertiport is None:
            return None
        return {
            "id": int(vertiport.id),
            "name": vertiport.name,
            "is_active": bool(vertiport.is_active),
        }
