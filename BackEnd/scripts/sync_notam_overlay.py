import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _deps():
    from app.core.config import get_settings
    from app.db.session import engine
    from app.integrations.notam_client import FaaNotamClient
    from app.services.notam_parser import NotamParser

    return get_settings, engine, FaaNotamClient, NotamParser


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


def _split_locations(raw: str) -> list[str]:
    return [item.strip().upper() for item in raw.split(",") if item.strip()]


def _normalize_dt(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text_value = str(value).strip()
    if not text_value:
        return None
    if text_value.upper() in {"PERM", "PERMANENT", "PERMANENTLY"}:
        return None

    # FAA often uses MM/DD/YYYY HHMM
    for fmt in ("%m/%d/%Y %H%M", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(text_value, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # best-effort compact style YYMMDDHHMM
    if re.fullmatch(r"\d{10}", text_value):
        try:
            parsed = datetime.strptime(text_value, "%y%m%d%H%M")
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _load_notams_from_file(input_file: str) -> list[dict]:
    path = Path(input_file)
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        notam_list = raw.get("notamList")
        if isinstance(notam_list, list):
            return [item for item in notam_list if isinstance(item, dict)]
    return []


def sync_notam_overlay(
    source: str,
    source_version: str,
    replace_source: bool,
    input_file: str | None = None,
) -> dict[str, object]:
    get_settings, engine, faa_notam_client, notam_parser = _deps()
    parser = notam_parser()

    if input_file:
        fetched = _load_notams_from_file(input_file)
    else:
        settings = get_settings()
        locations = _split_locations(settings.notam_locations)
        client = faa_notam_client(url=settings.notam_api_url)
        fetched = client.fetch_notams(
            locations=locations,
            timeout_sec=settings.notam_timeout_sec,
            retry_count=settings.notam_retry_count,
        )

    parsed_features: list[dict] = []
    parse_failed = 0
    failed_items: list[dict] = []
    for item in fetched:
        feature, reason = parser.parse_to_feature_with_reason(item)
        if feature:
            parsed_features.append(feature)
        else:
            parse_failed += 1
            failed_items.append(
                {
                    "notam_number": item.get("notamNumber") or item.get("id"),
                    "reason": reason or "unknown",
                    "q_or_icao_head": (item.get("icaoMessage") or item.get("traditionalMessage") or "")[:180],
                }
            )

    inserted = 0
    skipped = 0
    with engine.begin() as conn:
        if replace_source:
            conn.execute(text("DELETE FROM public.nfz_zones WHERE source = :source"), {"source": source})

        for feature in parsed_features:
            geom_wkt = _to_multipolygon_wkt(feature["geometry"])
            if geom_wkt is None:
                skipped += 1
                continue

            conn.execute(
                text(
                    """
                    INSERT INTO public.nfz_zones (
                        source,
                        source_version,
                        zone_code,
                        zone_name,
                        zone_type,
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
                        :zone_code,
                        :zone_name,
                        :zone_type,
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
                    "zone_code": feature.get("zone_code"),
                    "zone_name": feature.get("zone_name"),
                    "zone_type": feature.get("zone_type", "RESTRICTED"),
                    "lower_limit": feature.get("lower_limit"),
                    "upper_limit": feature.get("upper_limit"),
                    "effective_from": _normalize_dt(feature.get("effective_from")),
                    "effective_to": _normalize_dt(feature.get("effective_to")),
                    "is_active": bool(feature.get("is_active", True)),
                    "geom_wkt": geom_wkt,
                },
            )
            inserted += 1

    reason_counts = Counter(item["reason"] for item in failed_items)

    return {
        "fetched": len(fetched),
        "parsed": len(parsed_features),
        "parse_failed": parse_failed,
        "inserted": inserted,
        "skipped": skipped,
        "failed_items": failed_items,
        "failure_reason_counts": dict(reason_counts),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch FAA NOTAMs and sync as NFZ overlay.")
    parser.add_argument("--source", default="NOTAM_DYNAMIC", help="Source key written to nfz_zones.")
    parser.add_argument(
        "--source-version",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        help="Batch/source version tag.",
    )
    parser.add_argument("--replace-source", action="store_true", help="Delete previous rows for this source.")
    parser.add_argument(
        "--input-file",
        required=False,
        help="Optional local JSON file with NOTAM records (list or {notamList:[...]}).",
    )
    parser.add_argument(
        "--save-raw",
        action="store_true",
        help="Store fetched raw payload snapshot in cache/notam for troubleshooting.",
    )
    parser.add_argument(
        "--dump-failures",
        action="store_true",
        help="Write parse-failed NOTAM items to cache/notam/failures_<timestamp>.json.",
    )
    parser.add_argument(
        "--print-failure-summary",
        action="store_true",
        help="Print parse-failed reason summary and sample NOTAM ids to console.",
    )
    args = parser.parse_args()

    stats = sync_notam_overlay(
        source=args.source,
        source_version=args.source_version,
        replace_source=args.replace_source,
        input_file=args.input_file,
    )

    if args.save_raw:
        cache_dir = ROOT / "cache" / "notam"
        cache_dir.mkdir(parents=True, exist_ok=True)
        output = cache_dir / f"notam_sync_{args.source_version.replace(':', '').replace('-', '')}.json"
        output.write_text(json.dumps(stats, indent=2), encoding="utf-8")

    if args.dump_failures and stats["parse_failed"] > 0:
        cache_dir = ROOT / "cache" / "notam"
        cache_dir.mkdir(parents=True, exist_ok=True)
        output = cache_dir / f"notam_failures_{args.source_version.replace(':', '').replace('-', '')}.json"
        output.write_text(json.dumps(stats["failed_items"], indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Failure dump written: {output}")

    if args.print_failure_summary and stats["parse_failed"] > 0:
        print("Failure reason summary:")
        for reason, count in sorted(stats["failure_reason_counts"].items(), key=lambda x: x[1], reverse=True):
            print(f"  - {reason}: {count}")
        print("Sample failed NOTAMs:")
        for item in stats["failed_items"][:10]:
            print(f"  - {item.get('notam_number')}: {item.get('reason')}")

    print(
        "NOTAM sync completed. "
        f"fetched={stats['fetched']} parsed={stats['parsed']} "
        f"parse_failed={stats['parse_failed']} inserted={stats['inserted']} skipped={stats['skipped']}"
    )


if __name__ == "__main__":
    main()
