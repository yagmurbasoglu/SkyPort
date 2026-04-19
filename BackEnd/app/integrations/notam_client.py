import logging
import time

import httpx

logger = logging.getLogger(__name__)


class FaaNotamClient:
    def __init__(self, url: str) -> None:
        self.url = url

    def fetch_notams(
        self,
        locations: list[str],
        timeout_sec: float = 30.0,
        retry_count: int = 3,
    ) -> list[dict]:
        designators = ",".join(locations)
        payload = {
            "searchType": 0,
            "designatorsForLocation": designators,
        }
        headers = {
            "User-Agent": "SkyPort-Backend/1.0 (+advisory-notam-sync)",
            "Accept": "application/json, text/plain, */*",
        }

        for attempt in range(1, max(retry_count, 1) + 1):
            try:
                logger.info(
                    "Fetching FAA NOTAMs (attempt %s/%s) for: %s",
                    attempt,
                    retry_count,
                    designators,
                )
                response = httpx.post(
                    self.url,
                    data=payload,
                    headers=headers,
                    timeout=timeout_sec,
                    follow_redirects=True,
                    trust_env=False,
                )
                response.raise_for_status()
                body = response.json()
                notam_list = body.get("notamList", [])
                if isinstance(notam_list, list):
                    return [item for item in notam_list if isinstance(item, dict)]
                logger.warning("FAA response did not include list notamList.")
                return []
            except Exception as exc:  # pragma: no cover - network dependent
                logger.warning("FAA NOTAM fetch failed on attempt %s: %s", attempt, exc)
                if attempt < retry_count:
                    time.sleep(min(2 * attempt, 5))
        return []
