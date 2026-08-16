# osm

A bounded OpenStreetMap CLI and Pi skill for geocoding, reverse geocoding, and nearby place search.

The CLI replaces raw `curl` commands and Overpass QL in agent instructions. It normalizes service responses into stable JSON and enforces conservative query bounds.

## Setup

The CLI works without configuration. It calls the public Nominatim and Overpass services and sends an identifying user agent.

Read the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/). The public service permits only moderate, user-triggered use and prohibits autocomplete, systematic queries, and complete POI downloads. The CLI enforces result limits, a radius limit, one request per second, and an on-disk cache.

Override the endpoints to use your own instances:

```bash
export OSM_NOMINATIM_URL="https://nominatim.example.org"
export OSM_OVERPASS_URL="https://overpass.example.org/api/interpreter"
export OSM_USER_AGENT="my-osm-client/1.0 (contact@example.com)"
```

Geocoding, reverse geocoding, and `nearby --near` use Nominatim. `nearby --at` uses Overpass only.

## Interface

```text
osm geocode QUERY [--limit N]
osm reverse LATITUDE LONGITUDE
osm nearby CATEGORY (--near PLACE | --at LATITUDE,LONGITUDE)
                   [--name NAME] [--radius METERS] [--limit N]
```

`CATEGORY` can be a built-in alias or an exact OSM `key=value` tag.

Examples:

```bash
osm geocode "Köln Hauptbahnhof" --limit 2
osm reverse 50.9431 6.9588
osm nearby restaurant --near "Köln Hauptbahnhof"
osm nearby public_transport --at 50.9431,6.9588 --radius 1000
osm nearby tourism=museum --near "Köln Dom"
```

## Output

Commands write JSON to standard output. Errors write a JSON document to standard error and exit with status 2.

Nearby output has this shape:

```json
{
  "command": "nearby",
  "category": "cafe",
  "center": {
    "lat": 52.5251,
    "lon": 13.3694,
    "name": "Berlin Hauptbahnhof"
  },
  "radius_m": 500,
  "results": [
    {
      "name": "Example Cafe",
      "category": "amenity=cafe",
      "distance_m": 184,
      "lat": 52.524,
      "lon": 13.371,
      "address": "Example Street 1, Berlin",
      "osm_type": "node",
      "osm_id": 123,
      "osm_url": "https://www.openstreetmap.org/node/123"
    }
  ],
  "attribution": "© OpenStreetMap contributors"
}
```

## Limits and policy controls

- Results are limited to 20. The default is 10.
- Search radius is limited to 10 kilometers. The default is 500 meters.
- Overpass receives generated bounded queries only. The CLI does not accept raw Overpass QL.
- Nominatim responses are cached under `$XDG_CACHE_HOME/pi-pack-osm/nominatim`.
- A cross-process lock serializes Nominatim requests and keeps them at least one second apart.
- HTTP responses are limited to 2 MiB.
- HTTP requests time out after 20 seconds.
- Output always carries OpenStreetMap attribution.

Nearby coordinate searches send the search center to the configured Overpass endpoint. Geocoding requests send the query to the configured Nominatim endpoint. Do not submit confidential data.

## Implementation

The Python package has no runtime dependencies outside the standard library.

- `osm_cli/cli.py` contains the CLI, clients, normalization, cache, distance, and policy controls.
- `tests/test_cli.py` verifies the interface with in-memory HTTP responses.
- `default.nix` builds and tests the package beside the skill that owns it.

Run tests through Nix:

```bash
nix build .#checks.x86_64-linux.osm-cli
```

Run them directly when Python and pytest are available:

```bash
python -m pytest skills/osm/tests
```
