import hashlib
import logging
from math import isfinite
from threading import Thread
from typing import Any

from fastapi import HTTPException, status
from shapely.geometry import Polygon

from app.repos import analysis_repo

try:
    import h3
except ModuleNotFoundError:  # pragma: no cover - environment-dependent
    h3 = None

logger = logging.getLogger(__name__)

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


def _score_class(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def _build_ahp_metadata(weights: dict[str, float]) -> dict[str, Any]:
    ordered_weights = [weights[key] for key in CRITERIA_ORDER]
    pairwise_matrix: list[list[float]] = []
    for row_weight in ordered_weights:
        pairwise_matrix.append([round(row_weight / col_weight, 6) for col_weight in ordered_weights])

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
    }


def _euclidean_denominator(rows: list[dict[str, float]], criterion: str) -> float:
    return sum(row[criterion] ** 2 for row in rows) ** 0.5


def _run_topsis(rows: list[dict[str, Any]], weights: dict[str, float]) -> list[dict[str, Any]]:
    if not rows:
        return []
    if len(rows) == 1:
        row = rows[0]
        weighted_score = sum(row["criteria_scores"][criterion] * weights[criterion] for criterion in CRITERIA_ORDER)
        return [
            {
                "cell_index": row["cell_index"],
                "suitability_score": round(weighted_score * 100.0, 2),
                "criteria_breakdown": {
                    "method": "AHP_TOPSIS_SINGLE_ALTERNATIVE",
                    "note": "TOPSIS ranking requires at least two alternatives; score uses the AHP priority vector over normalized criterion scores.",
                    "criteria_order": CRITERIA_ORDER,
                    "criteria_direction": CRITERIA_DIRECTION,
                    "criteria_scores": row["criteria_scores"],
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
        suitability_score = round(closeness * 100.0, 2)
        results.append(
            {
                "cell_index": row["cell_index"],
                "suitability_score": suitability_score,
                "criteria_breakdown": {
                    "method": "AHP_TOPSIS",
                    "criteria_order": CRITERIA_ORDER,
                    "criteria_direction": CRITERIA_DIRECTION,
                    "criteria_scores": row["criteria_scores"],
                    "decision_values": row["decision_values"],
                    "normalized_values": {
                        key: round(value, 6) for key, value in row["normalized_values"].items()
                    },
                    "weighted_values": {key: round(value, 6) for key, value in row["weighted_values"].items()},
                    "ideal_best": {key: round(value, 6) for key, value in ideal_best.items()},
                    "ideal_worst": {key: round(value, 6) for key, value in ideal_worst.items()},
                    "distance_to_best": round(distance_to_best, 6),
                    "distance_to_worst": round(distance_to_worst, 6),
                    "topsis_closeness": round(closeness, 6),
                },
                "geometry": row["geometry"],
            }
        )
    return results


class AnalysisService:
    def start_analysis(
        self,
        *,
        user_id: int,
        geodata_job_id: str,
        region_name: str | None,
        criteria_weights: dict[str, float],
    ) -> dict[str, Any]:
        weights = validate_criteria_weights(criteria_weights)
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

        analysis = analysis_repo.create_analysis(
            user_id=user_id,
            region_name=region_name or geodata_job["region_name"],
            criteria_weights=weights,
        )
        self._start_worker(analysis["id"], geodata_job, cells, weights)
        return {
            "analysis_id": analysis["id"],
            "status": analysis["status"],
            "message": "Analysis job started.",
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
        nfz = float(layer_counts.get("nfz", 0))

        obstacle_base = 1.0 - min(buildings / 1000.0, 0.65)
        transport_base = 0.35 + min(roads / 300.0, 0.65)
        land_use_base = 0.45 + min(land_use / 100.0, 0.35)
        nfz_base = 0.25 if nfz > 0 else 1.0

        decision_rows: list[dict[str, Any]] = []
        for cell in cells:
            obstacle_safety = _clamp(obstacle_base - (_cell_variation(cell, "obstacle") * 0.15))
            criteria_scores = {
                "obstacle": obstacle_safety,
                "transport": _clamp(transport_base + ((_cell_variation(cell, "transport") - 0.5) * 0.20)),
                "land_use": _clamp(land_use_base + ((_cell_variation(cell, "land_use") - 0.5) * 0.18)),
                "nfz": _clamp(nfz_base - (_cell_variation(cell, "nfz") * 0.10 if nfz > 0 else 0.0)),
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
                    "decision_values": decision_values,
                    "geometry": _cell_polygon(cell),
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
