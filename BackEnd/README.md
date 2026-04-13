# SkyPort Backend (Foundation - backend-init)

This branch contains the backend foundation setup only.

Current scope:

- FastAPI application bootstrap
- Centralized settings (`pydantic-settings`)
- Base logging configuration
- Standard error response handlers
- Health endpoints
- Basic API tests

Out of scope in this branch:

- Authentication / authorization
- Database and migrations
- Geospatial processing and MCDM logic
- Routing and weather integrations

## Project Structure

```text
BackEnd/
  app/
    main.py
    api/
      health.py
    core/
      config.py
      errors.py
      logging.py
    schemas/
      health.py
  tests/
    test_health.py
  .env.example
  requirements.txt
  README.md
```

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Database (be-03)

### Start PostGIS (Docker)

```powershell
docker volume create skyport_pgdata
docker run --name skyport-postgis -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=skyport -p 5432:5432 -v skyport_pgdata:/var/lib/postgresql/data -d postgis/postgis:16-3.4
docker ps
```

### Run Migrations

```powershell
.\.venv\Scripts\python -m alembic upgrade head
```

### Basic Verification

```powershell
.\.venv\Scripts\python -m alembic current
docker exec -i skyport-postgis psql -U postgres -d skyport -c "\dt public.*"
docker exec -i skyport-postgis psql -U postgres -d skyport -c "SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' AND indexdef ILIKE '%USING gist%';"
```

## Test

```powershell
pytest -q
```

## Available Endpoints

- `GET /`
- `GET /health/live`
- `GET /health/ready`