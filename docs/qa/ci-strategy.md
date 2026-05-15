# Deskagotchi CI Strategy

CI can protect portable code paths, but it must not pretend to validate Windows desktop compositor behavior.

## CI-Suitable Checks

These can run in normal CI:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run validate:pets`
- package and asset structure checks
- renderer route smoke tests when a browser or Electron environment is available

## Local Windows Desktop Checks

These remain local QA checks because they depend on the user's Windows desktop session:

- transparent frameless overlay behavior
- native drag and pointer hit testing
- always-on-top behavior
- click-through behavior
- tray behavior
- monitor work-area behavior
- DPI/scaling behavior
- RDP/session-specific behavior

The source of truth for native desktop claims is the local QA artifact under `.qa-runs/<runId>/`.

## Claim Boundary

A green CI run allows this kind of claim:

```text
portable checks passed
```

It does not allow this kind of claim:

```text
desktop drag is fixed
```

For native desktop behavior, use the scoped claim from the local QA report instead.
