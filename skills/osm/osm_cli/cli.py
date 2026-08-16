from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

ATTRIBUTION = "© OpenStreetMap contributors"
NOMINATIM_POLICY = "https://operations.osmfoundation.org/policies/nominatim/"
DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_USER_AGENT = "pi-pack-osm/0.1 (+https://github.com/fosskar/pi-pack)"
MAX_LIMIT = 20
MAX_RADIUS = 10_000
MAX_RESPONSE_BYTES = 2 * 1024 * 1024

CATEGORIES: dict[str, list[tuple[str, str | None]]] = {
    "any": [("name", None)],
    "restaurant": [("amenity", "restaurant")],
    "cafe": [("amenity", "cafe")],
    "pharmacy": [("amenity", "pharmacy")],
    "hospital": [("amenity", "hospital")],
    "supermarket": [("shop", "supermarket")],
    "bakery": [("shop", "bakery")],
    "public_transport": [
        ("public_transport", "platform"),
        ("public_transport", "stop_position"),
        ("highway", "bus_stop"),
        ("railway", "station"),
        ("railway", "halt"),
        ("railway", "tram_stop"),
    ],
}
TAG_PATTERN = re.compile(r"^[A-Za-z0-9_:.-]+$")


class CliError(Exception):
    def __init__(self, code: str, message: str, **details: Any) -> None:
        super().__init__(message)
        self.document = {"error": code, "message": message, **details}


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise CliError("invalid_arguments", message)


