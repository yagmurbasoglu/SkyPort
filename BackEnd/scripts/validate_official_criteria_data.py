import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import get_settings
from app.schemas.geodata import BoundingBox
from app.services.criteria_data_service import (
    build_tuik_socioeconomic_layer,
    load_ibb_traffic_layer,
)


def main() -> None:
    settings = get_settings()
    bbox = BoundingBox(west=28.75, east=29.35, south=40.90, north=41.20)

    print("Official criteria validation")
    print(f"IBB enabled: {settings.ibb_traffic_enabled}")
    print(f"TUIK enabled: {settings.tuik_population_enabled}")

    traffic_layer, traffic_warnings = load_ibb_traffic_layer(bbox)
    print(f"Traffic features: {traffic_layer.get('total', 0)}")
    if traffic_warnings:
        print("Traffic warnings:")
        for warning in traffic_warnings:
            print(f"- {warning}")

    district_layer = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [28.84, 40.96],
                        [29.09, 40.96],
                        [29.09, 41.12],
                        [28.84, 41.12],
                        [28.84, 40.96]
                    ]],
                },
                "properties": {
                    "name": "Bakirkoy",
                },
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [28.95, 41.00],
                        [29.22, 41.00],
                        [29.22, 41.18],
                        [28.95, 41.18],
                        [28.95, 41.00]
                    ]],
                },
                "properties": {
                    "name": "Kadikoy",
                },
            },
        ],
    }
    socioeconomic_layer, socioeconomic_warnings = build_tuik_socioeconomic_layer(district_layer)
    print(f"Socioeconomic features: {socioeconomic_layer.get('total', 0)}")
    if socioeconomic_warnings:
        print("Socioeconomic warnings:")
        for warning in socioeconomic_warnings:
            print(f"- {warning}")


if __name__ == "__main__":
    main()
