import argparse
import json
from pathlib import Path
import sys

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def _get_engine():
    from app.db.session import engine

    return engine


def _format_ring(ring: list[list[float]]) -> str:
    points = ", ".join(f"{pt[0]} {pt[1]}" for pt in ring)
    return f"({points})"


def _polygon_to_wkt(coords: list[list[list[float]]]) -> str:
    rings = ", ".join(_format_ring(ring) for ring in coords)
    return f"({rings})"


def _to_multipolygon_wkt(geometry_payload: dict) -> str | None:
    gtype = geometry_payload.get("type")
    coords = geometry_payload.get("coordinates")
    if not coords:
        return None

    if gtype == "Polygon":
        poly = _polygon_to_wkt(coords)
        return f"MULTIPOLYGON({poly})"

    if gtype == "MultiPolygon":
        polys = ", ".join(_polygon_to_wkt(poly) for poly in coords)
        return f"MULTIPOLYGON({polys})"

    return None


def import_controlled_airspace(path: Path, source: str, source_version: str | None, replace_source: bool) -> tuple[int, int]:
    engine = _get_engine()
    raw = json.loads(path.read_text(encoding="utf-8"))
    features = raw.get("features", [])
    inserted = 0
    skipped = 0

    with engine.begin() as conn:
        if replace_source:
            conn.execute(
                text("DELETE FROM public.controlled_airspace_zones WHERE source = :source"),
                {"source": source},
            )

        for feature in features:
            properties = feature.get("properties", {})
            geometry_payload = feature.get("geometry")
            if not geometry_payload:
                skipped += 1
                continue

            geom_wkt = _to_multipolygon_wkt(geometry_payload)
            if geom_wkt is None:
                skipped += 1
                continue

            conn.execute(
                text(
                    """
                    INSERT INTO public.controlled_airspace_zones (
                        source,
                        source_version,
                        airspace_class,
                        zone_code,
                        zone_name,
                        lower_limit,
                        upper_limit,
                        effective_from,
                        effective_to,
                        last_synced_at,
                        is_active,
                        geom
                    )
                    VALUES (
                        :source,
                        :source_version,
                        :airspace_class,
                        :zone_code,
                        :zone_name,
                        :lower_limit,
                        :upper_limit,
                        :effective_from,
                        :effective_to,
                        now(),
                        :is_active,
                        ST_GeomFromText(:geom_wkt, 4326)
                    )
                    """
                ),
                {
                    "source": source,
                    "source_version": source_version,
                    "airspace_class": properties.get("airspace_class"),
                    "zone_code": properties.get("zone_code"),
                    "zone_name": properties.get("zone_name"),
                    "lower_limit": properties.get("lower_limit"),
                    "upper_limit": properties.get("upper_limit"),
                    "effective_from": properties.get("effective_from"),
                    "effective_to": properties.get("effective_to"),
                    "is_active": properties.get("is_active", True),
                    "geom_wkt": geom_wkt,
                },
            )
            inserted += 1

    return inserted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import controlled airspace polygons into controlled_airspace_zones.")
    parser.add_argument("--file", required=True, help="Path to controlled airspace GeoJSON FeatureCollection file.")
    parser.add_argument("--source-version", required=True, help="Data source version tag.")
    parser.add_argument("--replace-source", action="store_true", help="Replace current controlled source rows.")
    parser.add_argument(
        "--source",
        default="CONTROLLED_AIRSPACE",
        help="Source key for controlled airspace polygons.",
    )
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")

    inserted, skipped = import_controlled_airspace(
        path=path,
        source=args.source,
        source_version=args.source_version,
        replace_source=args.replace_source,
    )
    print(
        "Controlled airspace import completed. "
        f"inserted={inserted}, skipped={skipped}, source={args.source}, source_version={args.source_version}"
    )


if __name__ == "__main__":
    main()
