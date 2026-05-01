import hashlib
import json
import logging
from datetime import datetime, timezone
from math import cos, isfinite, radians
from pathlib import Path
from threading import Thread
from typing import Any

from fastapi import HTTPException, status
from shapely.geometry import Polygon, shape

from app.repos import analysis_repo
from app.repos import report_repo
from app.repos.nfz_repo import list_nfz_geojson_in_bbox
from app.schemas.geodata import BoundingBox

try:
    import h3
except ModuleNotFoundError:  # pragma: no cover - environment-dependent
    h3 = None

logger = logging.getLogger(__name__)
EXPORTS_DIR = Path(__file__).resolve().parents[2] / "generated_reports"

ALLOWED_CRITERIA = {"obstacle", "transport", "land_use", "nfz"}
CRITERIA_ORDER = ["obstacle", "transport", "land_use", "nfz"]
CRITERIA_DIRECTION = {
    "obstacle": "cost",
    "transport": "benefit",
    "land_use": "benefit",
    "nfz": "benefit",
}
RANDOM_INDEX_BY_SIZE = {
    1: 0.0,
    2: 0.0,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}


def _error(status_code: int, code: str, message: str, details: dict | None = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details or {}},
    )


def validate_criteria_weights(criteria_weights: dict[str, float]) -> dict[str, float]:
    if not criteria_weights:
        raise _error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_CRITERIA_WEIGHTS",
            "criteria_weights must not be empty.",
        )

    unknown = sorted(set(criteria_weights) - ALLOWED_CRITERIA)
    if unknown:
        raise _error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_CRITERIA_WEIGHTS",
            "criteria_weights contains unsupported criteria.",
            {"allowed": sorted(ALLOWED_CRITERIA), "unknown": unknown},
        )

    missing = sorted(ALLOWED_CRITERIA - set(criteria_weights))
    if missing:
        raise _error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_CRITERIA_WEIGHTS",
            "criteria_weights must include all required criteria.",
            {"required": sorted(ALLOWED_CRITERIA), "missing": missing},
        )

    normalized: dict[str, float] = {}
    for key, value in criteria_weights.items():
        numeric_value = float(value)
        if not isfinite(numeric_value) or numeric_value < 0:
            raise _error(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_CRITERIA_WEIGHTS",
                "criteria_weights values must be finite non-negative numbers.",
                {"criterion": key},
            )
        normalized[key] = numeric_value

    total = sum(normalized.values())
    if 95 <= total <= 105:
        normalized = {key: value / 100.0 for key, value in normalized.items()}
        total = sum(normalized.values())

    if abs(total - 1.0) > 0.001:
        raise _error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_CRITERIA_WEIGHTS",
            "criteria_weights must sum to 1.0 or 100.",
            {"total": total},
        )

    return normalized


def _cell_variation(cell_index: str, salt: str) -> float:
    digest = hashlib.sha256(f"{cell_index}:{salt}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _cell_polygon(cell_index: str) -> Polygon | None:
    if h3 is None:
        return None
    try:
        boundary = h3.cell_to_boundary(cell_index)
    except Exception:
        return None
    coordinates = [(lng, lat) for lat, lng in boundary]
    if coordinates and coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])
    if len(coordinates) < 4:
        return None
    return Polygon(coordinates)


def _deg_to_km(distance_deg: float) -> float:
    return float(distance_deg) * 111.32


def _expand_bbox_for_nfz_lookup(bbox: BoundingBox, buffer_km: float = 5.0) -> BoundingBox:
    lat_buffer_deg = buffer_km / 111.32
    # Use the bbox midpoint latitude to approximate lng degree width in km.
    midpoint_lat = (bbox.north + bbox.south) / 2.0
    cos_lat = cos(radians(midpoint_lat))
    lng_divisor = max(111.32 * max(cos_lat, 0.15), 1e-6)
    lng_buffer_deg = buffer_km / lng_divisor
    return BoundingBox(
        west=max(-180.0, bbox.west - lng_buffer_deg),
        east=min(180.0, bbox.east + lng_buffer_deg),
        south=max(-90.0, bbox.south - lat_buffer_deg),
        north=min(90.0, bbox.north + lat_buffer_deg),
    )


