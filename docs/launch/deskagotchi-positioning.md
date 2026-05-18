# Deskagotchi Positioning And Launch Context

Use this as the product context for launch copy, landing-page updates, X posts,
Reddit posts, release notes, changelogs, and recurring content. Keep the
workflow itself in `.codex/skills/deskagotchi-launch-workflow/SKILL.md`; this
file holds the Deskagotchi-specific voice, framing, channel defaults, and
boundaries.

## Positioning Default

Deskagotchi is a free Windows-first indie desktop pet beta: a tiny virtual
companion for people who miss checking on a little digital creature.

It should feel handmade, local, playful, and slightly nostalgic. It is not a
life-changing product, productivity system, wellness tool, enterprise app, or AI
companion. The promise is small on purpose: bring a little life to the desktop,
care for it between tasks, and enjoy a small companion that lives locally on
your machine.

## Emotional Frame

Lead with the feeling of old handheld virtual pets and small desk companions:

- remembering the tiny ritual of checking whether a digital pet was okay
- having a small creature on the screen that makes the desktop feel more lived-in
- feeding, playing, cleaning, and checking in during the workday
- the charm of LCD toy art, compact animations, simple needs, and low-stakes care
- a personal indie project made with care, not a polished corporate product

Keep the emotion gentle and specific. Avoid claiming Deskagotchi solves
loneliness, mental health, productivity, burnout, or social connection.

## Voice Rules

Use language like:

- tiny, little, small, desk, desktop, tray
- pet, companion, creature, crew
- care, feed, play, clean, sleep, check in
- snack, favorite food, mood, personality
- handmade, local, Windows-first, beta
- no account, no analytics, no remote telemetry in normal use, no remote sync

Avoid language like:

- change your life
- transform your workflow
- unlock productivity
- AI companion
- wellness companion
- cure loneliness
- gamified productivity
- next-generation platform
- enterprise-ready
- frictionless ecosystem

Prefer plain founder copy over polished brand language. The tone should be warm,
specific, and lightly playful without becoming childish or gimmicky.

## Nostalgia Without IP Risk

Safe framing:

- "virtual pet nostalgia"
- "handheld digital-pet feeling"
- "LCD toy feel"
- "tiny care loop"
- "checking on a little digital creature"
- "a small desktop pet for people who miss old virtual pets"

Avoid:

- implying affiliation with Bandai, Tamagotchi, Codex pets, or any proprietary brand
- copying names, characters, logos, shell designs, product shapes, or packaging language
- using trademarked "for your laptop" or similar comparison phrases in public copy
- making side-by-side comparison graphics that depend on proprietary imagery

It is okay to mention the broad memory of virtual pets if the copy clearly makes
Deskagotchi its own indie desktop pet.

## Channel Priority

Default channels:

1. Landing/download page: the home base for the release, proof, trust notes, and download CTA.
2. X: short demo clips, screenshots, build updates, release posts, and pet moments.
3. GitHub Release/changelog: exact release scope, checksum, trust details, and source link.
4. Reddit/community posts: only for meaningful milestones or specific critique requests, and only after reading each community's rules.

Optional channels:

- Product Hunt: use for a more polished public launch when the download page, demo media, and support loop are ready.
- Hacker News: use only when the technical/open-source angle is strong and the app is tryable.
- LinkedIn: avoid by default unless explicitly requested or repurposing a factual dev/build note.

## Recurring Content Pillars

Use these when planning regular posts:

- Pet moments: tiny clips or screenshots of Bao, Miso, Mochi, Peanut, or Puddles doing something recognizable.
- Release/change updates: what shipped, why it matters, and one proof screenshot or clip.
- Build-in-public notes: overlay behavior, tray recovery, local-only data, deterministic care simulation, release QA, or design decisions.
- Trust/transparency: Windows-first beta, no account, no analytics or remote telemetry in normal use, no remote sync, unsigned caveat when relevant.
- Community asks: specific feedback, bug reports, feature tradeoff questions, or release-candidate critique. Use pet preference polls only where community norms allow lightweight product feedback.
- Nostalgia posts: short reflections on the old digital-pet ritual, tied back to an actual Deskagotchi behavior or clip.

## Reddit Post Shapes

Tailor Reddit posts to the audience instead of cross-posting generic launch copy:

- Nostalgia or virtual-pet communities: lead with the small care ritual and ask for feeling/fit feedback. Avoid brand comparison claims and proprietary imagery.
- Windows desktop/tool communities: lead with the desktop overlay, tray recovery, local data, installer scope, and a concrete demo.
- Indie-maker or build-in-public communities: lead with the build story, tradeoffs, release lessons, or what changed since the last update.

Do not use polls, feature requests, or broad "please support this" posts in communities where that would read as market research or promotion.

## Cadence

Default weekly rhythm:

- Start of week: review recent commits, release notes, screenshots, and target QA artifacts for the current release/change; choose 2-3 post candidates.
- Midweek: publish one X post with a clip, screenshot, or visible change.
- Release day: publish GitHub Release/changelog, update the landing page if needed, and write an X release post or short thread.
- Reddit: post only for substantial milestones or specific feedback requests; never cross-post the same generic launch copy.
- End of week: review clicks, downloads, replies, issues, objections, and useful phrases; log what should become a fix, docs update, or next post.

Do not force daily posts if there is no real change, proof asset, or interesting pet moment. A quiet week is better than filler.

## Sample Hooks

- "I made a tiny desktop pet for Windows."
- "For people who miss checking on a little digital creature."
- "Deskagotchi is a small virtual pet that lives on your desktop."
- "Feed it, play with it, drag it around, and keep it company while you work."
- "A local-first indie desktop pet beta: no account, no analytics or remote telemetry, just a small companion on your machine."
- "I wanted my desktop to feel a little more lived-in, so I built a tiny pet for it."
- "Remember the old habit of checking whether your digital pet was okay? I built a desktop version of that feeling."

## Trust And Release Notes

Public release copy should stay aligned with the current release candidate and
release notes. Before publishing, check the current docs and evidence for:

- Windows installer CTA and exact installer name.
- GitHub/source link.
- Signed or unsigned status.
- SHA256 checksum for the attached installer.
- SmartScreen/Unknown Publisher caveat when unsigned.
- No account, no analytics or remote telemetry in normal use, no remote sync.
- QA harnesses may write local event logs only when explicit QA mode is enabled.
- Local data path and reset/uninstall behavior.
- Known limits: Windows-first beta, custom pets deferred, macOS unavailable unless tested.
- Exact QA scope and any manual checks still excluded or deferred.

Do not call the release "validated", "secure", "cross-platform", "signed", or
"production-ready" unless the current release evidence supports that exact claim.
