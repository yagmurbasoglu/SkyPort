from sqlalchemy import Table, Column, BigInteger, DateTime, MetaData, String, text, update
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

metadata = MetaData()

favorites_table = Table(
    "favorites",
    metadata,
    Column("user_id", BigInteger, primary_key=True),
    Column("vertiport_id", BigInteger, primary_key=True),
    Column("label", String(20), nullable=False, server_default=text("'standard'")),
    Column("created_at", DateTime, server_default=text("now()"))
)

def add_favorite(db: Session, user_id: int, vertiport_id: int, label: str = "standard"):
    try:
        db.execute(favorites_table.insert().values(user_id=user_id, vertiport_id=vertiport_id, label=label))
        db.commit()
    except IntegrityError:
        db.rollback()
        db.execute(
            update(favorites_table)
            .where(
                (favorites_table.c.user_id == user_id) & (favorites_table.c.vertiport_id == vertiport_id)
            )
            .values(label=label)
        )
        db.commit()

def remove_favorite(db: Session, user_id: int, vertiport_id: int):
    db.execute(favorites_table.delete().where(
        (favorites_table.c.user_id == user_id) & (favorites_table.c.vertiport_id == vertiport_id)
    ))
    db.commit()

def get_user_favorites(db: Session, user_id: int) -> list[dict]:
    results = db.execute(favorites_table.select().where(favorites_table.c.user_id == user_id)).fetchall()
    return [
        {
            "vertiport_id": row.vertiport_id,
            "label": getattr(row, "label", "standard") or "standard",
            "created_at": getattr(row, "created_at", None),
        }
        for row in results
    ]
