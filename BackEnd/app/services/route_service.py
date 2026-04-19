from math import atan2, cos, radians, sin, sqrt
from typing import Any

from fastapi import HTTPException, status

from app.repos import route_repo
from app.schemas.route import RouteCreateRequest, RoutePoint
from app.services.pathfinding import find_astar_route
from app.services.weather_service import WeatherService


def _error(status_code: int, code: str, message: str, details: dict | None = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details or {}},
    )


def _haversine_km(start: RoutePoint, end: RoutePoint) -> float:
    radius_km = 6371.0
    d_lat = radians(end.lat - start.lat)
    d_lng = radians(end.lng - start.lng)
    lat1 = radians(start.lat)
    lat2 = radians(end.lat)
    a = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lng / 2) ** 2
    return radius_km * 2 * atan2(sqrt(a), sqrt(1 - a))


def _build_route_coordinates(start: RoutePoint, end: RoutePoint, *, arc_scale: float = 0.015) -> list[list[float]]:
    steps = 40
    d_lng = end.lng - start.lng
    d_lat = end.lat - start.lat
    perp_len = sqrt((d_lng * d_lng) + (d_lat * d_lat)) or 1.0
    coordinates: list[list[float]] = []
    for index in range(steps + 1):
        t = index / steps
        lng = start.lng + d_lng * t
        lat = start.lat + d_lat * t
        arc = sin(t * 3.141592653589793) * arc_scale
        coordinates.append([lng + (-d_lat / perp_len) * arc, lat + (d_lng / perp_len) * arc])
    return coordinates


def _point_from_record(record: dict[str, Any]) -> RoutePoint:
    return RoutePoint(lat=float(record["lat"]), lng=float(record["lng"]), name=record.get("name"))


def _point_from_coordinates(coordinates: list[float], name: str | None = None) -> RoutePoint:
    return RoutePoint(lng=float(coordinates[0]), lat=float(coordinates[1]), name=name)


