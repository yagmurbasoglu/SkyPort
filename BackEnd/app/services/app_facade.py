from __future__ import annotations

from app.models.user import User
from app.services.analysis_service import AnalysisService
from app.services.route_service import RouteService
from app.services.user_service import UserService


class AppFacade:
    """
    Thin coordination layer matching the SDD's application-facade concept.
    It centralizes service access and keeps route handlers lighter.
    """

    def __init__(self, current_user: User | None = None) -> None:
        self.current_user = current_user
        self.analysis = AnalysisService()
        self.route = RouteService()

    def validate_session(self) -> User | None:
        return self.current_user

    def handle_exception(self, error: Exception) -> Exception:
        return error

    def aggregate_response(self, **module_results):
        return module_results

    def get_user_service(self, db):
        return UserService(db)
