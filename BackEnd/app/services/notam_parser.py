from __future__ import annotations

import math
import re
from hashlib import sha1


class NotamParser:
    _qline_circle_pattern = re.compile(r"Q\)[^\n]*?(\d{4}[NS])(\d{5}[EW])(\d{3})")
    _coord_pair_pattern = re.compile(r"(\d{4,6}[NS])\s*(\d{5,7}[EW])")
    _qcode_pattern = re.compile(r"Q\)\s*[A-Z]{4}/([A-Z0-9]{5})/")
    _no_fly_keywords = (
        "PROHIBITED",
        "RESTRICTED",
        "DANGER AREA",
        "NO FLY",
        "NO-FLY",
        "DRONE",
        "UAS",
        "UAV",
    )
    _max_radius_nm = 60.0
    _render_radius_cap_nm = 1.2

    @staticmethod
    def _dms_to_decimal(coord: str) -> float:
        c = coord.strip().upper()
        hemi = c[-1]
        body = c[:-1]

        if hemi in ("N", "S"):
            if len(body) == 4:  # DDMM
                deg, minute, sec = int(body[0:2]), int(body[2:4]), 0
            else:  # DDMMSS
                deg, minute, sec = int(body[0:2]), int(body[2:4]), int(body[4:6])
        else:
            if len(body) == 5:  # DDDMM
                deg, minute, sec = int(body[0:3]), int(body[3:5]), 0
            else:  # DDDMMSS
                deg, minute, sec = int(body[0:3]), int(body[3:5]), int(body[5:7])

        value = deg + minute / 60 + sec / 3600
        if hemi in ("S", "W"):
            value *= -1
        return value

    @staticmethod
    def _circle_polygon(lat: float, lon: float, radius_nm: float, steps: int = 48) -> list[list[float]]:
        radius_km = radius_nm * 1.852
        points: list[list[float]] = []
        for i in range(steps):
            angle = 2 * math.pi * i / steps
            dlat = (radius_km / 111.32) * math.cos(angle)
            dlon = (radius_km / (111.32 * math.cos(math.radians(lat)))) * math.sin(angle)
            points.append([round(lon + dlon, 7), round(lat + dlat, 7)])
        points.append(points[0])
        return points

    @staticmethod
    def _make_notam_id(raw: str) -> str:
        return "FAA-" + sha1(raw.encode("utf-8")).hexdigest()[:16]

    def parse_to_feature_with_reason(self, notam: dict) -> tuple[dict | None, str | None]:
        raw_candidates = [
            notam.get("traditionalMessage"),
            notam.get("icaoMessage"),
            notam.get("plainLanguageMessage"),
            notam.get("message"),
            notam.get("raw"),
        ]
        raw = ""
        for candidate in raw_candidates:
            if isinstance(candidate, str) and len(candidate.strip()) > 10:
                raw = candidate
                break

        if not isinstance(raw, str) or not raw.strip():
            return None, "empty_message"

        notam_id = str(notam.get("notamNumber") or notam.get("id") or self._make_notam_id(raw))
        effective_from = (
            notam.get("effectiveStart")
            or notam.get("effectiveFrom")
            or notam.get("startDate")
        )
        effective_to = (
            notam.get("effectiveEnd")
            or notam.get("effectiveTo")
            or notam.get("endDate")
        )
        raw_upper = raw.upper()

        qcode_match = self._qcode_pattern.search(raw_upper)
        qcode = qcode_match.group(1) if qcode_match else None
        has_restriction_keyword = any(keyword in raw_upper for keyword in self._no_fly_keywords)
        has_explicit_polygon_text = "AREA BOUNDED BY" in raw_upper

        # Ignore broad informational/admin NOTAMs with unknown XX qualifiers.
        if qcode and "XX" in qcode and not has_restriction_keyword and not has_explicit_polygon_text:
            return None, "generic_xx_non_restriction"

        # 1) Prefer Q-line center + radius
        q_match = self._qline_circle_pattern.search(raw)
        if q_match:
            lat = self._dms_to_decimal(q_match.group(1))
            lon = self._dms_to_decimal(q_match.group(2))
            radius_nm = float(q_match.group(3))
            if radius_nm > self._max_radius_nm:
                return None, "radius_too_large"
            effective_radius_nm = min(radius_nm, self._render_radius_cap_nm)
            ring = self._circle_polygon(lat=lat, lon=lon, radius_nm=effective_radius_nm)
            return {
                "notam_id": notam_id,
                "zone_code": notam_id,
                "zone_name": f"NOTAM {notam_id}",
                "zone_type": "RESTRICTED",
                "lower_limit": "SFC",
                "upper_limit": "UNL",
                "effective_from": effective_from,
                "effective_to": effective_to,
                "is_active": True,
                "raw_radius_nm": radius_nm,
                "render_radius_nm": effective_radius_nm,
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }, None

        # 2) Fallback: polygon from coordinate pairs in free text
        pairs = self._coord_pair_pattern.findall(raw)
        if len(pairs) >= 3:
            ring = [[self._dms_to_decimal(lon), self._dms_to_decimal(lat)] for lat, lon in pairs]
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            return {
                "notam_id": notam_id,
                "zone_code": notam_id,
                "zone_name": f"NOTAM {notam_id}",
                "zone_type": "RESTRICTED",
                "lower_limit": "SFC",
                "upper_limit": "UNL",
                "effective_from": effective_from,
                "effective_to": effective_to,
                "is_active": True,
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }, None

        return None, "no_supported_geometry"

    def parse_to_feature(self, notam: dict) -> dict | None:
        feature, _reason = self.parse_to_feature_with_reason(notam)
        return feature
