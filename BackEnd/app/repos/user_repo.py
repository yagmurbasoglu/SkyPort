from typing import Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Optional[User]:
        normalized_email = email.strip().lower()
        return self.db.query(User).filter(func.lower(User.email) == normalized_email).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def create(self, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            role=obj_in.role.value,
            full_name=obj_in.full_name,
            is_active=obj_in.is_active,
        )
        self.db.add(db_obj)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise
        self.db.refresh(db_obj)
        return db_obj

    def update(self, db_obj: User, obj_in: dict) -> User:
        for field, value in obj_in.items():
            if field == "password":
                setattr(db_obj, "password_hash", get_password_hash(value))
            else:
                setattr(db_obj, field, value)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