def _nfz_polygons_for_geodata_job(geodata_job: dict[str, Any]) -> list[Polygon]:
    bbox_payload = geodata_job.get("bounding_box") or {}
    try:
        bbox = BoundingBox(**bbox_payload)
    except Exception:
        return []
    features = list_nfz_geojson_in_bbox(_expand_bbox_for_nfz_lookup(bbox))
    polygons: list[Polygon] = []
    for feature in features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        try:
            polygon = shape(geometry)
        except Exception:
            continue
        if polygon.is_empty:
            continue
        polygons.append(polygon)
    return polygons


def _nfz_score_for_cell(cell_polygon: Polygon | None, nfz_polygons: list[Polygon]) -> tuple[float, dict[str, Any]]:
    if cell_polygon is None:
        return 1.0, {
            "intersects_nfz": False,
            "nfz_intersection_count": 0,
            "nfz_overlap_ratio": 0.0,
            "distance_to_nfz_km": None,
        }
    if not nfz_polygons:
        return 1.0, {
            "intersects_nfz": False,
            "nfz_intersection_count": 0,
            "nfz_overlap_ratio": 0.0,
            "distance_to_nfz_km": None,
        }

    intersections = [polygon for polygon in nfz_polygons if cell_polygon.intersects(polygon)]
    if intersections:
        overlap_area = sum(cell_polygon.intersection(polygon).area for polygon in intersections)
        cell_area = cell_polygon.area or 0.0
        overlap_ratio = overlap_area / cell_area if cell_area > 0 else 1.0
        return 0.0, {
            "intersects_nfz": True,
            "nfz_intersection_count": len(intersections),
            "nfz_overlap_ratio": round(overlap_ratio, 6),
            "distance_to_nfz_km": 0.0,
        }

    min_distance_deg = min(cell_polygon.distance(polygon) for polygon in nfz_polygons)
    min_distance_km = _deg_to_km(min_distance_deg)
    score = _clamp(min_distance_km / 6.0)
    return score, {
        "intersects_nfz": False,
        "nfz_intersection_count": 0,
        "nfz_overlap_ratio": 0.0,
        "distance_to_nfz_km": round(min_distance_km, 3),
    }


def _score_class(score: float) -> str:
    if score >= 95:
        return "best_fit"
    if score >= 80:
        return "strong"
    if score >= 60:
        return "moderate"
    if score >= 30:
        return "low"
    return "unsuitable"


def _safe_slug(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    slug = "-".join(part for part in cleaned.split("-") if part)
    return slug or "analysis"


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _write_simple_pdf(path: Path, lines: list[str]) -> None:
    content_stream = f"""
q
0.02 0.04 0.09 rg
0 0 612 842 re
f
Q
q
0.71 0.37 0.44 rg
36 760 540 48 re
f
Q
BT
/F1 24 Tf
1 1 1 rg
52 790 Td
(SkyPort Analysis Report) Tj
ET
BT
/F1 10 Tf
0.86 0.91 0.98 rg
52 772 Td
(Expert export package) Tj
ET
q
0.08 0.12 0.22 rg
36 610 250 126 re
f
Q
q
0.08 0.12 0.22 rg
306 610 270 126 re
f
Q
BT
/F1 11 Tf
0.95 0.97 1 rg
52 716 Td
(Analysis Snapshot) Tj
ET
BT
/F1 11 Tf
0.95 0.97 1 rg
322 716 Td
(Top Candidates) Tj
ET
"""
    left_y = 694
    right_y = 694
    left_lines = lines[:8]
    right_lines = lines[8:]
    for line in left_lines:
        content_stream += f"\nBT\n/F1 10 Tf\n0.80 0.86 0.93 rg\n52 {left_y} Td\n({_pdf_escape(line)}) Tj\nET"
        left_y -= 16
    for line in right_lines:
        content_stream += f"\nBT\n/F1 10 Tf\n0.80 0.86 0.93 rg\n322 {right_y} Td\n({_pdf_escape(line)}) Tj\nET"
        right_y -= 16
    content_stream += """
BT
/F1 10 Tf
0.58 0.64 0.74 rg
36 580 Td
(Generated by SkyPort expert workflow. This PDF summarizes the saved analysis and its best ranked cells.) Tj
ET
"""
    content = content_stream.encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >> endobj\n"
    )
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    objects.append(f"5 0 obj << /Length {len(content)} >> stream\n".encode("latin-1") + content + b"\nendstream endobj\n")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        (
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF"
        ).encode("latin-1")
    )
    path.write_bytes(pdf)


