import json

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


MOCK_VERTIPORTS = [
    {
        "name": "Ataturk Airport Vertiport",
        "lat": 40.9769,
        "lng": 28.8143,
        "suitability_score": 88,
        "price_per_km": 3.2,
        "description": "Main hub at the former Ataturk Airport site, fully equipped for UAM operations.",
        "features": ["parking", "ev_charging"],
        "noise_level": "medium",
    },
    {
        "name": "Sabiha Gokcen Vertiport",
        "lat": 40.8987,
        "lng": 29.3095,
        "suitability_score": 82,
        "price_per_km": 3.5,
        "description": "Eastern hub integrated with Sabiha Gokcen International Airport.",
        "features": ["parking", "ev_charging"],
        "noise_level": "medium",
    },
    {
        "name": "Mecidiyekoy Transfer Vertiport",
        "lat": 41.0678,
        "lng": 28.9876,
        "suitability_score": 91,
        "price_per_km": 4.0,
        "description": "Dense transfer hub placed outside core NFZ corridors, with direct metro access for passenger routes.",
        "features": ["metro", "low_noise"],
        "noise_level": "low",
    },
    {
        "name": "Kadikoy Hub Vertiport",
        "lat": 40.9905,
        "lng": 29.0302,
        "suitability_score": 87,
        "price_per_km": 3.6,
        "description": "Central Asian-side vertiport near Kadikoy ferry and metro station.",
        "features": ["metro", "low_noise"],
        "noise_level": "low",
    },
    {
        "name": "Zeytinburnu Central Vertiport",
        "lat": 41.0065,
        "lng": 28.9098,
        "suitability_score": 79,
        "price_per_km": 4.2,
        "description": "High-demand western connector placed on a safer urban corridor away from NFZ clusters.",
        "features": ["metro"],
        "noise_level": "high",
    },
    {
        "name": "Bagcilar Metro Vertiport",
        "lat": 41.04,
        "lng": 28.855,
        "suitability_score": 74,
        "price_per_km": 2.8,
        "description": "Western corridor vertiport serving Bagcilar and Esenler districts.",
        "features": ["metro"],
        "noise_level": "medium",
    },
    {
        "name": "Sariyer North Vertiport",
        "lat": 41.1667,
        "lng": 29.05,
        "suitability_score": 85,
        "price_per_km": 3.1,
        "description": "Quiet northern Bosphorus vertiport, ideal for suburban commuters.",
        "features": ["low_noise", "parking"],
        "noise_level": "low",
    },
    {
        "name": "Kartal East Vertiport",
        "lat": 40.881,
        "lng": 29.2017,
        "suitability_score": 80,
        "price_per_km": 2.9,
        "description": "Far-east hub connecting Kartal, Maltepe, and Pendik districts.",
        "features": ["parking"],
        "noise_level": "medium",
    },
    {
        "name": "Bakirkoy Coast Vertiport",
        "lat": 40.9794,
        "lng": 28.8694,
        "suitability_score": 76,
        "price_per_km": 3.0,
        "description": "Coastal vertiport west of the city, near Florya and Yesilkoy.",
        "features": ["parking", "low_noise"],
        "noise_level": "low",
    },
    {
        "name": "Umraniye Transfer Vertiport",
        "lat": 41.0248,
        "lng": 29.1165,
        "suitability_score": 90,
        "price_per_km": 3.8,
        "description": "Asian-side transfer vertiport shifted outside the Bosphorus NFZ band for safer passenger routing.",
        "features": ["metro", "low_noise"],
        "noise_level": "low",
    },
    {
        "name": "Sultangazi North Vertiport",
        "lat": 41.1185,
        "lng": 28.886,
        "suitability_score": 84,
        "price_per_km": 3.3,
        "description": "Northern commuter vertiport repositioned away from coastal NFZ pressure and optimized for route tests.",
        "features": ["metro", "ev_charging"],
        "noise_level": "medium",
    },
    {
        "name": "Basaksehir Valley Vertiport",
        "lat": 41.1018,
        "lng": 28.8022,
        "suitability_score": 83,
        "price_per_km": 3.2,
        "description": "Short-hop western vertiport intended for passenger route simulation checks outside active NFZ geometry.",
        "features": ["low_noise", "parking"],
        "noise_level": "low",
    },
]

DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/skyport"


def seed():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("Clearing existing vertiports...")
    session.execute(text("TRUNCATE TABLE vertiports RESTART IDENTITY CASCADE"))

    print(f"Seeding {len(MOCK_VERTIPORTS)} vertiports...")
    for vp in MOCK_VERTIPORTS:
        query = text(
            """
            INSERT INTO vertiports (
                name,
                location,
                suitability_score,
                price_per_km,
                description,
                features,
                noise_level,
                is_active
            )
            VALUES (
                :name,
                ST_SetSRID(ST_Point(:lng, :lat), 4326),
                :score,
                :price,
                :desc,
                CAST(:features AS json),
                :noise_level,
                true
            )
            """
        )
        session.execute(
            query,
            {
                "name": vp["name"],
                "lng": vp["lng"],
                "lat": vp["lat"],
                "score": vp["suitability_score"],
                "price": vp["price_per_km"],
                "desc": vp["description"],
                "features": json.dumps(vp.get("features", [])),
                "noise_level": vp.get("noise_level"),
            },
        )

    session.commit()
    print("Seeding complete!")


if __name__ == "__main__":
    seed()
