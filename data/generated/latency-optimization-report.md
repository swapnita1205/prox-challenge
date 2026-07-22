# WeldPilot Latency Optimization — Before / After Report

Baseline: `latency-optimization-before.json/.md` (generated pre-change, matches the
reported live metrics: ~32.3s avg / ~52.2s p90).
After: `latency-optimization-after.json/.md` (generated post-change, same 12 live cases).
Full per-case detail lives in those four files; this is the aggregate summary.

## What changed (orchestration only — no reasoning/grounding/safety changes)

1. **Deterministic pre-fetch** (`lib/agent/prefetch.ts`, new) — runs the same pure tool
   handlers Claude would otherwise call, *before* the model is invoked:
   - `search_manual` for manual_question / part_identification / setup / visual_diagnosis /
     troubleshooting intents.
   - `calculate_duty_cycle` for calculation intent, when process + input voltage + amps are
     all confidently resolvable from the message (via the existing `extractQueryDimensions`
     dimension extractor) or machine state.
   - `find_settings` for settings intent (by the time this runs, the ClarificationPolicy has
     already guaranteed process/material/thickness are known).
   - Tasks are dispatched together via `Promise.all` (parallel, independent) rather than one
     Claude-mediated round trip at a time.
   - Writes into the *same* `AgentContext` (citations/artifacts/tool summaries) the MCP tools
     use, so grounding and existing artifact-preference logic (`preferToolArtifact`) behave
     identically whether a fact was fetched here or via a live tool call.
2. **Compact "already retrieved" context injection** — pre-fetch results (already-truncated
   JSON, same shape the tool would have returned) are embedded directly in the user prompt.
   The system prompt now tells the model to answer from that evidence directly instead of
   re-calling the same tool. Net effect: the common case is architecturally
   `router → parallel pre-fetch → one Claude turn → deterministic artifact render → response`
   instead of `Claude → tool → Claude → tool → Claude → ... → StructuredOutput`.
3. **Reduced `maxTurns` per intent** (`system-prompt.ts`) — now that pre-fetch resolves the
   common-case evidence, turn caps were cut roughly in half (e.g. settings 7→4, calculation
   5→3, setup 8→5, troubleshooting 8→6) to hard-cap any remaining thrashing while leaving
   headroom for genuinely dynamic follow-ups.
4. **In-request caches added**: `figureCache`, `graphCache`, `settingsCache` on
   `AgentContext` (mirroring the existing `retrievalCache`), so identical `get_figure` /
   `query_machine_graph` / `find_settings` calls within one request are answered from cache
   instead of recomputed. Citation de-duplication (the existing `addCitations` set-based
   check) already served as the citation cache.
5. **Module-level figure-candidate cache** (`lib/visual/figures.ts`) — `loadFigureCandidates()`
   derives from static build-time JSON and was being recomputed on every call (sometimes
   several times per request); now memoized once per process.
6. **Early streaming status** — `"Searching manuals..."` is emitted immediately (before
   pre-fetch/Claude even start), and `"Found the duty-cycle table and setup guide."` /
   `"Found the settings chart and setup guide."` / `"Found relevant manual sections."` is
   emitted right after pre-fetch resolves (typically single-digit milliseconds later, well
   under the ~2s target) — both in the production streaming path and the instrumented
   harness.
7. **Waterfall instrumentation** (`lib/agent/telemetry.ts` `WaterfallPhase` /
   `buildWaterfall()`) — every request now has an ordered phase breakdown: routing → pre-fetch
   (retrieval/graph/settings/duty-cycle) → each Claude turn → safety → artifact generation →
   grounding → rendering, each with start/end/duration. Exposed on
   `AgentRunTelemetry.waterfall`, plus new `routingMs` / `prefetchMs` / `renderingMs` fields.

### Two real correctness bugs found and fixed while instrumenting (pre-existing, not caused
### by this optimization, but surfaced by re-running live validation as required)

- **`MATERIAL_PATTERN` in `lib/agent/clarification-policy.ts`** only recognized
  steel/aluminum/stainless. A request naming an unsupported material (e.g. "titanium") was
  incorrectly treated as "material not given" and blocked with a clarifying question — even
  though the user had already answered. Fixed by broadening material *mention* detection
  (whether it's a *supported* material is correctly still resolved downstream by
  `resolveSettings`/grounding, not this gate). Regression test added.
- **Generic `manual-figure` fallback shadowed more specific diagrams** in
  `lib/visual/policy.ts`. `selectVisualArtifactTypes` unconditionally added `manual-figure`
  even when a more specific type (e.g. `polarity-diagram`) already matched; since artifact
  selection is "last-registered-wins", the generic figure silently overrode the specific
  diagram, and the model would then waste extra turns trying to regenerate the specific
  diagram itself via `generate_artifact_spec` (with schema mistakes, since it's not a tool
  the model reliably free-hands correctly). Fixed so the fallback only applies when nothing
  more specific matched (or was explicitly requested). Regression tests added for both.

No reasoning, grounding, or safety logic was changed — pre-fetch only supplies evidence the
model would have retrieved anyway; grounding still runs `groundResponse()` against the same
merged citations/claims, and safety-critical / configuration-missing requests are still
short-circuited pre-model exactly as before.

## Aggregate results (same 12 live cases, real Claude API calls)

