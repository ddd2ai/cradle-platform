# Foundation and Observatory

## Foundation

Foundation is the authoritative Cradle-level definition surface. It exposes the
shared `VISION.md`, `ENVIRONMENT.md`, `DNA_DEFINITION.md`, and `DNA_FACTORS.md`
documents through `GET /api/v1/foundation`. A single definition can be updated
through `PUT /api/v1/foundation/:documentId`.

Updates accept an `expectedRevision`. The server rejects stale revisions with
HTTP 409 and writes accepted content atomically. Document identifiers map to a
fixed allowlist; clients cannot use this API to address arbitrary files.

Runtime configuration remains in the independent Settings surface, backed by
`cradle-config.json` and its existing `GET /api/v1/config` and
`PUT /api/v1/config` interface. Foundation does not duplicate or relocate that
editor.

## Observatory

Observatory is a read-only cultivation evidence projection. The
`GET /api/v1/observatory` response collects a bounded snapshot for each Cell:

- authoritative Cell and cultivation state;
- at most 24 recent DNA observations and their derived maturity trend;
- maturity derived from recorded DNA history;
- at most 40 recent lifecycle events.

The response is intentionally a snapshot, not a new state authority. REST
remains authoritative and runtime events only signal when clients should
reconcile.

Maturity trends require at least two DNA observations. Earlier or missing data
is returned as `insufficient_evidence`; the UI must not replace it with an
estimated score. The attention queue includes recorded `needs_attention`
states and Cells that lack enough evidence to establish maturity.
