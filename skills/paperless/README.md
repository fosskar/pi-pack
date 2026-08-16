# paperless

A strictly read-only Paperless-ngx CLI and Pi skill.

The CLI replaces raw REST endpoint instructions with a small bounded interface. It exposes no raw request, upload, update, download, or delete command.

## Configuration

```bash
export PAPERLESS_URL="https://paperless.example.com"
export PAPERLESS_API_TOKEN="..."
```

Create the token in Paperless-ngx. The CLI sends it only through this header:

```text
Authorization: Token <token>
```

It also requests Paperless API version 10.

## Interface

```text
paperless search QUERY [--limit N]
paperless recent [--limit N]
paperless document ID [--content-chars N]
paperless metadata ID
paperless tags [--limit N]
paperless correspondents [--limit N]
paperless document-types [--limit N]
paperless custom-fields [--limit N]
```

Commands return JSON. Errors return JSON on standard error and exit with status 2.

Search results contain selected document fields and a Paperless details URL. They omit OCR content. `document` returns bounded OCR content and reports truncation.

## Limits and privacy

- List commands return at most 50 results.
- Document OCR output is limited to 50,000 characters.
- HTTP responses are limited to 2 MiB.
- HTTP requests time out after 20 seconds.
- Every network request uses HTTP `GET`.
- Redirects are rejected so the token stays on the configured origin.
- The CLI has no arbitrary endpoint or method option.

Document content can contain sensitive personal data. Protect `PAPERLESS_API_TOKEN` and command output. Use a Paperless token with read-only permissions when the server supports one.

## Development

The Python package has no runtime dependencies outside the standard library. The package definition stays beside the skill in `skills/paperless/default.nix`.

```bash
nix build .#checks.x86_64-linux.paperless-cli
python -m pytest skills/paperless/tests
```
