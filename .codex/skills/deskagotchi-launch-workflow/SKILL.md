---
name: deskagotchi-launch-workflow
description: Use when drafting, reviewing, or planning public-facing Deskagotchi launch/release content, landing-page copy, demo-video scripts, X/Reddit posts, Product Hunt or Hacker News posts, changelog/release-note copy, or recurring content cadence. Focus on proof-led launch workflow, channel fit, hooks, recurring content loops, truth checks, and post-launch learning for this repo.
---

# Deskagotchi Launch Workflow

## Overview

Turn product and release facts into launch assets, recurring posts, and follow-up loops with one specific claim, visible proof, channel fit, honest boundaries, and measurement. Treat "viral launch" advice as a discipline for research, hooks, proof, critique, distribution, and iteration, not as permission to overclaim or spam channels.

This is repo-local to `C:\Users\bened\Documents\benedict_codebases\deskagotchi`.

## Product Context

Before drafting Deskagotchi-specific content, read:

- `docs/launch/deskagotchi-positioning.md` for positioning, voice, nostalgia boundaries, channel priorities, content pillars, sample hooks, and trust notes.
- Current release, QA, and landing-page files listed below for facts that may have changed.

Keep product-specific voice and brand facts in `docs/launch/deskagotchi-positioning.md`, not in this skill. Update that doc when the product framing changes; update this skill when the launch workflow changes.

## Inputs To Establish

Before drafting final copy, establish:

- Release or feature target: version, branch, release candidate, or feature drop.
- Audience: consumer downloaders, indie hackers, developers, open-source readers, or existing supporters.
- Channel: landing page, release notes, demo video, X, Reddit, GitHub Release, changelog, Product Hunt, Hacker News, or newsletter.
- Launch maturity: learning launch, beta, public release, relaunch, or feature drop.
- Primary metric and guardrail metric.
- Proof assets: installer, screenshots, video, release notes, QA reports, GitHub Release, demo script, or issue links.
- Claims to avoid: any feature, platform, signing, privacy, telemetry, performance, trust, or availability claim not supported by the current product context and release evidence.

If any input is missing, make a conservative assumption for an internal draft and mark the gap. Do not invent publish-ready evidence.

## Repo Truth To Read

Read current files before repeating product or release claims. Prefer current repo evidence over memory.

- `docs/launch/deskagotchi-positioning.md` for product context and channel defaults.
- `README.md` for current capabilities, package manager, deferred features, and architecture.
- `docs/release-notes/v0.1.0.md` or the target release note file.
- `site/index.html` or the target landing/download page when updating public page copy.
- `docs/desktop-app.md` for install, trust, and user-facing download instructions.
- `docs/release-notes/v0.1.0-video-shot-list.md` when drafting a video or demo flow.
- `docs/qa/using-qa.md`, `docs/qa/v2-closeout-report.md`, and targeted `.qa-runs/<run-id>/report.md`, `summary.json`, and `metadata.json` artifacts when citing validation. Only use QA runs explicitly tied to the target release, branch, commit, current closeout/release docs, or the current task. Do not mine unrelated historical `.qa-runs`.
- `docs/qa/v0.1-first-release-readiness.html` or current readiness docs when shaping v0.1 release scope.
- `.github/workflows/desktop-release-artifacts.yml` when making platform, release-asset, or publish-workflow claims.

If a task requires fresh platform or community rules, verify them from current primary sources before making channel-specific claims.
Treat readiness docs as snapshots. If they conflict with current workflow files, package config, release notes, or QA artifacts, prefer the current files and call out the drift.
If no target QA run is identified, mark the validation evidence as missing instead of searching all past runs for a convenient pass.

## Workflow

1. Define the launch job.
   - Identify the asset being produced and the audience's job-to-be-done.
   - Choose the launch shape: learning launch, beta release, public release, relaunch, developer proof, changelog, recurring post, or community feedback ask.

2. Load product context and proof before copy.
   - Read `docs/launch/deskagotchi-positioning.md` for voice, channel priority, nostalgia/IP boundaries, and default framing.
   - Pull concrete facts from repo docs, release notes, QA reports, screenshots, installer artifacts, and demo footage.
   - For release or QA claims, read both human reports and machine artifacts from the target QA run only. Check `summary.json` or equivalent source-state fields for dirty-worktree evidence before using release-candidate or final-validation language.
   - Separate proven facts, likely facts, and TODO evidence. Publish only proven facts.

3. Extract market and audience language.
   - Use user notes, issues, comments, calls, competitor pages, Reddit, X, YouTube, Product Hunt, HN, or reviews when available.
   - Capture phrases people already use for the pain, not only the founder's preferred phrasing.
   - Research should sharpen the product voice from the positioning doc, not replace it with generic launch language.

4. Find category fatigue.
   - List promises, phrases, and demos the audience has already seen.
   - Avoid any claim that could fit a competitor by swapping the name.

5. Generate and score claims.
   - Produce 3-5 candidate claims.
   - Score each 1-10 on clarity, novelty, proof, aliveness, channel fit, and trust risk.
   - Treat scores as a forcing function for comparison, not objective truth.
   - Pick the clearest provable claim, not necessarily the loudest one.

6. Build the proof sequence.
   - Before state: what the desktop normally lacks.
   - New behavior: what Deskagotchi visibly does.
   - Aha moment: the first moment someone understands why it is different.
   - Trust frame: platform scope, local data, signing status, release limitations, and current evidence.
   - Call to action: download, try, critique, star, comment, or report a bug.

7. Draft for the channel.
   - Match the channel's norms, CTA shape, and tolerance for polish.
   - Keep the product voice from `docs/launch/deskagotchi-positioning.md`.
   - Keep a founder voice where possible: concrete, plain, responsive, and not brand-sanitized.

