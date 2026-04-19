from sqlalchemy import Table, Column, BigInteger, DateTime, MetaData, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

metadata = MetaData()

favorites_table = Table(
    "favorites",
    metadata,
    Column("user_id", BigInteger, primary_key=True),
    Column("vertiport_id", BigInteger, primary_key=True),
    Column("created_at", DateTime, server_default=text("now()"))
)

def add_favorite(db: Session, user_id: int, vertiport_id: int):
    try:
        db.execute(favorites_table.insert().values(user_id=user_id, vertiport_id=vertiport_id))
        db.commit()
    except IntegrityError:
        db.rollback()

def remove_favorite(db: Session, user_id: int, vertiport_id: int):
    db.execute(favorites_table.delete().where(
        (favorites_table.c.user_id == user_id) & (favorites_table.c.vertiport_id == vertiport_id)
    ))
    db.commit()

def get_user_favorites(db: Session, user_id: int) -> list[int]:
    results = db.execute(favorites_table.select().where(favorites_table.c.user_id == user_id)).fetchall()
    # The result row can be accessed via index (1 is vertiport_id) or attribute
    # In SQLAlchemy 2.0, row has attributes matching column names
    return [row.vertiport_id for row in results]
