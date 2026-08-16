from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping, Sequence
from typing import Any

MAX_RESULTS = 50
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_CONTENT_CHARS = 50_000
DEFAULT_CONTENT_CHARS = 12_000


class CliError(Exception):
    def __init__(self, code: str, message: str, **details: Any) -> None:
        super().__init__(message)
        self.document = {"error": code, "message": message, **details}


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise CliError("invalid_arguments", message)


class RejectRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None


class PaperlessClient:
    def __init__(self, url: str, token: str, timeout: float = 20) -> None:
        self.url = url.rstrip("/")
        self.timeout = timeout
        self.opener = urllib.request.build_opener(RejectRedirects)
        self.headers = {
            "Accept": "application/json; version=10",
            "Authorization": f"Token {token}",
            "User-Agent": "pi-pack-paperless/0.1",
        }

    def get(self, path: str, parameters: Mapping[str, str] | None = None) -> Any:
        url = f"{self.url}/{path.lstrip('/')}"
        if parameters:
            url = f"{url}?{urllib.parse.urlencode(parameters)}"
        request = urllib.request.Request(url, headers=self.headers, method="GET")
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                payload = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as error:
            error.close()
            if error.code == 404:
                raise CliError(
                    "not_found", "Paperless resource was not found"
                ) from error
            if error.code in {401, 403}:
                raise CliError(
                    "authentication_failed", "Paperless rejected the API token"
                ) from error
            raise CliError(
                "http_error", f"Paperless returned HTTP {error.code}"
            ) from error
        except urllib.error.URLError as error:
            raise CliError("network_error", str(error.reason)) from error
        if len(payload) > MAX_RESPONSE_BYTES:
            raise CliError("response_too_large", "Paperless response exceeded 2 MiB")
        try:
            return json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise CliError(
                "invalid_response", "Paperless returned invalid JSON"
            ) from error


def client_from_environment(environment: Mapping[str, str]) -> PaperlessClient:
    url = environment.get("PAPERLESS_URL", "").strip()
    token = environment.get("PAPERLESS_API_TOKEN", "").strip()
    missing = [
        name
        for name, value in (("PAPERLESS_URL", url), ("PAPERLESS_API_TOKEN", token))
        if not value
    ]
    if missing:
        raise CliError(
            "not_configured", "Missing Paperless configuration", missing=missing
        )
    return PaperlessClient(url, token)


def document_summary(document: Mapping[str, Any], base_url: str) -> dict[str, Any]:
    identifier = document.get("id")
    result = {
        key: document.get(key)
        for key in (
            "id",
            "title",
            "created",
            "added",
            "modified",
            "archive_serial_number",
            "correspondent",
            "document_type",
            "tags",
            "custom_fields",
            "original_file_name",
            "archived_file_name",
        )
        if key in document
    }
    if isinstance(identifier, int):
        result["url"] = f"{base_url}/documents/{identifier}/details"
    return result


def document_detail(
    document: Mapping[str, Any], base_url: str, content_chars: int
) -> dict[str, Any]:
    result = document_summary(document, base_url)
    content = document.get("content")
    if isinstance(content, str):
        truncated = len(content) > content_chars
        result["content"] = content[:content_chars]
        result["content_truncated"] = truncated
        if truncated:
            result["content_total_chars"] = len(content)
    return result


def paginated_results(
    payload: Any, limit: int
) -> tuple[list[Mapping[str, Any]], int | None]:
    if isinstance(payload, list):
        values, count = payload, len(payload)
    elif isinstance(payload, dict) and isinstance(payload.get("results"), list):
        values, count = payload["results"], payload.get("count")
    else:
        raise CliError("invalid_response", "Paperless did not return a result list")
    return [value for value in values if isinstance(value, dict)][:limit], count


def list_documents(
    client: PaperlessClient, parameters: Mapping[str, str], limit: int
) -> dict[str, Any]:
    payload = client.get("api/documents/", {**parameters, "page_size": str(limit)})
    documents, count = paginated_results(payload, limit)
    return {
        "count": count,
        "results": [document_summary(document, client.url) for document in documents],
    }


def list_entities(client: PaperlessClient, resource: str, limit: int) -> dict[str, Any]:
    payload = client.get(f"api/{resource}/", {"page_size": str(limit)})
    entities, count = paginated_results(payload, limit)
    fields = (
        "id",
        "name",
        "slug",
        "document_count",
        "color",
        "data_type",
        "extra_data",
    )
    return {
        "count": count,
        "results": [
            {key: entity.get(key) for key in fields if key in entity}
            for entity in entities
        ],
    }


def build_parser() -> Parser:
    parser = Parser(prog="paperless")
    commands = parser.add_subparsers(dest="command", required=True)

    search = commands.add_parser("search")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=10)

    recent = commands.add_parser("recent")
    recent.add_argument("--limit", type=int, default=10)

    document = commands.add_parser("document")
    document.add_argument("id", type=int)
    document.add_argument("--content-chars", type=int, default=DEFAULT_CONTENT_CHARS)

    metadata = commands.add_parser("metadata")
    metadata.add_argument("id", type=int)

    for name in ("tags", "correspondents", "document-types", "custom-fields"):
        command = commands.add_parser(name)
        command.add_argument("--limit", type=int, default=20)
    return parser


def run(
    arguments: Sequence[str],
    *,
    environment: Mapping[str, str] | None = None,
    client: PaperlessClient | None = None,
) -> dict[str, Any]:
    args = build_parser().parse_args(arguments)
    api = client or client_from_environment(
        os.environ if environment is None else environment
    )

    if hasattr(args, "limit") and not 1 <= args.limit <= MAX_RESULTS:
        raise CliError("invalid_limit", f"limit must be between 1 and {MAX_RESULTS}")
    if hasattr(args, "id") and args.id < 1:
        raise CliError("invalid_id", "document ID must be positive")

    if args.command == "search":
        return {
            "command": "search",
            "query": args.query,
            **list_documents(api, {"query": args.query}, args.limit),
        }
    if args.command == "recent":
        return {
            "command": "recent",
            **list_documents(api, {"ordering": "-created"}, args.limit),
        }
    if args.command == "document":
        if not 1 <= args.content_chars <= MAX_CONTENT_CHARS:
            raise CliError(
                "invalid_content_limit",
                f"content-chars must be between 1 and {MAX_CONTENT_CHARS}",
            )
        payload = api.get(f"api/documents/{args.id}/")
        if not isinstance(payload, dict):
            raise CliError("invalid_response", "Paperless did not return a document")
        return {
            "command": "document",
            "result": document_detail(payload, api.url, args.content_chars),
        }
    if args.command == "metadata":
        return {
            "command": "metadata",
            "document_id": args.id,
            "result": api.get(f"api/documents/{args.id}/metadata/"),
            "url": f"{api.url}/documents/{args.id}/details",
        }

    resources = {
        "tags": "tags",
        "correspondents": "correspondents",
        "document-types": "document_types",
        "custom-fields": "custom_fields",
    }
    return {
        "command": args.command,
        **list_entities(api, resources[args.command], args.limit),
    }


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
