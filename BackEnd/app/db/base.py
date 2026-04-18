from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import User  # noqa
from app.models.analysis import Analysis, AnalysisResult  # noqa

