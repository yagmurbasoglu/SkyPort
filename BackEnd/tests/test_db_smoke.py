from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine


def _require_db() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        pytest.skip(f"DB not available for smoke test: {exc}")


def test_core_tables_exist() -> None:
    _require_db()

    expected = {
        "users",
        "vertiports",
        "favorites",
        "analyses",
        "analysis_results",
        "routes",
        "reports",
        "geodata_ingest_jobs",
        "geodata_h3_cells",
        "nfz_zones",
        "controlled_airspace_zones",
    }

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                """
            )
        ).fetchall()

    actual = {row[0] for row in rows}
    assert expected.issubset(actual)


def test_vertiports_crud_smoke() -> None:
    _require_db()
    name = f"Smoke VP {uuid4().hex[:8]}"

    with engine.begin() as conn:
        inserted = conn.execute(
            text(
                """
                INSERT INTO public.vertiports (name, location, suitability_score, price_per_km, description)
                VALUES (
                    :name,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                    :score,
                    :price,
                    :description
                )
                RETURNING id
                """
            ),
            {
                "name": name,
                "lng": 28.99,
                "lat": 41.03,
                "score": 75.50,
                "price": 2.75,
                "description": "smoke test record",
            },
        )
        vertiport_id = inserted.scalar_one()

        selected = conn.execute(
            text("SELECT name FROM public.vertiports WHERE id = :id"),
            {"id": vertiport_id},
        ).scalar_one()
        assert selected == name

        conn.execute(
            text(
                """
                UPDATE public.vertiports
                SET suitability_score = :score
                WHERE id = :id
                """
            ),
            {"id": vertiport_id, "score": 80.25},
        )

        updated = conn.execute(
            text(
                """
                SELECT suitability_score
                FROM public.vertiports
                WHERE id = :id
                """
            ),
            {"id": vertiport_id},
        ).scalar_one()
        assert float(updated) == 80.25

        conn.execute(
            text("DELETE FROM public.vertiports WHERE id = :id"),
            {"id": vertiport_id},
        )

        deleted = conn.execute(
            text("SELECT id FROM public.vertiports WHERE id = :id"),
            {"id": vertiport_id},
        ).scalar_one_or_none()
        assert deleted is None
