# Adaptive routine recommendations

Version: `adaptive-2026-11-01-v1`.

The initial model uses `F * (0.45 C + 0.40 E + 0.15 I) * (1-D)^2`.
These are experimental ranking weights, not calibrated execution probabilities
or demonstrated improvements in real user outcomes. Eligibility, the calendar,
time budgets, permanent exclusions, and canonical deduplication run before
sampling. Sampling uses stable softmax (temperature .08) plus a .10 uniform
component, without replacement. Each selected position records its conditional
probability and the eligible pool's component scores on the server.

## Behavior and storage

- `recommendation_profiles` is server-owned, scoped to the authenticated Clerk
  user and deleted through the existing user-state foreign key cascade.
- State writes, explicit add/remove/restore intents, and pet execution projections
  update learning in the same transaction. User-state row locking serializes
  state, pet, and recommendation mutations. No application revision is consumed
  for a standalone browsing event.
- Signals aggregate once per Korean calendar day and canonical behavior. Repeated
  views/retries do not multiply evidence. Search text is not sent or stored.
- A visible card requires at least 50% intersection for one second, a foreground
  document, and no open dialog. Search-result opens are weak positive interest;
  voluntary catalog selection is stronger. Browsing is batched and retried.
- E/I/D use priors 2/2, 1/1 and 1/9 and 30-day evidence half-life. A partial
  execution has value .5. Existing explicit completion can seed positive evidence;
  missing historical impressions are not reconstructed as failures.
- Unknown execution becomes only a .1-weight negative after a 36-hour grace
  window, provided the recommendation was seen, not withdrawn, and not censored
  by workload/condition. Time, pain, fatigue and schedule reasons are censored
  rather than classified as global dislike.
- Removing a routine is weak negative evidence by default. The optional reason
  can strengthen it, remove the negative effect, or permanently exclude it.
  Undo reverses the removal; regeneration is not interpreted as user removal.
- Signals retain 90 calendar days; at most 180 recent batch audits are retained.
  Permanent exclusions remain until explicitly restored. Both are included in
  account export and full reset. Removed/cancelled learning is rebuilt from final
  daily state rather than subtracting a previously computed probability.
- The initial plan can precede the first saved profile. Its neutral recommendation
  is generated without a persisted propensity audit; it must be excluded from
  propensity-based offline evaluation. Later batches have server audits.

## User experience

Default automatic count is three. Settings allow four or five. Existing manual
and completed routines remain. If constraints prevent the requested count, the
application explains the smaller set. The count setting applies to the next
generation. Existing daily lists are not silently replaced on page refresh;
"개인화 루틴 다시 추천" or the daily check-in triggers generation. Previews use the
current preference snapshot without recording their hypothetical outcomes.

The planner drag image uses the measured width and height of a 30-minute grid
cell. The scheduled duration still comes from the original template. The title
button is explicitly draggable; drag-image DOM is removed at the end/unmount.

## Validation

- `node scripts/test-engine.mjs`: ranking, bounded probabilities, learning,
  duplicate signals, cancellation/undo, exclusion and time constraints, retained
  routines, drag-image cell dimensions, and the existing regression suite.
- `node --env-file=.env.local scripts/verify-recommendations.mjs`: development-only
  Clerk -> HTTP -> Neon verification. Creates synthetic users, checks profile
  persistence, removal/undo, 3/5 counts, audits, isolation/CSRF/CAS and cascade
  cleanup; deletes only its own fixtures.
- `node scripts/test-pet-db.mjs`: pet transactions remain compatible with the new
  learning projection. Requires the new additive migration first.

Actual uplift requires future randomized/appropriately logged evaluation. Scores
and conditional selection probabilities must not be presented as "accuracy".
