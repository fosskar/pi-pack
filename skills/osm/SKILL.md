---
name: osm
description: Search places, find nearby points of interest, and locate public transport stops with OpenStreetMap.
---

# OpenStreetMap

Use the `osm` CLI. Do not construct Nominatim URLs or Overpass QL.

## Geocoding policy

Before using Nominatim, read and follow its public service policy:

<https://operations.osmfoundation.org/policies/nominatim/>

The user must deliberately configure `OSM_NOMINATIM_URL`. Never use Nominatim for autocomplete, bulk geocoding, systematic queries, or complete POI downloads. Do not submit personal or confidential data.

## Commands

Resolve a place:

```bash
osm geocode "Berlin Hauptbahnhof"
```

Resolve coordinates:

```bash
osm reverse 52.5251 13.3694
```

Find nearby places from a named center:

```bash
osm nearby restaurant --near "Berlin Hauptbahnhof"
osm nearby public_transport --near "Hamburg Hbf" --radius 1000
```

Find nearby places from coordinates:

```bash
osm nearby pharmacy --at 52.5251,13.3694
```

Use an OSM tag when no category alias exists:

```bash
osm nearby tourism=museum --near "München Marienplatz"
```

Filter by name:

```bash
osm nearby any --near "Leipzig" --name "Central"
```

Defaults are a 500-meter radius and 10 results. The maximums are 10 kilometers and 20 results.

## Categories

Common aliases include:

- `restaurant`, `cafe`, `pharmacy`, and `hospital`
- `supermarket` and `bakery`
- `public_transport`
- `any`

## Results

The CLI returns bounded JSON. Nearby results are sorted by distance and include normalized names, categories, coordinates, addresses, and OSM links.

When presenting results:

- Include the approximate distance.
- Include the address when available.
- Include the OSM link.
- State `© OpenStreetMap contributors`.
- Say when OSM has no matching result. Do not claim that no real-world place exists.

The skill is read-only. Never edit or upload OSM data.