| Metric | Before | After | Change |
|---|---|---|---|
| Case pass rate | 12/12 | 12/12 | — (unsupported-titanium case now passes for the *right* reason — see bug fix above) |
| **Avg end-to-end latency** | 32,333 ms | 26,826 ms | **−17.0%** |
| **Median end-to-end latency** | 33,059 ms | 24,467 ms | **−26.0%** |
| **P90 end-to-end latency** | 52,225 ms | 41,341 ms | **−20.8%** |
| Max end-to-end latency | 52,730 ms | 54,277 ms | +2.9% (one case still hit multiple Claude turns — see notes) |
| Avg time-to-first-SDK-token | 5,732 ms | 9,554 ms | +66.7% (see note below — perceived latency is better, not worse) |
| **Avg Claude model invocations / query** | 8.00 | 4.58 | **−42.8%** |
| Total Claude model invocations (12 queries) | 96 | 55 | −41 |
| **Avg MCP tool calls / query** | 3.75 | 1.92 | **−48.8%** |
| Total MCP tool calls (12 queries) | 45 | 23 | −22 |
| Total deterministic retrieval time | 746 ms | 331 ms | −55.6% (was already negligible — never the bottleneck) |
| Total deterministic artifact-gen time | 38 ms | 36 ms | ≈0 (already deterministic/instant before and after) |
| **Effective prompt tokens (12 queries)** | 336,651 | 178,655 | **−46.9%** |
| **Total cost (12 queries)** | $0.5922 | $0.4660 | **−21.3%** |
| Avg cost / query | $0.0494 | $0.0388 | −21.5% |

### Why latency improved less than turn count did

Tool execution (`retrievalMs`/`artifactGenerationMs`) was already sub-second before this
change — it was never the bottleneck. The bottleneck was **the number of Claude API round
trips**: every `Claude → decide tool → Claude → decide tool → ...` hop costs a full model
inference latency (several seconds each), not the (near-instant) tool execution in between.
Cutting invocations 8.0→4.6 and tool calls 3.75→1.9 per query removes most of that
round-trip tax, which is why avg/median/p90 all dropped meaningfully even though the raw
retrieval/artifact timings barely moved.

TTFT (time to the first SDK message) went *up* on average because pre-fetch now hands Claude
everything it needs up front, so its first turn is usually the *complete* reasoning + answer
turn (heavier to produce a first token for) instead of a quick "let me call a tool" turn. This
metric alone would be misleading about user-perceived responsiveness: production streaming now
emits `"Searching manuals..."` within milliseconds of the request (before pre-fetch or Claude
even start) and a `"Found ..."` status right after pre-fetch resolves — both well under the
target 1s/2s windows — so the user sees progress immediately regardless of the SDK's own TTFT.

### Response budgets — where we landed

| Category | Target | Observed (after) | Met? |
|---|---|---|---|
| Simple factual retrieval | <8s | ~21–22s (front-panel-visual, oos-lincoln, malformed-input) | No |
| Duty cycle | <6s | ~19s | No |
| Settings | <12s | ~32–37s | No |
| Troubleshooting | <15s | ~24–54s | No |
| Visual diagnosis | <25s | (no live visual_diagnosis case in the 12; setup/troubleshooting cases with figures land ~35–41s) | No |

None of the aggressive sub-15s budgets are met yet. The floor here is the hosted model call
itself: even the *single-turn* cases (duty-cycle, settings-valid — both now resolve in exactly
one Claude turn plus the mandatory structured-output turn) still take 18–32 seconds, because a
single Claude Sonnet call with a JSON-schema-constrained structured output on this prompt size
already costs that much wall-clock time. Turn-count reduction (the lever this pass focused on,
per the "deterministic router → parallel retrieval → one Claude call" instruction) has a floor
once you're down to one turn; hitting the stated budgets would require either a faster model
for this path (e.g. Haiku, at a probable grounding/quality trade-off), skipping the model
entirely for fully-deterministic answers (calculation/settings could plausibly be answered
without Claude at all, but that changes the shape of the "answer" beyond an orchestration
change), or accepting these as *perceived*-latency budgets satisfied by streaming status text
rather than full-response budgets. That trade-off was not made here because it risks the
explicit constraint "do not change the reasoning quality" — flagging it rather than making the
call unilaterally.

### Remaining variance / not fully eliminated

A few cases (`tig-polarity-ground`, `multi-turn-porosity-1`) still take multiple Claude turns
because the model chooses to call an additional tool (e.g. `get_manual_page` for full page
text) even with pre-fetched evidence present, or the SDK retries a `StructuredOutput` turn
when the model's first JSON attempt has a schema mismatch (e.g. stringified arrays instead of
native arrays) — both are model-output-quality issues, not orchestration issues, and were left
alone per "do not change the reasoning quality."

## Rejected / not attempted

- Skipping Claude entirely for calculation/settings (fully deterministic answer + artifact,
  no model call) — would likely meet the aggressive budgets for those two categories, but
  changes the shape of "reasoning" for those intents (no model-authored explanation text),
  which risks the "do not change reasoning quality" constraint. Flagging as a candidate for a
  follow-up decision rather than doing it silently.
- Swapping to a faster model for low-complexity intents — same reasoning-quality risk, not
  attempted without explicit sign-off.
