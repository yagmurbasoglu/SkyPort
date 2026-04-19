from __future__ import annotations

from heapq import heappop, heappush
from math import atan2, cos, radians, sin, sqrt
from typing import Callable

Coordinate = tuple[float, float]


def _distance_km(a: Coordinate, b: Coordinate) -> float:
    radius_km = 6371.0
    d_lat = radians(b[1] - a[1])
    d_lng = radians(b[0] - a[0])
    lat1 = radians(a[1])
    lat2 = radians(b[1])
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lng / 2) ** 2
    return radius_km * 2 * atan2(sqrt(h), sqrt(1 - h))


def _build_grid(start: Coordinate, end: Coordinate, resolution: int = 14) -> list[list[Coordinate]]:
    min_lng = min(start[0], end[0])
    max_lng = max(start[0], end[0])
    min_lat = min(start[1], end[1])
    max_lat = max(start[1], end[1])
    lng_span = max(max_lng - min_lng, 0.02)
    lat_span = max(max_lat - min_lat, 0.02)
    padding_lng = max(lng_span * 0.25, 0.012)
    padding_lat = max(lat_span * 0.25, 0.012)
    west = min_lng - padding_lng
    east = max_lng + padding_lng
    south = min_lat - padding_lat
    north = max_lat + padding_lat

    return [
        [
            (
                west + ((east - west) * col / resolution),
                south + ((north - south) * row / resolution),
            )
            for col in range(resolution + 1)
        ]
        for row in range(resolution + 1)
    ]


def _nearest_node(grid: list[list[Coordinate]], point: Coordinate) -> tuple[int, int]:
    best = (0, 0)
    best_distance = float("inf")
    for row_index, row in enumerate(grid):
        for col_index, candidate in enumerate(row):
            distance = _distance_km(point, candidate)
            if distance < best_distance:
                best_distance = distance
                best = (row_index, col_index)
    return best


def find_astar_route(
    start: Coordinate,
    end: Coordinate,
    *,
    is_blocked_edge: Callable[[Coordinate, Coordinate], bool],
    resolution: int = 18,
) -> list[list[float]] | None:
    grid = _build_grid(start, end, resolution=resolution)
    start_node = _nearest_node(grid, start)
    end_node = _nearest_node(grid, end)
    frontier: list[tuple[float, tuple[int, int]]] = []
    heappush(frontier, (0.0, start_node))
    came_from: dict[tuple[int, int], tuple[int, int] | None] = {start_node: None}
    cost_so_far: dict[tuple[int, int], float] = {start_node: 0.0}
    edge_cache: dict[tuple[Coordinate, Coordinate], bool] = {}
    directions = [
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    ]

    while frontier:
        _, current = heappop(frontier)
        if current == end_node:
            break

        current_point = grid[current[0]][current[1]]
        for row_delta, col_delta in directions:
            neighbor = (current[0] + row_delta, current[1] + col_delta)
            if neighbor[0] < 0 or neighbor[1] < 0 or neighbor[0] >= len(grid) or neighbor[1] >= len(grid[0]):
                continue
            neighbor_point = grid[neighbor[0]][neighbor[1]]
            cache_key = (current_point, neighbor_point)
            reverse_key = (neighbor_point, current_point)
            blocked = edge_cache.get(cache_key)
            if blocked is None:
                blocked = edge_cache.get(reverse_key)
            if blocked is None:
                blocked = is_blocked_edge(current_point, neighbor_point)
                edge_cache[cache_key] = blocked
            if blocked:
                continue

            next_cost = cost_so_far[current] + _distance_km(current_point, neighbor_point)
            if neighbor not in cost_so_far or next_cost < cost_so_far[neighbor]:
                cost_so_far[neighbor] = next_cost
                priority = next_cost + _distance_km(neighbor_point, grid[end_node[0]][end_node[1]])
                heappush(frontier, (priority, neighbor))
                came_from[neighbor] = current

    if end_node not in came_from:
        return None

    nodes: list[tuple[int, int]] = []
    current: tuple[int, int] | None = end_node
    while current is not None:
        nodes.append(current)
        current = came_from[current]
    nodes.reverse()

    route: list[Coordinate] = [start]
    route.extend(grid[row][col] for row, col in nodes)
    route.append(end)
    return _smooth_route(_dedupe_route([[lng, lat] for lng, lat in route]), is_blocked_edge)


def _dedupe_route(route: list[list[float]]) -> list[list[float]]:
    deduped: list[list[float]] = []
    for point in route:
        if not deduped or point != deduped[-1]:
            deduped.append(point)
    return deduped


def _smooth_route(
    route: list[list[float]],
    is_blocked_edge: Callable[[Coordinate, Coordinate], bool],
) -> list[list[float]]:
    if len(route) <= 2:
        return route

    smoothed = [route[0]]
    anchor_index = 0
    while anchor_index < len(route) - 1:
        anchor = (route[anchor_index][0], route[anchor_index][1])
        next_index = anchor_index + 1
        for candidate_index in range(len(route) - 1, anchor_index, -1):
            candidate = (route[candidate_index][0], route[candidate_index][1])
            if not is_blocked_edge(anchor, candidate):
                next_index = candidate_index
                break
        smoothed.append(route[next_index])
        anchor_index = next_index
    return smoothed