def _build_ahp_metadata(weights: dict[str, float]) -> dict[str, Any]:
    ordered_weights = [weights[key] for key in CRITERIA_ORDER]
    safe_weights = [weight if weight > 0 else 1e-6 for weight in ordered_weights]
    has_zero_weight = any(weight <= 0 for weight in ordered_weights)
    pairwise_matrix: list[list[float]] = []
    for row_weight in safe_weights:
        pairwise_matrix.append([round(row_weight / col_weight, 6) for col_weight in safe_weights])

    # A pairwise matrix derived from a validated priority vector is perfectly consistent.
    # We still expose the standard AHP consistency fields for traceability in reports.
    size = len(CRITERIA_ORDER)
    lambda_max = float(size)
    consistency_index = 0.0
    random_index = RANDOM_INDEX_BY_SIZE[size]
    consistency_ratio = 0.0 if random_index == 0 else consistency_index / random_index
    return {
        "criteria_order": CRITERIA_ORDER,
        "priority_vector": {key: round(weights[key], 6) for key in CRITERIA_ORDER},
        "pairwise_matrix": pairwise_matrix,
        "lambda_max": lambda_max,
        "consistency_index": consistency_index,
        "random_index": random_index,
        "consistency_ratio": consistency_ratio,
        "is_consistent": consistency_ratio <= 0.10,
        "note": "Consistency matrix uses a tiny epsilon fallback when a criterion weight is set to zero."
        if has_zero_weight
        else None,
    }


def _euclidean_denominator(rows: list[dict[str, float]], criterion: str) -> float:
    return sum(row[criterion] ** 2 for row in rows) ** 0.5