8. Run critique passes.
   - Mom test: can a non-expert repeat what it is and why it matters?
   - Specificity and aliveness check: does each line add concrete behavior, charm, or useful context?
   - Truth pass: can every claim survive scrutiny against repo evidence?
   - Proof pass: does the demo show the claim instead of decorating it?
   - Channel fit pass: would this look like a useful post rather than support-begging or spam?
   - Product context pass: does it follow the positioning doc's voice, channel priority, nostalgia/IP boundaries, and hard avoid list?
   - Release scope pass: no platform, signing, privacy, feature, or QA overclaim.

9. Add measurement and follow-up.
   - Define attention, intent, activation, retention, and guardrail signals.
   - Convert objections into a feedback log and a next narrative beat.

## Recurring Content Workflow

Use this for weekly posting, release updates, and ongoing attention loops.

1. Gather inputs.
   - Recent commits, release notes, screenshots, clips, target QA artifacts for the current release/change, user replies, bugs, and product decisions.
   - Existing content artifacts under `docs/launch/` if present, including `content-calendar.md`, `post-history.md`, `feedback-log.md`, and `asset-inventory.md`.

2. Choose content candidates.
   - Select 2-3 post candidates with a concrete proof asset or useful story.
   - Prefer visible behavior, a clear release change, a technical note, a trust note, or a specific community ask.

3. Map each candidate to a pillar.
   - Use the content pillars in `docs/launch/deskagotchi-positioning.md`.
   - Do not force posts when there is no real change, proof asset, or useful observation.

4. Draft channel-native variants.
   - X: short post, screenshot/clip-first, one clear thought or ask.
   - Reddit: specific critique or milestone post tailored to the community rules.
   - Landing page: durable copy, release proof, download CTA, and trust details.
   - GitHub Release/changelog: exact scope, checksum, known limits, and support path.

5. Schedule the follow-up.
   - Define what to watch: replies, clicks, downloads, issues, objections, quote-post language, or subreddit feedback.
   - Convert useful feedback into an issue, docs update, follow-up post, or next release note.

6. Archive learnings when asked to persist artifacts.
   - Use `docs/launch/<launch-id>/` for launch-specific artifacts.
   - Use `docs/launch/content-calendar.md`, `docs/launch/post-history.md`, `docs/launch/feedback-log.md`, or `docs/launch/asset-inventory.md` only if the user asks to maintain ongoing records.

## Channel Guidance

Product Hunt:
- Prepare tagline, gallery, first comment, maker presence, and one clear ask for feedback or trying the app.
- Do not ask for upvotes or offer vote incentives.

Hacker News:
- Use `Show HN` only when the release is actually tryable.
- Lead with what is technically interesting: Windows desktop overlay, local persistence, deterministic simulation, Electron constraints, QA evidence, or open-source implementation.
- Avoid marketing titles, vote asks, and repost games.

Reddit and communities:
- Read rules first. Ask mods when unclear.
- Frame posts as a specific critique, demo, or build-in-public artifact.
- Avoid link flooding, mass DMs, copied replies, and asking for generic support.

X:
- Use a founder account, direct demo media, one concrete behavior, moment, feeling, or ask.
- Reply manually. Turn common objections into follow-up posts.
- Keep the copy direct; do not use engagement-pod or controversy tactics.

LinkedIn:
- Treat as opt-in only for this repo unless the user explicitly asks for it.
- If used, repurpose factual build notes or release summaries rather than forcing corporate positioning.

GitHub Release and changelog:
- Prioritize trust and exact scope over persuasion.
- Include installer name, checksum, signing status, platform scope, QA scope, known limitations, privacy/local-data notes, and issue-reporting instructions.

Download page:
- Show the real desktop pet experience in the first screen.
- Make the Windows download CTA obvious.
- Link source code or GitHub as a secondary action.
- Explain SmartScreen if unsigned and keep local-data/privacy claims precise.

Demo video:
- Record the exact release candidate when the video is public proof.
- Show launch, desktop pet, drag, feed/play/clean, settings, tray recovery, and local/offline trust points.
- Do not show capabilities, platforms, signing, auto-update, or features unless the current release evidence supports them.

## Output Contract

Return the smallest useful set for the requested task. For a full launch pass, include:

- One-sentence positioning.
- Top 3 claims with scores and trust risks.
- Hook bank.
- Demo narrative or video beat sheet.
- Channel-specific post or release asset.
- Founder first-comment or reply plan when relevant.
- Measurement scorecard.
- Claim-to-evidence map for publishable assets, with claim, source file or artifact, confidence, and caveat.
- Critique notes and rejected angles.
- Evidence gaps that must be filled before publishing.

If asked to persist artifacts, default to `docs/launch/<launch-id>/` unless the repo already has a better current location. Keep generated launch artifacts short and inspectable.

## Scorecard Template

```yaml
launch_id:
claim:
audience:
channel:
hypothesis:
primary_metric:
guardrail_metrics:
proof_assets:
channel_rows:
  - channel:
    asset_url:
    impressions:
    clicks:
    downloads:
    activated:
    issues:
    notes:
learnings:
winning_language:
failed_language:
objections:
product_gaps:
next_actions:
```

## Hard Rejections

Reject or rewrite copy when:

- The claim could fit any desktop pet or indie app.
- The demo does not prove the claim.
- The line is exciting but unsupported.
- The line is true but boring and can be compressed.
- The post asks for support, votes, or engagement instead of feedback, critique, usage, or a concrete action.
- The launch creates no activation path or post-launch learning loop.
- The release asset implies trust, signing, platform, telemetry, feature, or QA guarantees the current evidence does not support.
- The copy violates the voice, channel, nostalgia/IP, or hard-avoid rules in `docs/launch/deskagotchi-positioning.md`.