class HttpClient:
    def __init__(self, user_agent: str, timeout: float = 20) -> None:
        self.headers = {"Accept": "application/json", "User-Agent": user_agent}
        self.timeout = timeout

    def get(self, url: str, parameters: Mapping[str, str]) -> Any:
        url = f"{url}?{urllib.parse.urlencode(parameters)}"
        return self._open(urllib.request.Request(url, headers=self.headers))

    def post(self, url: str, parameters: Mapping[str, str]) -> Any:
        request = urllib.request.Request(
            url,
            data=urllib.parse.urlencode(parameters).encode(),
            headers={
                **self.headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        return self._open(request)

    def _open(self, request: urllib.request.Request) -> Any:
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as error:
            raise CliError(
                "http_error", f"HTTP {error.code} from the map service"
            ) from error
        except urllib.error.URLError as error:
            raise CliError("network_error", str(error.reason)) from error
        if len(payload) > MAX_RESPONSE_BYTES:
            raise CliError("response_too_large", "Map service response exceeded 2 MiB")
        try:
            return json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise CliError(
                "invalid_response", "Map service returned invalid JSON"
            ) from error


def cache_directory(environment: Mapping[str, str]) -> Path:
    root = Path(environment.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    directory = root / "pi-pack-osm" / "nominatim"
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    return directory


def nominatim_request(
    action: str,
    parameters: Mapping[str, str],
    environment: Mapping[str, str],
    http: HttpClient,
) -> Any:
    endpoint = environment.get("OSM_NOMINATIM_URL")
    if not endpoint:
        raise CliError(
            "nominatim_not_configured",
            "Set OSM_NOMINATIM_URL after reviewing the Nominatim usage policy",
            policy=NOMINATIM_POLICY,
        )

    directory = cache_directory(environment)
    encoded = json.dumps(
        {"endpoint": endpoint, "action": action, "parameters": parameters},
        sort_keys=True,
    ).encode()
    cache = directory / f"{hashlib.sha256(encoded).hexdigest()}.json"
    if cache.exists():
        return json.loads(cache.read_text())

    lock_path = directory / "request.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        lock_path.chmod(0o600)
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        if cache.exists():
            return json.loads(cache.read_text())
        lock.seek(0)
        previous = lock.read().strip()
        if previous:
            time.sleep(max(0, 1 - (time.time() - float(previous))))
        try:
            result = http.get(f"{endpoint.rstrip('/')}/{action}", parameters)
        finally:
            lock.seek(0)
            lock.truncate()
            lock.write(str(time.time()))
            lock.flush()

        temporary = directory / f".{cache.name}.{os.getpid()}.tmp"
        temporary.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False))
        temporary.chmod(0o600)
        temporary.replace(cache)
        return result


def geocode(
    query: str,
    limit: int,
    environment: Mapping[str, str],
    http: HttpClient,
) -> list[dict[str, Any]]:
    payload = nominatim_request(
        "search",
        {"q": query, "format": "jsonv2", "addressdetails": "1", "limit": str(limit)},
        environment,
        http,
    )
    if not isinstance(payload, list):
        raise CliError("invalid_response", "Nominatim search did not return a list")
    results: list[dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict):
            results.append(normalize_geocode(item))
        if len(results) == limit:
            break
    return results


def reverse(
    latitude: float,
    longitude: float,
    environment: Mapping[str, str],
    http: HttpClient,
) -> dict[str, Any]:
    payload = nominatim_request(
        "reverse",
        {
            "lat": coordinate(latitude),
            "lon": coordinate(longitude),
            "format": "jsonv2",
            "addressdetails": "1",
        },
        environment,
        http,
    )
    if not isinstance(payload, dict) or "error" in payload:
        raise CliError("not_found", "Nominatim did not find this coordinate")
    return normalize_geocode(payload)


def normalize_geocode(item: Mapping[str, Any]) -> dict[str, Any]:
    try:
        latitude, longitude = float(item["lat"]), float(item["lon"])
    except (KeyError, TypeError, ValueError) as error:
        raise CliError(
            "invalid_response", "Nominatim returned invalid coordinates"
        ) from error
    if not valid_coordinates(latitude, longitude):
        raise CliError("invalid_response", "Nominatim returned invalid coordinates")

    osm_type = str(item.get("osm_type", ""))
    osm_id = item.get("osm_id")
    result = {
        "name": str(item.get("display_name") or item.get("name") or "Unnamed place"),
        "lat": latitude,
        "lon": longitude,
        "category": item.get("category") or item.get("class"),
        "type": item.get("type"),
    }
    if osm_type in {"node", "way", "relation"} and str(osm_id).isdigit():
        result["osm_url"] = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
    return result


def nearby(
    latitude: float,
    longitude: float,
    category: str,
    name: str | None,
    radius: int,
    limit: int,
    endpoint: str,
    http: HttpClient,
) -> list[dict[str, Any]]:
    query = overpass_query(category_tags(category), name, radius, latitude, longitude)
    payload = http.post(endpoint, {"data": query})
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
        raise CliError("invalid_response", "Overpass did not return an elements list")

    results: list[dict[str, Any]] = []
    for element in payload["elements"]:
        place = normalize_element(element, latitude, longitude)
        if place:
            results.append(place)
    results.sort(key=lambda place: (place["distance_m"], place["name"].casefold()))
    return results[:limit]


def category_tags(category: str) -> list[tuple[str, str | None]]:
    if category in CATEGORIES:
        return CATEGORIES[category]
    if "=" not in category:
        raise CliError(
            "unknown_category",
            f"Unknown category: {category}",
            aliases=sorted(CATEGORIES),
        )
    key, value = category.split("=", 1)
    if not TAG_PATTERN.fullmatch(key) or not TAG_PATTERN.fullmatch(value):
        raise CliError("invalid_category", "Invalid OSM key=value category")
    return [(key, value)]


def overpass_query(
    tags: Sequence[tuple[str, str | None]],
    name: str | None,
    radius: int,
    latitude: float,
    longitude: float,
) -> str:
    escaped_name = ql(re.escape(name)) if name else None
    name_filter = f'["name"~"{escaped_name}",i]' if escaped_name else ""
    around = f"(around:{radius},{coordinate(latitude)},{coordinate(longitude)})"
    selectors = []
    for key, value in tags:
        tag_filter = f'["{key}"]' if value is None else f'["{key}"="{value}"]'
        selectors.append(f"nwr{tag_filter}{name_filter}{around};")
    return "[out:json][timeout:20];(" + "".join(selectors) + ");out center 100;"


def normalize_element(
    element: Any, origin_latitude: float, origin_longitude: float
) -> dict[str, Any] | None:
    if not isinstance(element, dict) or not isinstance(element.get("tags"), dict):
        return None
    osm_type = element.get("type")
    center = element if osm_type == "node" else element.get("center")
    if osm_type not in {"node", "way", "relation"} or not isinstance(center, dict):
        return None
    try:
        latitude, longitude = float(center["lat"]), float(center["lon"])
        osm_id = int(element["id"])
    except (KeyError, TypeError, ValueError):
        return None
    if not valid_coordinates(latitude, longitude):
        return None

    tags = element["tags"]
    category = next(
        (
            f"{key}={tags[key]}"
            for key in ("amenity", "shop", "public_transport", "railway", "highway")
            if key in tags
        ),
        "place",
    )
    address = tags.get("addr:full")
    if not address:
        street = " ".join(
            str(value)
            for value in (tags.get("addr:street"), tags.get("addr:housenumber"))
            if value
        )
        address = (
            ", ".join(
                str(value)
                for value in (street, tags.get("addr:postcode"), tags.get("addr:city"))
                if value
            )
            or None
        )
    return {
        "name": str(tags.get("name") or tags.get("ref") or "Unnamed place"),
        "category": category,
        "distance_m": round(
            haversine(origin_latitude, origin_longitude, latitude, longitude)
        ),
        "lat": latitude,
        "lon": longitude,
        "address": address,
        "osm_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
    }


def build_parser() -> Parser:
    parser = Parser(prog="osm")
    commands = parser.add_subparsers(dest="command", required=True)
    geocode_parser = commands.add_parser("geocode")
    geocode_parser.add_argument("query")
    geocode_parser.add_argument("--limit", type=int, default=3)
    reverse_parser = commands.add_parser("reverse")
    reverse_parser.add_argument("latitude", type=float)
    reverse_parser.add_argument("longitude", type=float)
    nearby_parser = commands.add_parser("nearby")
    nearby_parser.add_argument("category")
    origin = nearby_parser.add_mutually_exclusive_group(required=True)
    origin.add_argument("--near")
    origin.add_argument("--at")
    nearby_parser.add_argument("--name")
    nearby_parser.add_argument("--radius", type=int, default=500)
    nearby_parser.add_argument("--limit", type=int, default=10)
    return parser


def run(
    arguments: Sequence[str],
    *,
    environment: Mapping[str, str] | None = None,
    http: HttpClient | None = None,
) -> dict[str, Any]:
    env = os.environ if environment is None else environment
    args = build_parser().parse_args(arguments)
    validate_limit(getattr(args, "limit", 1))
    network = http or HttpClient(env.get("OSM_USER_AGENT", DEFAULT_USER_AGENT))

    if args.command == "geocode":
        return output("geocode", geocode(args.query, args.limit, env, network))
    if args.command == "reverse":
        validate_coordinates(args.latitude, args.longitude)
        return output("reverse", reverse(args.latitude, args.longitude, env, network))

    if not 1 <= args.radius <= MAX_RADIUS:
        raise CliError(
            "invalid_radius", f"radius must be between 1 and {MAX_RADIUS} meters"
        )
    if args.near:
        matches = geocode(args.near, 1, env, network)
        if not matches:
            raise CliError("not_found", f"No location matched: {args.near}")
        center = {
            "lat": matches[0]["lat"],
            "lon": matches[0]["lon"],
            "name": matches[0]["name"],
        }
    else:
        latitude, longitude = parse_at(args.at)
        center = {"lat": latitude, "lon": longitude}

    results = nearby(
        center["lat"],
        center["lon"],
        args.category,
        args.name,
        args.radius,
        args.limit,
        env.get("OSM_OVERPASS_URL", DEFAULT_OVERPASS_URL),
        network,
    )
    return {
        "command": "nearby",
        "category": args.category,
        "center": center,
        "radius_m": args.radius,
        "results": results,
        "attribution": ATTRIBUTION,
    }


def parse_at(value: str) -> tuple[float, float]:
    try:
        latitude, longitude = (float(part) for part in value.split(",", 1))
    except (AttributeError, ValueError) as error:
        raise CliError(
            "invalid_coordinates", "--at requires LATITUDE,LONGITUDE"
        ) from error
    validate_coordinates(latitude, longitude)
    return latitude, longitude


def valid_coordinates(latitude: float, longitude: float) -> bool:
    return (
        math.isfinite(latitude)
        and math.isfinite(longitude)
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )


def validate_coordinates(latitude: float, longitude: float) -> None:
    if not valid_coordinates(latitude, longitude):
        raise CliError(
            "invalid_coordinates", "latitude or longitude is outside its valid range"
        )


def validate_limit(limit: int) -> None:
    if not 1 <= limit <= MAX_LIMIT:
        raise CliError("invalid_limit", f"limit must be between 1 and {MAX_LIMIT}")


def ql(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def coordinate(value: float) -> str:
    return f"{value:.7f}".rstrip("0").rstrip(".")


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi, delta_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lon / 2) ** 2
    )
    return 6_371_000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def output(command: str, results: Any) -> dict[str, Any]:
    return {"command": command, "results": results, "attribution": ATTRIBUTION}


def main(arguments: Sequence[str] | None = None) -> int:
    try:
        result = run(sys.argv[1:] if arguments is None else arguments)
    except CliError as error:
        print(json.dumps(error.document, ensure_ascii=False), file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0
