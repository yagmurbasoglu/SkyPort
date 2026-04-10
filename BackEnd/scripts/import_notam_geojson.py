import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _import_nfz_func():
    from scripts.import_nfz_geojson import import_nfz

    return import_nfz


def main() -> None:
    parser = argparse.ArgumentParser(description="Import NOTAM overlay polygons into nfz_zones.")
    parser.add_argument("--file", required=True, help="Path to NOTAM GeoJSON FeatureCollection file.")
    parser.add_argument("--source-version", required=True, help="NOTAM batch/version/timestamp label.")
    parser.add_argument("--replace-source", action="store_true", help="Replace current NOTAM source rows.")
    parser.add_argument(
        "--source",
        default="NOTAM_ACTIVE",
        help="NFZ source key for NOTAM overlay. Default: NOTAM_ACTIVE",
    )
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")

    import_nfz = _import_nfz_func()
    inserted, skipped = import_nfz(
        path=path,
        source=args.source,
        source_version=args.source_version,
        replace_source=args.replace_source,
    )
    print(
        "NOTAM import completed. "
        f"inserted={inserted}, skipped={skipped}, source={args.source}, source_version={args.source_version}"
    )


if __name__ == "__main__":
    main()
