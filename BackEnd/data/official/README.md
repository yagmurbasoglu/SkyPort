# Official Criteria Data

This folder is reserved for official data files that enrich the expert analysis criteria.

Current expected sources:

- `traffic_density`: Istanbul Metropolitan Municipality (IBB) traffic density / congestion layer exported as GeoJSON
- `socioeconomic`: Turkish Statistical Institute (TUIK) district population table exported as CSV

Automatic live fallback:

- If `IBB_TRAFFIC_ENABLED=true` and no GeoJSON path or URL is configured, the backend pulls live segment density data directly from the official IBB traffic service.
- If `TUIK_POPULATION_ENABLED=true` and no CSV path or URL is configured, the backend pulls live district population data and official district geometries directly from the official TUIK CIP service.

Recommended source pages:

- IBB Open Data Portal: `https://data.ibb.gov.tr/`
- IBB Traffic Information: `https://uym.ibb.gov.tr/hizmetler/trafik-bilgilendirme`
- IBB City Map API Docs: `https://sehirharitasiapi.ibb.gov.tr/developer/api.html`
- TUIK Data Portal: `https://data.tuik.gov.tr/en/`

## Expected Files

- `ibb_traffic.geojson`
- `tuik_population.csv`

Files are optional overrides. If you do not place them here, the backend now uses the live official APIs automatically.

## Traffic GeoJSON

Expected structure:

- GeoJSON `FeatureCollection`
- Each feature should intersect Istanbul roads or traffic corridors
- Feature properties should include one numeric density-like field such as:
  - `traffic_density`
  - `density`
  - `congestion`
  - `congestion_level`
  - `jam_factor`
  - `traffic_index`
  - `intensity`
  - `score`
  - `value`

Example:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[28.98, 41.02], [28.99, 41.03]]
      },
      "properties": {
        "density": 72
      }
    }
  ]
}
```

## TUIK CSV

Expected structure:

- District name column:
  - `district`
  - `district_name`
  - `ilce`
  - `ilce_adi`
  - `name`
- Population column:
  - `population`
  - `population_total`
  - `total_population`
  - `nufus`
  - `nufus_toplam`
  - `toplam_nufus`

Example:

```csv
district,population
Bakirkoy,214977
Besiktas,175190
Basaksehir,514900
```

## Validation

After placing files here, run:

```powershell
cd D:\sky_port\BackEnd
.\.venv\Scripts\python scripts\validate_official_criteria_data.py
```

This checks whether the backend can load the files and match the expected schema.
