from __future__ import annotations

import stat
import tempfile
import unittest
from pathlib import Path
from typing import Any

from osm_cli.cli import CliError, category_tags, haversine, overpass_query, run


class FakeHttp:
    def __init__(
        self, *, get: list[Any] | None = None, post: list[Any] | None = None
    ) -> None:
        self.get_responses = get or []
        self.post_responses = post or []
        self.get_calls: list[tuple[str, dict[str, str]]] = []
        self.post_calls: list[tuple[str, dict[str, str]]] = []

    def get(self, url: str, parameters: dict[str, str]) -> Any:
        self.get_calls.append((url, parameters))
        return self.get_responses.pop(0)

    def post(self, url: str, parameters: dict[str, str]) -> Any:
        self.post_calls.append((url, parameters))
        return self.post_responses.pop(0)


class OsmCliTest(unittest.TestCase):
    def environment(self, cache: str) -> dict[str, str]:
        return {
            "OSM_NOMINATIM_URL": "https://nominatim.example.test",
            "OSM_OVERPASS_URL": "https://overpass.example.test/api",
            "XDG_CACHE_HOME": cache,
        }

    def test_geocode_is_bounded_normalized_and_cached(self) -> None:
        with tempfile.TemporaryDirectory() as cache:
            place = {
                "lat": "52.5251",
                "lon": "13.3694",
                "display_name": "Berlin Hauptbahnhof",
                "category": "railway",
                "type": "station",
                "osm_type": "node",
                "osm_id": 123,
            }
            http = FakeHttp(get=[[place, *[place] * 24]])
            arguments = ["geocode", "Berlin Hauptbahnhof", "--limit", "1"]

            first = run(arguments, environment=self.environment(cache), http=http)
            second = run(arguments, environment=self.environment(cache), http=http)

            self.assertEqual(first, second)
            self.assertEqual(len(first["results"]), 1)
            self.assertEqual(len(http.get_calls), 1)
            self.assertEqual(first["results"][0]["lat"], 52.5251)
            self.assertEqual(
                first["results"][0]["osm_url"],
                "https://www.openstreetmap.org/node/123",
            )
            directory = Path(cache) / "pi-pack-osm" / "nominatim"
            self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
            for path in directory.iterdir():
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_geocode_requires_configuration(self) -> None:
        with self.assertRaises(CliError) as raised:
            run(["geocode", "Berlin"], environment={}, http=FakeHttp())
        self.assertEqual(raised.exception.document["error"], "nominatim_not_configured")
        self.assertIn("policy", raised.exception.document)

    def test_geocode_rejects_invalid_coordinates(self) -> None:
        with tempfile.TemporaryDirectory() as cache:
            http = FakeHttp(get=[[{"lat": "nan", "lon": "13", "display_name": "bad"}]])
            with self.assertRaises(CliError) as raised:
                run(
                    ["geocode", "bad"],
                    environment=self.environment(cache),
                    http=http,
                )
            self.assertEqual(raised.exception.document["error"], "invalid_response")

    def test_nearby_normalizes_ways_and_sorts_results(self) -> None:
        http = FakeHttp(
            post=[
                {
                    "elements": [
                        {
                            "type": "way",
                            "id": 20,
                            "center": {"lat": 52.002, "lon": 13},
                            "tags": {
                                "name": "Far Cafe",
                                "amenity": "cafe",
                                "addr:street": "Far Street",
                                "addr:housenumber": "2",
                            },
                        },
                        {
                            "type": "node",
                            "id": 10,
                            "lat": 52.0001,
                            "lon": 13,
                            "tags": {"name": "Near Cafe", "amenity": "cafe"},
                        },
                    ]
                }
            ]
        )
        result = run(
            ["nearby", "cafe", "--at", "52,13", "--radius", "750"],
            environment={"OSM_OVERPASS_URL": "https://overpass.example.test/api"},
            http=http,
        )

        self.assertEqual(
            [place["name"] for place in result["results"]],
            ["Near Cafe", "Far Cafe"],
        )
        self.assertEqual(result["results"][1]["address"], "Far Street 2")
        self.assertIn('["amenity"="cafe"]', http.post_calls[0][1]["data"])

    def test_nearby_can_geocode_the_center(self) -> None:
        with tempfile.TemporaryDirectory() as cache:
            http = FakeHttp(
                get=[[{"lat": "48.14", "lon": "11.56", "display_name": "München"}]],
                post=[{"elements": []}],
            )
            result = run(
                ["nearby", "pharmacy", "--near", "München"],
                environment=self.environment(cache),
                http=http,
            )
            self.assertEqual(result["center"]["name"], "München")
            self.assertEqual(result["results"], [])

    def test_public_transport_query_and_distance(self) -> None:
        query = overpass_query(category_tags("public_transport"), None, 500, 52, 13)
        self.assertIn('["public_transport"="platform"]', query)
        self.assertIn('["highway"="bus_stop"]', query)
        self.assertIn('["railway"="station"]', query)
        self.assertAlmostEqual(haversine(0, 0, 0, 1), 111_195, delta=100)

    def test_validates_bounds_and_categories(self) -> None:
        cases = [
            (["nearby", "cafe", "--at", "nan,0"], "invalid_coordinates"),
            (["nearby", "cafe", "--at", "1,2", "--radius", "0"], "invalid_radius"),
            (["nearby", "cafe", "--at", "1,2", "--limit", "21"], "invalid_limit"),
            (["nearby", "unknown", "--at", "1,2"], "unknown_category"),
        ]
        for arguments, code in cases:
            with self.subTest(arguments=arguments):
                with self.assertRaises(CliError) as raised:
                    run(
                        arguments,
                        environment={},
                        http=FakeHttp(post=[{"elements": []}]),
                    )
                self.assertEqual(raised.exception.document["error"], code)


if __name__ == "__main__":
    unittest.main()
