# Deskagotchi V2 Care Simulation Spec

This is the living design document for Deskagotchi's care simulation. Update it
whenever gameplay rules, constants, state fields, action effects, or evolution
conditions change.

The code source of truth is `src/shared/simulation.ts`. This document explains
the intended behavior in product terms so future implementation work does not
turn into scattered constants and implicit rules.

## Goals

- Make the pet feel alive over days and weeks, not minutes.
- Keep normal care fair and recoverable.
- Make neglect visible through mood, mess, sickness, delayed growth, or worse
  evolution outcomes.
- Make good care visible through affection, happy moods, cleaner growth paths,
  and cosmetic or behavioral unlocks later.
- Keep simulation deterministic and testable with injected time.
- Keep normal pet care fully offline.

## Current Model

The current runtime stores `lastSimulatedAt` on the active pet instance. The main
process calls simulation once per minute while the app is running, and also on
resume or screen unlock.

Current default constants:

| Constant | Current value | Meaning |
| --- | ---: | --- |
| `tickMinutes` | `15` | Simulation logic advances in 15 minute chunks. |
| `maxOfflineCatchupHours` | `36` | Max offline time that applies full stat decay. |
| `maxMessCount` | `5` | Highest accumulated mess count. |
| `careHistoryWindowHours` | `72` | Recent-care window used for quality scoring. |
| Hunger deadline | `4h` | Time to feed after hunger becomes critical before a care mistake. |
| Happiness deadline | `8h` | Time to cheer up after happiness becomes critical before a care mistake. |
| Mess deadline | `6h` | Time to clean high mess before a care mistake. |
| Sickness deadline | `18h` | Time to give medicine after sickness before a care mistake. |
| Sleep deadline | `2h` | Time to let a very tired pet sleep before a care mistake. |
| Baby threshold | `24h` | Age at which egg/baby threshold is crossed. |
| Child threshold | `72h` | Age at which child threshold is crossed. |
| Teen threshold | `240h` | Age at which teen threshold is crossed. |
| Adult threshold | `504h` | Age at which adult threshold is crossed. |

Stats currently tracked:

- Hunger.
- Happiness.
- Energy.
- Cleanliness.
- Health.
- Affection.
- Discipline.
- Weight.

State currently tracks:

- Age hours.
- Life stage.
- Growth stage id.
- Mood.
- Sickness.
- Mess count.
- Clock rollback count.
- Offline debt hours.
- Explicit care deadlines.
- Care history.

## Offline Progression

Offline progression answers: "What happened to the pet while the app was not
actively simulating?"

When the app opens or wakes, the simulation compares `now` with
`lastSimulatedAt`.

Example:

| Time away | What happens |
| ---: | --- |
| `8h` | Simulate all 8 hours normally. |
| `48h` | Simulate 36 hours of decay, store 12 hours as offline debt. |
| `14d` | Simulate 36 hours of decay, age the pet by the remaining debt. |

The cap exists so a user is not punished with unbounded damage after a holiday
or a long shutdown. The pet can age, but hunger, health, and mess do not stack
for weeks.

V2 should keep a cap, but make its product behavior clearer:

- Full care decay applies up to the cap.
- Extra time can age the pet.
- Extra time should not add infinite sickness, mess, or death.
- The UI should be able to explain that time passed while the pet was away.

## Current Action Effects

| Action | Current effect summary |
| --- | --- |
| Meal | Raises hunger strongly, small happiness and health gain, adds weight. |
| Snack | Raises happiness more than hunger, can reduce health, adds weight. |
| Play | Raises happiness and affection, costs energy, lowers weight slightly. |
| Clean | Clears mess, restores cleanliness, small health and happiness gain. |
| Medicine | Clears sickness, raises health, small happiness cost. |
| Sleep toggle | Moves lifecycle between active and sleeping. |
| Pet | Raises happiness and affection. |

Food item effects come from `resources/items/lcd-core/items.json`, then pet
preference modifiers are applied by `src/shared/food.ts`.

## V2 Rule Additions

### Care Deadlines

When a critical need becomes bad, the simulation starts an explicit persisted
deadline rather than immediately counting a care mistake. If the user resolves
the need before the deadline, the deadline clears. If the deadline expires while
the need is still active, the simulation increments `careMistakes`, emits a
`care_deadline_missed` event, and pushes that need's next deadline forward.

Current deadlines:

| Trigger | Deadline | Miss result |
| --- | ---: | --- |
| Hunger below `20` | `4h` | Care mistake, continued health pressure. |
| Happiness below `20` | `8h` | Care mistake, sad mood pressure. |
| Mess count at least `3` | `6h` | Care mistake, sickness pressure. |
| Sick | `18h` | Care mistake, medicine delay pressure. |
| Energy below `15` while awake | `2h` | Care mistake, sleep debt pressure. |

The persisted `careDeadlines` object stores nullable ISO datetimes for:

- `hunger`.
- `happiness`.
- `mess`.
- `sickness`.
- `sleep`.

Care actions clear matching deadlines:

- Feeding clears hunger when the food resolves hunger.
- Play or petting clears happiness.
- Cleaning clears mess.
- Medicine clears sickness.
- Entering sleep clears sleep.

Older save files without `careDeadlines` are still accepted; simulation
normalizes missing deadlines to null and writes the field on the next simulated
state update.

### Discipline Calls

Discipline should be a distinct care concept, not just a stat.

Candidate behavior:

- Pet occasionally asks for attention when no real need is urgent.
- Responding correctly raises discipline.
- Missing the call adds discipline mistakes.
- Discipline affects growth paths and maybe behavior frequency.

### Sleep

V2 needs a clearer sleep model.

Candidate behavior:

- Each pet/package can define a preferred sleep window.
- Tired pets can ask for rest.
- Sleeping slows or pauses hunger and happiness decay.
- Sleep restores energy.
- Missing sleep adds sleep debt and hurts care score.
- Evolution can optionally happen on wake, which feels more like a virtual pet.

### Sickness

Sickness should track duration.

Candidate fields:

- `sickSince`.
- `medicineDoseCount`.
- `medicineDelayHours`.

Candidate behavior:

- Low health or high mess can cause sickness.
- Medicine cures after one or more doses.
- Long untreated sickness lowers health and care score.
- V2 should be careful with death. If death exists, it should be rare,
  recoverable through warning states, and clearly communicated.

### Growth And Evolution

Current growth uses age hours plus care score ranges from the package manifest.
V2 should keep package-driven growth, but make care branches clearer.

Candidate inputs:

- Age.
- Care mistakes.
- Discipline mistakes.
- Sickness duration.
- Mess hours.
- Sleep debt.
- Play count.
- Affection.
- Food balance.

Each package should define stage branches without hardcoding renderer behavior.

## Documentation Rule

Any pull request that changes care simulation must update this document if it
changes one of these:

- Persistent state fields.
- Default constants.
- Offline progression behavior.
- Action effects.
- Mood derivation.
- Care history scoring.
- Growth or evolution conditions.
- Sickness, sleep, mess, or discipline rules.

## Test Rule

Every simulation rule should have deterministic tests that inject time directly.

Minimum coverage:

- Offline catch-up below cap.
- Offline catch-up above cap.
- Clock rollback.
- Each care action effect.
- Each deadline start and expiry.
- Sickness creation and cure.
- Sleep recovery and sleep debt.
- Evolution branch selection.
- Mood-to-animation mapping for each supported mood.
