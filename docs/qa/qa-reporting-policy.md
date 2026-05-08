# Deskagotchi QA Reporting Policy

QA reports are evidence, not decoration. A report must make it clear what was tested, what was not tested, and what claim is allowed.

## Confidence Labels

- `automated-pass`: automated checks fully passed for the stated scope.
- `automated-partial`: automation passed some mechanical checks, but important coverage is missing.
- `manual-required`: automation cannot judge the user-facing behavior or environment-specific feel.
- `failed`: one or more required checks failed.

## Generated Artifacts

Routine QA artifacts are written under:

```text
.qa-runs/<timestamp-or-runId>/
```

This folder is ignored by git. The latest run path is written to:

```text
.qa-runs/latest.txt
```

Each run should include:

- `report.md`
- `summary.json`
- `events.jsonl`, when the app is launched
- `metadata.json`, when the app is launched
- scenario-specific screenshots, bounds, or validation artifacts

## Desktop-Native Claims

For native desktop behavior, the final response must not say `fixed` without scope.

Required fields:

- tested scope
- environment
- confidence label
- artifact path
- uncovered conditions
- manual acceptance status
- exact claim allowed

Example:

```text
Claim allowed: passed automated drag smoke for tested Windows desktop scope; manual feel acceptance still separate.
```
