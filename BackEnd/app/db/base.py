from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import User  # noqa
from app.models.vertiport import Vertiport  # noqa
from app.models.analysis import Analysis, AnalysisResult  # noqa
from app.models.report import Report  # noqa
from app.models.route import Route  # noqa
from app.models.flight_booking import FlightBooking  # noqa
from app.models.vertiport_review import VertiportReview  # noqa

