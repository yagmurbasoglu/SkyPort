import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OSMService:
    OVERPASS_URL = "http://overpass-api.de/api/interpreter"

    async def extract_osm_data(self, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> Dict[str, Any]:
        """
        Extract basic OSM data for buildings and roads in the given bounding box.
        """
        bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
        
        # Overpass QL query: fetch buildings and highways
        query = f"""
        [out:json][timeout:25];
        (
          way["building"]({bbox});
          way["highway"]({bbox});
        );
        out body;
        >;
        out skel qt;
        """
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.OVERPASS_URL, 
                    data={"data": query},
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                # Basic mock parsing
                elements = data.get("elements", [])
                buildings = [e for e in elements if "tags" in e and "building" in e["tags"]]
                roads = [e for e in elements if "tags" in e and "highway" in e["tags"]]
                
                return {
                    "status": "partial_success" if not buildings or not roads else "success",
                    "message": f"Extracted {len(buildings)} buildings and {len(roads)} roads.",
                    "data": {
                        "buildings_count": len(buildings),
                        "roads_count": len(roads),
                        "raw_elements": len(elements)
                    }
                }

        except httpx.HTTPError as e:
            logger.error(f"Error fetching data from OSM Overpass API: {str(e)}")
            return {
                "status": "error",
                "message": f"Failed to fetch data from OSM: {str(e)}",
                "data": {}
            }