def _run_topsis(rows: list[dict[str, Any]], weights: dict[str, float]) -> list[dict[str, Any]]:
    if not rows:
        return []
    if len(rows) == 1:
        row = rows[0]
        weighted_score = sum(row["criteria_scores"][criterion] * weights[criterion] for criterion in CRITERIA_ORDER)
        nfz_intersects = bool((row.get("criteria_context") or {}).get("nfz", {}).get("intersects_nfz"))
        return [
            {
                "cell_index": row["cell_index"],
                "suitability_score": 0.0 if nfz_intersects else round(weighted_score * 100.0, 2),
                "criteria_breakdown": {
                    "method": "AHP_TOPSIS_SINGLE_ALTERNATIVE",
                    "note": "TOPSIS ranking requires at least two alternatives; score uses the AHP priority vector over normalized criterion scores.",
                    "criteria_order": CRITERIA_ORDER,
                    "criteria_direction": CRITERIA_DIRECTION,
                    "criteria_scores": row["criteria_scores"],
                    "criteria_context": row.get("criteria_context") or {},
                    "decision_values": row["decision_values"],
                    "normalized_values": row["criteria_scores"],
                    "weighted_values": {
                        criterion: round(row["criteria_scores"][criterion] * weights[criterion], 6)
                        for criterion in CRITERIA_ORDER
                    },
                    "ideal_best": row["criteria_scores"],
                    "ideal_worst": row["criteria_scores"],
                    "distance_to_best": 0.0,
                    "distance_to_worst": 0.0,
                    "topsis_closeness": round(weighted_score, 6),
                    "hard_constraint_violation": "NFZ_INTERSECTION" if nfz_intersects else None,
                },
                "geometry": row["geometry"],
            }
        ]

    denominators = {
        criterion: _euclidean_denominator([row["decision_values"] for row in rows], criterion)
        for criterion in CRITERIA_ORDER
    }
    weighted_rows: list[dict[str, Any]] = []
    for row in rows:
        normalized: dict[str, float] = {}
        weighted: dict[str, float] = {}
        for criterion in CRITERIA_ORDER:
            denominator = denominators[criterion]
            normalized_value = row["decision_values"][criterion] / denominator if denominator else 0.0
            normalized[criterion] = normalized_value
            weighted[criterion] = normalized_value * weights[criterion]
        weighted_rows.append({**row, "normalized_values": normalized, "weighted_values": weighted})

    ideal_best: dict[str, float] = {}
    ideal_worst: dict[str, float] = {}
    for criterion in CRITERIA_ORDER:
        values = [row["weighted_values"][criterion] for row in weighted_rows]
        if CRITERIA_DIRECTION[criterion] == "cost":
            ideal_best[criterion] = min(values)
            ideal_worst[criterion] = max(values)
        else:
            ideal_best[criterion] = max(values)
            ideal_worst[criterion] = min(values)

    results: list[dict[str, Any]] = []
    for row in weighted_rows:
        distance_to_best = (
            sum((row["weighted_values"][criterion] - ideal_best[criterion]) ** 2 for criterion in CRITERIA_ORDER) ** 0.5
        )
        distance_to_worst = (
            sum((row["weighted_values"][criterion] - ideal_worst[criterion]) ** 2 for criterion in CRITERIA_ORDER)
            ** 0.5
        )
        denominator = distance_to_best + distance_to_worst
        closeness = distance_to_worst / denominator if denominator else 1.0
        weighted_priority_score = sum(
            row["criteria_scores"][criterion] * weights[criterion] for criterion in CRITERIA_ORDER
        )
        nfz_intersects = bool((row.get("criteria_context") or {}).get("nfz", {}).get("intersects_nfz"))
        suitability_score = 0.0 if nfz_intersects else round(closeness * 100.0, 2)
        results.append(
            {
                "cell_index": row["cell_index"],
                "suitability_score": suitability_score,
                "criteria_breakdown": {
                    "method": "AHP_TOPSIS",
                    "display_score_method": "TOPSIS_CLOSENESS",
                    "criteria_order": CRITERIA_ORDER,
                    "criteria_direction": CRITERIA_DIRECTION,
                    "criteria_scores": row["criteria_scores"],
                    "criteria_context": row.get("criteria_context") or {},
                    "decision_values": row["decision_values"],
                    "normalized_values": {
                        key: round(value, 6) for key, value in row["normalized_values"].items()
                    },
                    "weighted_values": {key: round(value, 6) for key, value in row["weighted_values"].items()},
                    "ideal_best": {key: round(value, 6) for key, value in ideal_best.items()},
                    "ideal_worst": {key: round(value, 6) for key, value in ideal_worst.items()},
                    "distance_to_best": round(distance_to_best, 6),
                    "distance_to_worst": round(distance_to_worst, 6),
                    "weighted_priority_score": round(weighted_priority_score, 6),
                    "topsis_closeness": round(closeness, 6),
                    "hard_constraint_violation": "NFZ_INTERSECTION" if nfz_intersects else None,
                },
                "geometry": row["geometry"],
            }
        )
    return results


