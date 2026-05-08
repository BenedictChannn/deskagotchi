# Deskagotchi Feature QA Contract

Use this contract before implementing or closing any Deskagotchi feature.

## Risk Levels

| Level | Scope | Required Evidence |
| --- | --- | --- |
| P0 | Native desktop/window behavior such as drag, click-through, bounds, tray, startup, always-on-top, persistence. | Desktop QA command, production-like invariants, artifacts, and manual acceptance form when subjective feel matters. |
| P1 | Interaction behavior such as overlay care flows, Ball play, Hatch import/export, and in-place transient UI. | Desktop or renderer QA command plus screenshots and state evidence. |
| P2 | Renderer-only panel layout, forms, route rendering, and visual regressions. | Renderer QA or focused component/browser evidence. |
| P3 | Pure domain logic such as simulation, package validation, and storage schema. | Unit or integration tests. |

## Required Feature Template

```md
## Feature

- Name:
- Risk level:
- User-facing behavior:
- Production-like invariants:
- Automation command:
- Evidence tier:
- Manual acceptance required:
- Artifact expectations:
- Definition of done:
- Exact claim allowed when checks pass:
```

## Claim Rules

Do not use unqualified fixed language for P0/P1 behavior.

Use scoped claims:

- `passed automated drag smoke on Windows single-monitor 125 percent scaling`
- `mechanically passing for tested scope`
- `fixed for tested scope, pending user feel acceptance`
- `not yet user-validated`

Do not use vague claims:

- `dragging is fixed`
- `desktop behavior is fixed`
- `works now`

## Report Requirements

Every final implementation report for desktop behavior must include:

- commands run
- pass/fail status
- artifact path
- tested scope
- environment
- confidence label
- uncovered conditions
- manual acceptance status
- exact claim allowed

## Manual Acceptance Form

Use this when subjective feel or real desktop ergonomics matter.

```md
automation_run_id:
manual_pass: yes/no
failed_step:
notes:
blocks_fixed_claim: yes/no
```

If `blocks_fixed_claim` is `yes`, the implementation cannot be described as fixed beyond the automated scope.
