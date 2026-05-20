from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Event, Lock
from typing import Any


@dataclass
class JobControl:
    state: str = "running"
    pause_event: Event = field(default_factory=Event)
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        self.pause_event.set()


class RuntimeState:
    def __init__(self) -> None:
        self._lock = Lock()
        self._maintenance_mode = False
        self._maintenance_message = "System maintenance is in progress."
        self._maintenance_since: datetime | None = None
        self._request_counts: dict[str, int] = defaultdict(int)
        self._status_counts: dict[int, int] = defaultdict(int)
        self._latencies_ms: deque[float] = deque(maxlen=400)
        self._job_controls: dict[str, dict[str, JobControl]] = {
            "analysis": {},
            "geodata": {},
        }

    def maintenance_snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "enabled": self._maintenance_mode,
                "message": self._maintenance_message,
                "since": self._maintenance_since,
            }

    def set_maintenance(self, enabled: bool, message: str | None = None) -> dict[str, Any]:
        with self._lock:
            self._maintenance_mode = bool(enabled)
            if message:
                self._maintenance_message = message.strip()
            self._maintenance_since = datetime.now(timezone.utc) if enabled else None
            return self.maintenance_snapshot()

    def is_request_allowed(self, path: str) -> bool:
        with self._lock:
            if not self._maintenance_mode:
                return True
        return path.startswith("/health") or path.startswith("/api/system")

    def record_request(self, method: str, path: str, status_code: int, latency_ms: float) -> None:
        key = f"{method.upper()} {path}"
        with self._lock:
            self._request_counts[key] += 1
            self._status_counts[int(status_code)] += 1
            self._latencies_ms.append(float(latency_ms))

    def metrics_snapshot(self) -> dict[str, Any]:
        with self._lock:
            latencies = list(self._latencies_ms)
            avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
            active_jobs = {
                kind: {
                    job_id: {
                        "state": control.state,
                        "updated_at": control.updated_at,
                    }
                    for job_id, control in controls.items()
                    if control.state not in {"completed", "failed"}
                }
                for kind, controls in self._job_controls.items()
            }
            return {
                "maintenance": self.maintenance_snapshot(),
                "request_counts": dict(self._request_counts),
                "status_counts": dict(self._status_counts),
                "average_latency_ms": avg_latency,
                "sample_count": len(latencies),
                "active_jobs": active_jobs,
            }

    def register_job(self, kind: str, job_id: str) -> None:
        with self._lock:
            control = self._job_controls.setdefault(kind, {}).get(job_id) or JobControl()
            control.state = "running"
            control.updated_at = datetime.now(timezone.utc)
            control.pause_event.set()
            self._job_controls[kind][job_id] = control

    def complete_job(self, kind: str, job_id: str, *, state: str = "completed") -> None:
        with self._lock:
            control = self._job_controls.setdefault(kind, {}).get(job_id) or JobControl()
            control.state = state
            control.updated_at = datetime.now(timezone.utc)
            control.pause_event.set()
            self._job_controls[kind][job_id] = control

    def pause_job(self, kind: str, job_id: str) -> str:
        with self._lock:
            control = self._job_controls.setdefault(kind, {}).get(job_id)
            if control is None:
                control = JobControl()
                self._job_controls[kind][job_id] = control
            if control.state in {"completed", "failed"}:
                return control.state
            control.state = "paused"
            control.updated_at = datetime.now(timezone.utc)
            control.pause_event.clear()
            return control.state

    def resume_job(self, kind: str, job_id: str) -> str:
        with self._lock:
            control = self._job_controls.setdefault(kind, {}).get(job_id)
            if control is None:
                control = JobControl()
                self._job_controls[kind][job_id] = control
            if control.state in {"completed", "failed"}:
                return control.state
            control.state = "running"
            control.updated_at = datetime.now(timezone.utc)
            control.pause_event.set()
            return control.state

    def get_job_state(self, kind: str, job_id: str) -> str:
        with self._lock:
            control = self._job_controls.get(kind, {}).get(job_id)
            return control.state if control else "running"

    def wait_if_paused(self, kind: str, job_id: str) -> None:
        while True:
            with self._lock:
                control = self._job_controls.setdefault(kind, {}).get(job_id)
                if control is None or control.state != "paused":
                    return
                pause_event = control.pause_event
            pause_event.wait(timeout=0.25)


runtime_state = RuntimeState()