class AnalysisService:
    def _prepare_analysis_inputs(self, geodata_job_id: str) -> tuple[dict[str, Any], list[str]]:
        geodata_job = analysis_repo.get_geodata_job(geodata_job_id)
        if geodata_job is None:
            raise _error(
                status.HTTP_404_NOT_FOUND,
                "GEODATA_JOB_NOT_FOUND",
                "Geodata ingest job not found.",
            )
        if geodata_job["status"] not in {"success", "partial_success"}:
            raise _error(
                status.HTTP_409_CONFLICT,
                "GEODATA_JOB_NOT_READY",
                "Geodata ingest job must be completed before analysis can start.",
                {"status": geodata_job["status"]},
            )

        cells = analysis_repo.list_geodata_cells(geodata_job_id)
        if not cells:
            raise _error(
                status.HTTP_400_BAD_REQUEST,
                "GEODATA_CELLS_NOT_FOUND",
                "Geodata ingest job has no H3 cells to analyze.",
            )
        return geodata_job, cells

    def start_analysis(
        self,
        *,
        user_id: int,
        geodata_job_id: str,
        region_name: str | None,
        criteria_weights: dict[str, float],
    ) -> dict[str, Any]:
        weights = validate_criteria_weights(criteria_weights)
        geodata_job, cells = self._prepare_analysis_inputs(geodata_job_id)

        analysis = analysis_repo.create_analysis(
            user_id=user_id,
            geodata_job_id=geodata_job_id,
            region_name=region_name or geodata_job["region_name"],
            criteria_weights=weights,
        )
        self._start_worker(analysis["id"], geodata_job, cells, weights)
        return {
            "analysis_id": analysis["id"],
            "status": analysis["status"],
            "message": "Analysis job started.",
        }

    def recalculate_analysis(
        self,
        *,
        user_id: int,
        analysis_id: int,
        criteria_weights: dict[str, float],
    ) -> dict[str, Any]:
        weights = validate_criteria_weights(criteria_weights)
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        if analysis.get("user_id") not in (None, user_id):
            raise _error(
                status.HTTP_403_FORBIDDEN,
                "ANALYSIS_ACCESS_DENIED",
                "You do not have permission to recalculate this analysis.",
            )

        geodata_job_id = analysis.get("geodata_job_id")
        if not geodata_job_id:
            raise _error(
                status.HTTP_409_CONFLICT,
                "ANALYSIS_SOURCE_MISSING",
                "This analysis cannot be recalculated because its source geodata job is missing.",
            )

        geodata_job, cells = self._prepare_analysis_inputs(geodata_job_id)
        updated = analysis_repo.reset_analysis(analysis_id, criteria_weights=weights)
        if updated is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")

        self._start_worker(analysis_id, geodata_job, cells, weights)
        return {
            "analysis_id": analysis_id,
            "status": updated["status"],
            "message": "Analysis weights saved and recalculation has started.",
        }

    def _start_worker(
        self,
        analysis_id: int,
        geodata_job: dict[str, Any],
        cells: list[str],
        weights: dict[str, float],
    ) -> None:
        worker = Thread(
            target=self._run_analysis_job,
            args=(analysis_id, geodata_job, cells, weights),
            daemon=True,
        )
        worker.start()

    def _run_analysis_job(
        self,
        analysis_id: int,
        geodata_job: dict[str, Any],
        cells: list[str],
        weights: dict[str, float],
    ) -> None:
        try:
            results = self._calculate_results(geodata_job=geodata_job, cells=cells, weights=weights)
            analysis_repo.complete_analysis(analysis_id, results)
        except Exception:
            logger.exception("Analysis job failed (%s).", analysis_id)
            analysis_repo.fail_analysis(analysis_id)

    def _calculate_results(
        self,
        *,
        geodata_job: dict[str, Any],
        cells: list[str],
        weights: dict[str, float],
    ) -> list[dict[str, Any]]:
        layer_counts = geodata_job.get("layer_counts", {})
        buildings = float(layer_counts.get("buildings", 0))
        roads = float(layer_counts.get("roads", 0))
        land_use = float(layer_counts.get("land_use", 0))
        nfz_polygons = _nfz_polygons_for_geodata_job(geodata_job)

        obstacle_base = 1.0 - min(buildings / 1000.0, 0.65)
        transport_base = 0.35 + min(roads / 300.0, 0.65)
        land_use_base = 0.45 + min(land_use / 100.0, 0.35)

        decision_rows: list[dict[str, Any]] = []
        for cell in cells:
            cell_geometry = _cell_polygon(cell)
            nfz_score, nfz_context = _nfz_score_for_cell(cell_geometry, nfz_polygons)
            obstacle_safety = _clamp(obstacle_base - (_cell_variation(cell, "obstacle") * 0.15))
            criteria_scores = {
                "obstacle": obstacle_safety,
                "transport": _clamp(transport_base + ((_cell_variation(cell, "transport") - 0.5) * 0.20)),
                "land_use": _clamp(land_use_base + ((_cell_variation(cell, "land_use") - 0.5) * 0.18)),
                "nfz": nfz_score,
            }
            decision_values = {
                # TOPSIS handles obstacle as a cost criterion: lower risk is better.
                "obstacle": _clamp(1.0 - obstacle_safety),
                "transport": criteria_scores["transport"],
                "land_use": criteria_scores["land_use"],
                "nfz": criteria_scores["nfz"],
            }
            decision_rows.append(
                {
                    "cell_index": cell,
                    "criteria_scores": criteria_scores,
                    "criteria_context": {
                        "nfz": nfz_context,
                    },
                    "decision_values": decision_values,
                    "geometry": cell_geometry,
                }
            )
        return _run_topsis(decision_rows, weights)

    def get_status(self, analysis_id: int) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        return {
            "analysis_id": analysis["id"],
            "status": analysis["status"],
            "started_at": analysis["started_at"],
            "completed_at": analysis["completed_at"],
            "message": None,
        }

    def get_result(self, analysis_id: int) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        summary = analysis_repo.summarize_results(analysis_id)
        top_candidates = analysis_repo.list_results(analysis_id)[:5]
        return {
            "analysis_id": analysis["id"],
            "status": analysis["status"],
            "region_name": analysis["region_name"],
            "criteria_weights": analysis["criteria_weights"],
            "mcdm": _build_ahp_metadata(analysis["criteria_weights"]),
            "summary": summary,
            "top_candidates": [
                {
                    "rank": index + 1,
                    "cell_index": item["cell_index"],
                    "suitability_score": item["suitability_score"],
                    "criteria_breakdown": item["criteria_breakdown"],
                }
                for index, item in enumerate(top_candidates)
            ],
        }

    def get_heatmap(self, analysis_id: int) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        rows = analysis_repo.list_results(analysis_id, include_geometry=True)
        features = []
        for row in rows:
            if row.get("geometry") is None:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": row["geometry"],
                    "properties": {
                        "analysis_id": analysis_id,
                        "cell_index": row["cell_index"],
                        "suitability_score": row["suitability_score"],
                        "score_class": _score_class(row["suitability_score"]),
                        "criteria_breakdown": row["criteria_breakdown"],
                        "mcdm_method": "AHP_TOPSIS",
                    },
                }
            )
        return {"type": "FeatureCollection", "features": features}

    def get_cell_detail(self, analysis_id: int, cell_index: str) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")

        row = analysis_repo.get_result_by_cell(analysis_id, cell_index, include_geometry=True)
        if row is None:
            raise _error(
                status.HTTP_404_NOT_FOUND,
                "ANALYSIS_CELL_NOT_FOUND",
                "Detailed data for the selected cell is not available.",
                {"analysis_id": analysis_id, "cell_index": cell_index},
            )

        ranked_rows = analysis_repo.list_results(analysis_id)
        rank = next((index + 1 for index, item in enumerate(ranked_rows) if item["cell_index"] == cell_index), None)
        return {
            "analysis_id": analysis_id,
            "cell_index": cell_index,
            "rank": rank,
            "suitability_score": row["suitability_score"],
            "score_class": _score_class(row["suitability_score"]),
            "criteria_breakdown": row["criteria_breakdown"],
            "geometry": row.get("geometry"),
        }

    def compare_candidates(self, analysis_id: int, cell_indexes: list[str]) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")

        wanted = set(cell_indexes)
        rows = [row for row in analysis_repo.list_results(analysis_id) if row["cell_index"] in wanted]
        if len(rows) != len(wanted):
            found = {row["cell_index"] for row in rows}
            raise _error(
                status.HTTP_404_NOT_FOUND,
                "ANALYSIS_RESULT_NOT_FOUND",
                "One or more requested cells were not found for this analysis.",
                {"missing": sorted(wanted - found)},
            )
        return {
            "analysis_id": analysis_id,
            "ranked_candidates": [
                {
                    "rank": index + 1,
                    "cell_index": row["cell_index"],
                    "suitability_score": row["suitability_score"],
                    "criteria_breakdown": row["criteria_breakdown"],
                }
                for index, row in enumerate(rows)
            ],
        }

    def save_to_profile(
        self,
        *,
        user_id: int,
        analysis_id: int,
        name: str,
        map_view: dict[str, Any] | None,
        selected_bounds: dict[str, Any] | None,
    ) -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        if analysis.get("user_id") not in (None, user_id):
            raise _error(
                status.HTTP_403_FORBIDDEN,
                "ANALYSIS_ACCESS_DENIED",
                "You do not have permission to save this analysis.",
            )
        if analysis.get("status") != "completed":
            raise _error(
                status.HTTP_409_CONFLICT,
                "ANALYSIS_NOT_READY",
                "Only completed analyses can be saved to profile.",
            )

        payload = {
            "region_name": analysis.get("region_name"),
            "criteria_weights": analysis.get("criteria_weights") or {},
            "map_view": map_view or {},
            "selected_bounds": selected_bounds or {},
        }
        saved = analysis_repo.save_analysis(
            analysis_id,
            saved_name=name.strip(),
            saved_payload=payload,
        )
        if saved is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        return {
            "analysis_id": analysis_id,
            "saved_name": saved["saved_name"],
            "saved_at": saved["saved_at"],
            "message": "Analysis successfully saved to your profile.",
        }

    def run_ahp_topsis(self, region_id: str, criteria_weights: dict[str, float]) -> dict[str, Any]:
        if not criteria_weights:
            return {"status": "error", "message": "Criteria weights must not be empty.", "data": {}}
        total = sum(float(value) for value in criteria_weights.values())
        if not (0.95 <= total <= 1.05) and not (95 <= total <= 105):
            return {
                "status": "error",
                "message": "Criteria weights must sum to 1.0 or 100.",
                "data": {},
            }
        return {
            "status": "success",
            "message": "Prototype analysis completed. Use POST /api/analysis for persisted async analysis.",
            "data": {
                "analysis_id": "prototype",
                "region_id": region_id,
                "criteria_weights": criteria_weights,
                "heatmap": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [
                                    [
                                        [28.9, 41.0],
                                        [28.9, 41.1],
                                        [29.0, 41.1],
                                        [29.0, 41.0],
                                        [28.9, 41.0],
                                    ]
                                ],
                            },
            "properties": {
                                "suitability_score": 88.0,
                                "cell_index": "prototype-cell",
                                "score_class": "high",
                            },
                        }
                    ],
                },
            },
        }

    def get_user_history(self, user_id: int) -> dict[str, Any]:
        analyses = analysis_repo.list_saved_analyses(user_id)
        items = []
        for a in analyses:
            summary = analysis_repo.summarize_results(a["id"])
            items.append({
                "analysis_id": a["id"],
                "region_name": a["region_name"],
                "status": a["status"],
                "created_at": a["created_at"],
                "saved_name": a.get("saved_name"),
                "saved_at": a.get("saved_at"),
                "saved_payload": a.get("saved_payload") or {},
                "suitability_score": summary["max_score"],
            })
        return {"items": items}

    def export_results(self, *, user_id: int, analysis_id: int, format: str = "geojson") -> dict[str, Any]:
        analysis = analysis_repo.get_analysis(analysis_id)
        if analysis is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ANALYSIS_NOT_FOUND", "Analysis not found.")
        if analysis.get("user_id") not in (None, user_id):
            raise _error(
                status.HTTP_403_FORBIDDEN,
                "ANALYSIS_ACCESS_DENIED",
                "You do not have permission to export this analysis.",
            )
        if analysis.get("status") != "completed":
            raise _error(
                status.HTTP_409_CONFLICT,
                "ANALYSIS_NOT_READY",
                "Only completed analyses can be exported.",
            )

        normalized_format = format.strip().lower()
        if normalized_format not in {"geojson", "pdf"}:
            raise _error(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_EXPORT_FORMAT",
                "format must be either 'geojson' or 'pdf'.",
                {"allowed": ["geojson", "pdf"]},
            )

        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        base_name = f"{_safe_slug(analysis.get('saved_name') or analysis.get('region_name') or f'analysis-{analysis_id}')}--{analysis_id}--{timestamp}"

        if normalized_format == "geojson":
            heatmap = self.get_heatmap(analysis_id)
            file_name = f"{base_name}.geojson"
            file_path = EXPORTS_DIR / file_name
            file_path.write_text(json.dumps(heatmap, ensure_ascii=False, indent=2), encoding="utf-8")
            report = report_repo.create_report(
                analysis_id=analysis_id,
                user_id=user_id,
                report_format="geojson",
                file_path=str(file_path),
            )
            return {
                "report_id": report["id"],
                "analysis_id": analysis_id,
                "format": "geojson",
                "file_name": file_name,
                "download_url": f"/api/analysis/reports/{report['id']}/download",
                "geojson": heatmap,
            }

        summary = analysis_repo.summarize_results(analysis_id)
        results = analysis_repo.list_results(analysis_id)
        report_payload = {
            "analysis": analysis,
            "summary": summary,
            "top_candidates": results[:10],
        }
        file_name = f"{base_name}.pdf"
        file_path = EXPORTS_DIR / file_name
        top_lines = [
            f"Analysis ID: {analysis_id}",
            f"Region: {analysis.get('saved_name') or analysis.get('region_name') or 'Unnamed analysis'}",
            f"Saved Name: {analysis.get('saved_name') or '-'}",
            f"Exported At: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"Cell Count: {summary['cell_count']}",
            f"Average Score: {summary['average_score']}",
            f"Max Score: {summary['max_score']}",
            f"Min Score: {summary['min_score']}",
            "1. Top ranked cells",
        ]
        for index, row in enumerate(results[:10], start=1):
            top_lines.append(
                f"{index}. {row['cell_index']} - suitability {row['suitability_score']}"
            )
        _write_simple_pdf(file_path, top_lines)
        report = report_repo.create_report(
            analysis_id=analysis_id,
            user_id=user_id,
            report_format="pdf",
            file_path=str(file_path),
        )
        return {
            "report_id": report["id"],
            "analysis_id": analysis_id,
            "format": normalized_format,
            "file_name": file_name,
            "download_url": f"/api/analysis/reports/{report['id']}/download",
            "report": report_payload,
        }

    def get_report_download(self, *, user_id: int, report_id: int) -> dict[str, Any]:
        report = report_repo.get_report(report_id)
        if report is None:
            raise _error(status.HTTP_404_NOT_FOUND, "REPORT_NOT_FOUND", "Report not found.")
        if report.get("user_id") not in (None, user_id):
            raise _error(
                status.HTTP_403_FORBIDDEN,
                "REPORT_ACCESS_DENIED",
                "You do not have permission to download this report.",
            )
        file_path = Path(report["file_path"])
        if not file_path.exists():
            raise _error(
                status.HTTP_404_NOT_FOUND,
                "REPORT_FILE_NOT_FOUND",
                "Generated report file could not be found on disk.",
            )
        return {
            "report_id": report["id"],
            "file_path": file_path,
            "format": report["report_format"],
        }
