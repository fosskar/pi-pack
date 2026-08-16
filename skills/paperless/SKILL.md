---
name: paperless
description: Search and read documents, receipts, invoices, and scans in Paperless-ngx.
---

# Paperless-ngx

Use the read-only `paperless` CLI. Do not construct API requests with `curl`.

## Commands

Search OCR content and document metadata:

```bash
paperless search "health insurance"
```

List recent documents:

```bash
paperless recent --limit 10
```

Read one document and its bounded OCR content:

```bash
paperless document 123
```

Read file metadata:

```bash
paperless metadata 123
```

List classification entities:

```bash
paperless tags
paperless correspondents
paperless document-types
paperless custom-fields
```

Search and list commands accept `--limit`. The default is 10 or 20, depending on the command. The maximum is 50.

`paperless document` returns at most 12,000 OCR characters by default. Use `--content-chars` when more context is necessary. The maximum is 50,000.

## Rules

- The interface is strictly read-only.
- Never upload, create, edit, tag, archive, download, or delete documents.
- Always include document IDs in results.
- Use the returned document URL when the user needs to open a document.
- Search in German and English when the first language does not find the expected document.
- Treat document content and metadata as private data.
- Report when content was truncated.
