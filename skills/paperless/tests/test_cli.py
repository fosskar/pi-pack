from __future__ import annotations

import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from paperless_cli.cli import CliError, PaperlessClient, client_from_environment, run


class FakeClient(PaperlessClient):
    def __init__(self, responses: list[Any]) -> None:
        super().__init__("https://paperless.example.test", "secret")
        self.responses = responses
        self.calls: list[tuple[str, dict[str, str] | None]] = []

    def get(self, path: str, parameters: dict[str, str] | None = None) -> Any:
        self.calls.append((path, parameters))
        return self.responses.pop(0)


class PaperlessCliTest(unittest.TestCase):
    def test_search_is_bounded_and_normalized(self) -> None:
        documents = [
            {"id": number, "title": f"Document {number}", "content": "private OCR"}
            for number in range(1, 25)
        ]
        client = FakeClient([{"count": 24, "results": documents}])

        result = run(["search", "invoice", "--limit", "2"], client=client)

        self.assertEqual(result["count"], 24)
        self.assertEqual(len(result["results"]), 2)
        self.assertNotIn("content", result["results"][0])
        self.assertEqual(
            result["results"][0]["url"],
            "https://paperless.example.test/documents/1/details",
        )
        self.assertEqual(
            client.calls,
            [("api/documents/", {"query": "invoice", "page_size": "2"})],
        )

    def test_recent_orders_by_created_date(self) -> None:
        client = FakeClient([{"count": 0, "results": []}])
        result = run(["recent"], client=client)
        self.assertEqual(result["command"], "recent")
        self.assertEqual(
            client.calls[0],
            ("api/documents/", {"ordering": "-created", "page_size": "10"}),
        )

    def test_document_truncates_ocr_content(self) -> None:
        client = FakeClient([{"id": 42, "title": "Receipt", "content": "abcdefgh"}])
        result = run(["document", "42", "--content-chars", "5"], client=client)
        self.assertEqual(result["result"]["content"], "abcde")
        self.assertTrue(result["result"]["content_truncated"])
        self.assertEqual(result["result"]["content_total_chars"], 8)
        self.assertEqual(client.calls[0][0], "api/documents/42/")

    def test_metadata_and_entity_lists_use_fixed_endpoints(self) -> None:
        metadata = FakeClient([{"original_checksum": "abc"}])
        result = run(["metadata", "7"], client=metadata)
        self.assertEqual(result["document_id"], 7)
        self.assertEqual(metadata.calls[0][0], "api/documents/7/metadata/")

        tags = FakeClient(
            [{"count": 1, "results": [{"id": 3, "name": "tax", "ignored": "x"}]}]
        )
        result = run(["tags"], client=tags)
        self.assertEqual(result["results"], [{"id": 3, "name": "tax"}])
        self.assertEqual(tags.calls[0][0], "api/tags/")

    def test_token_is_not_forwarded_across_redirects(self) -> None:
        received_authorization: list[str | None] = []

        class TargetHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                received_authorization.append(self.headers.get("Authorization"))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, format: str, *args: Any) -> None:
                pass

        target = HTTPServer(("127.0.0.1", 0), TargetHandler)
        target_thread = threading.Thread(target=target.serve_forever, daemon=True)
        target_thread.start()
        location = f"http://127.0.0.1:{target.server_port}/target"

        class RedirectHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                self.send_response(302)
                self.send_header("Location", location)
                self.end_headers()

            def log_message(self, format: str, *args: Any) -> None:
                pass

        source = HTTPServer(("127.0.0.1", 0), RedirectHandler)
        source_thread = threading.Thread(target=source.serve_forever, daemon=True)
        source_thread.start()
        try:
            client = PaperlessClient(f"http://127.0.0.1:{source.server_port}", "secret")
            with self.assertRaises(CliError):
                client.get("api/documents/")
            self.assertEqual(received_authorization, [])
        finally:
            source.shutdown()
            target.shutdown()
            source.server_close()
            target.server_close()

    def test_configuration_and_input_validation(self) -> None:
        with self.assertRaises(CliError) as raised:
            client_from_environment({})
        self.assertEqual(
            raised.exception.document["missing"],
            ["PAPERLESS_URL", "PAPERLESS_API_TOKEN"],
        )

        cases = [
            (["search", "x", "--limit", "51"], "invalid_limit"),
            (["document", "0"], "invalid_id"),
            (["document", "1", "--content-chars", "50001"], "invalid_content_limit"),
        ]
        for arguments, code in cases:
            with self.subTest(arguments=arguments):
                with self.assertRaises(CliError) as error:
                    run(arguments, client=FakeClient([]))
                self.assertEqual(error.exception.document["error"], code)


if __name__ == "__main__":
    unittest.main()