class RouteService:
    def __init__(self) -> None:
        self.weather_service = WeatherService()

    def create_route(self, *, user_id: int, req: RouteCreateRequest) -> dict[str, Any]:
        start, end = self._resolve_points(req)
        distance_km = _haversine_km(start, end)
        if distance_km < 0.05:
            raise _error(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_ROUTE_POINTS",
                "Route origin and destination are too close to simulate.",
            )

        coordinates = self._build_candidate_route(start, end, avoid_nfz=req.constraints.avoid_nfz)
        duration_min = max(3, round(distance_km / 2.0))
        price_tl = round((distance_km * 4.5) + 15.0, 2)
        weather = self.weather_service.get_route_weather(coordinates, req.constraints.max_wind_kmh)

        route = route_repo.create_route(
            user_id=user_id,
            from_vertiport_id=req.from_vertiport_id,
            to_vertiport_id=req.to_vertiport_id,
            coordinates=coordinates,
            distance_km=distance_km,
            duration_min=duration_min,
            price_tl=price_tl,
            weather_snapshot=weather,
        )
        safety = self.evaluate_safety(route["id"], user_id=user_id, constraints=req.constraints.model_dump())
        route = route_repo.update_route_status(route["id"], safety["safety_status"]) or route
        return self._build_route_response(route, safety=safety, start=start, end=end)

    def _resolve_points(self, req: RouteCreateRequest) -> tuple[RoutePoint, RoutePoint]:
        if req.from_point and req.to_point:
            return req.from_point, req.to_point

        from_record = route_repo.get_vertiport_point(req.from_vertiport_id) if req.from_vertiport_id else None
        to_record = route_repo.get_vertiport_point(req.to_vertiport_id) if req.to_vertiport_id else None
        if from_record is None or to_record is None:
            raise _error(
                status.HTTP_404_NOT_FOUND,
                "VERTIPORT_NOT_FOUND",
                "One or more requested vertiports were not found.",
            )
        return _point_from_record(from_record), _point_from_record(to_record)

    def _build_candidate_route(self, start: RoutePoint, end: RoutePoint, *, avoid_nfz: bool) -> list[list[float]]:
        if not avoid_nfz:
            return _build_route_coordinates(start, end)

        astar_route = find_astar_route(
            (start.lng, start.lat),
            (end.lng, end.lat),
            is_blocked_edge=lambda a, b: route_repo.count_nfz_intersections_for_coordinates(
                [[a[0], a[1]], [b[0], b[1]]]
            )
            > 0,
        )
        if astar_route and route_repo.count_nfz_intersections_for_coordinates(astar_route) == 0:
            return astar_route

        best_coordinates = _build_route_coordinates(start, end)
        best_hits: int | None = None
        for arc_scale in (0.015, -0.015, 0.035, -0.035, 0.06, -0.06, 0.09, -0.09, 0.0):
            coordinates = _build_route_coordinates(start, end, arc_scale=arc_scale)
            hit_count = route_repo.count_nfz_intersections_for_coordinates(coordinates)
            if hit_count == 0:
                return coordinates
            if best_hits is None or hit_count < best_hits:
                best_hits = hit_count
                best_coordinates = coordinates
        return best_coordinates

    def evaluate_safety(
        self,
        route_id: int,
        *,
        user_id: int,
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        constraints = constraints or {}
        route = route_repo.get_route(route_id, user_id=user_id)
        if route is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ROUTE_NOT_FOUND", "Route not found.")

        conflicts: list[dict[str, Any]] = []
        warnings: list[str] = []
        if constraints.get("avoid_nfz", True):
            nfz_hits = route_repo.list_nfz_intersections(route_id)
            for hit in nfz_hits:
                block_geometry = hit.get("block_point") or {}
                conflicts.append(
                    {
                        "type": "nfz",
                        "severity": "blocker",
                        "message": "Route intersects no-fly zone.",
                        "zone_id": hit.get("id"),
                        "zone_name": hit.get("zone_name") or hit.get("zone_code"),
                        "route_progress": float(hit["route_progress"]) if hit.get("route_progress") is not None else None,
                        "block_point": block_geometry.get("coordinates") if isinstance(block_geometry, dict) else None,
                    }
                )

        controlled_hits = route_repo.list_controlled_airspace_intersections(route_id)
        for hit in controlled_hits:
            conflicts.append(
                {
                    "type": "controlled_airspace",
                    "severity": "warning",
                    "message": "Route intersects controlled airspace; operational approval may be required.",
                    "zone_id": hit.get("id"),
                    "zone_name": hit.get("zone_name") or hit.get("zone_code"),
                }
            )

        if constraints.get("avoid_obstacles", True):
            obstacle_hits = route_repo.list_building_obstacle_intersections(route_id)
            if obstacle_hits:
                for hit in obstacle_hits:
                    block_geometry = hit.get("block_point") or {}
                    conflicts.append(
                        {
                            "type": "obstacle",
                            "severity": "blocker",
                            "message": "Route intersects building obstacle geometry.",
                            "zone_id": hit.get("id"),
                            "zone_name": hit.get("zone_name"),
                            "route_progress": float(hit["route_progress"])
                            if hit.get("route_progress") is not None
                            else None,
                            "block_point": block_geometry.get("coordinates")
                            if isinstance(block_geometry, dict)
                            else None,
                        }
                    )
            else:
                warnings.append(
                    "No persisted building obstacle geometry intersects this route; "
                    "run geodata ingest for the selected corridor to refresh obstacle data."
                )

        weather = route.get("weather_snapshot", {})
        if weather.get("warning"):
            warnings.append(weather["warning"])
        weather_values = [
            weather.get("wind_kmh"),
            weather.get("wind_gusts_kmh"),
            weather.get("wind_80m_kmh"),
            weather.get("wind_120m_kmh"),
        ]
        max_weather_wind = max([float(value) for value in weather_values if value is not None] or [0.0])
        weather_risk = weather.get("is_safe") is False or max_weather_wind > constraints.get("max_wind_kmh", 35.0)
        if weather_risk:
            conflicts.append(
                {
                    "type": "weather",
                    "severity": "blocker",
                    "message": "Wind speed exceeds configured route safety limit.",
                    "zone_id": None,
                    "zone_name": None,
                }
            )

        has_blocker = any(conflict["severity"] == "blocker" for conflict in conflicts)
        has_warning = any(conflict["severity"] == "warning" for conflict in conflicts) or bool(warnings)
        if weather_risk:
            safety_status = "weather_risk"
        elif has_blocker:
            safety_status = "unsafe"
        elif has_warning:
            safety_status = "warning"
        else:
            safety_status = "safe"

        return {
            "route_id": route_id,
            "safety_status": safety_status,
            "is_safe": safety_status in {"safe", "warning"},
            "conflicts": conflicts,
            "warnings": warnings,
        }

    def get_simulation(self, route_id: int, *, user_id: int) -> dict[str, Any]:
        route = route_repo.get_route(route_id, user_id=user_id)
        if route is None:
            raise _error(status.HTTP_404_NOT_FOUND, "ROUTE_NOT_FOUND", "Route not found.")
        safety = self.evaluate_safety(route_id, user_id=user_id)
        start = _point_from_coordinates(route["coordinates"][0], "Departure")
        end = _point_from_coordinates(route["coordinates"][-1], "Arrival")
        response = self._build_route_response(route, safety=safety, start=start, end=end)
        return {
            "route_id": response["route_id"],
            "status": response["status"],
            "safety_status": response["safety_status"],
            "distance_km": response["distance_km"],
            "duration_min": response["duration_min"],
            "price_tl": response["price_tl"],
            "weather": response["weather"],
            "warnings": response["warnings"],
            "geojson": {
                "type": "Feature",
                "geometry": route["geojson"],
                "properties": {
                    "route_id": response["route_id"],
                    "safety_status": response["safety_status"],
                    "distance_km": response["distance_km"],
                },
            },
        }

    def _build_route_response(
        self,
        route: dict[str, Any],
        *,
        safety: dict[str, Any],
        start: RoutePoint,
        end: RoutePoint,
    ) -> dict[str, Any]:
        return {
            "route_id": route["id"],
            "status": safety["safety_status"],
            "safety_status": safety["safety_status"],
            "is_safe": safety["is_safe"],
            "coordinates": route["coordinates"],
            "distance_km": route["distance_km"],
            "duration_min": route["duration_min"],
            "price_tl": route["price_tl"],
            "from_point": start.model_dump(),
            "to_point": end.model_dump(),
            "weather": route["weather_snapshot"],
            "conflicts": safety["conflicts"],
            "warnings": safety["warnings"],
            "created_at": route["created_at"],
        }
