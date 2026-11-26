# Memory and cache contract

Status: proposed runtime behavior. These instructions do not themselves persist data.

## Authoritative stores

Use the existing Supabase deployment initially. Avoid adding a separate vector-memory service or Redis before evidence shows a need.

| Store | Minimum fields |
|---|---|
| conversations | id, selected scope reference, dataset version, title, summary, summary-through-message-id, state version, updated-at |
| messages | id, conversation-id, sequence, role, text, result references, completion status, created-at |
| analysis_state | conversation-id, topic records, active topic-id, current entities, resolved product-id, parameters, assumptions, unanswered questions, evidence refs, revision |
| tool_results | result-id, normalized request hash, scope, source/snapshot versions, engine version, parameters, result payload, observed-at, retrieved-at, expires-at, completeness |

Keep the client profile/IPS in the source dataset, referenced by version. Store confirmed preferences separately from inferred ideas. Keep simulated allocations separate from holdings. Use stable conversation IDs independent of the full raw cookie string. Enforce unique message IDs and optimistic state revisions to prevent retries or concurrent tabs from overwriting newer turns.

## Context assembly

Assemble: shared policy → selected skill instructions → client summary relevant to the question → structured state → compact older summary → recent complete user/assistant turns → relevant past turns/results → current request. Preserve all user and assistant sources, including deterministic/local account replies. Fit within a token budget by dropping irrelevant material first, not by silently deleting the selected scenario or its assumptions.

Load referenced results from storage; do not assume the model remembers a displayed chart. Search older stored messages by topic/entity when a user explicitly resumes an earlier analysis. An initial lexical/entity lookup is sufficient for the demo; semantic retrieval is optional later. Record source message IDs for summaries; never allow a summary to override a later explicit correction.

## State transitions

- On a follow-up, resolve pronouns against the active topic and visible selection. Ask when two products/entities are equally plausible.
- On a parameter change, preserve all other confirmed parameters; issue a new revision and calculation request where required.
- On a topic switch, create/select a topic record; retain previous topics. Do not clear all conversation memory when changing from market research to portfolio or products.
- On refresh or process restart, restore messages, state and valid result references from the authoritative store.
- On a model change, retain application state. Adapt provider history according to that provider's rules; do not blindly send incompatible call records to another provider.
- On failure/cancellation, preserve completed results and mark incomplete requests; never persist a partially generated answer as a verified finding.
- On explicit demo reset, create a new conversation or clear its state and result links as requested. Preserve the immutable source dataset unless a dataset reset is requested. A new conversation must not accidentally restore the reset analysis.
- On a demo household/scope change, build a fresh scope-specific context; an account answer must not reuse another scope's cached result.

## Cache keys and invalidation

Cache by normalized tool name/arguments + selected scope where relevant + dataset/snapshot version + market-data version + engine/terms version + currency + period + adjustment convention + benchmark + assumptions. Include every input that changes the result. Keep public data separate from scope-specific portfolio outputs.

Reuse a deterministic scenario when all inputs and versions match. Invalidate/recompute when any relevant input changes. Use source-specific freshness for market data; preserve both observed-at and retrieved-at. A cached historical result can remain usable if explicitly labeled, but an explicit refresh bypasses the freshness cache. Do not substitute an old result for a live request without saying so. Do not use cross-conversation personalized answer caching in v0.1.

Keep skills cached by library version/content hash. Provider prompt caching reduces repeated input cost; it is not conversation persistence. Provider interaction state/thought signatures are protocol data and must be managed by the API adapter, separately from business state and user-visible summaries.

## Acceptance evidence

Verify a long mixed-topic conversation, page refresh, server restart, model switch, failed tool call, changed benchmark, changed snapshot, explicit reset and scope switch. Log request/result IDs and versions rather than relying on a fluent-looking reply. The preserved facts and invalidated caches must be visible in the trace.

## v0.5 alpha implementation boundary

This cloud alpha does not migrate the databases described above. Confirmed task conditions, result IDs and revisions travel in the existing encrypted, owner/conversation/scope-bound continuation token. The local preview uses an isolated browser key (`mercury-v05-cloud-turns-v1`), 12 turns, seven days, 2 MB. The token expires after eight hours. Production SQLite and Supabase are not rewritten. Public demo holdings remain a labelled committed snapshot, not a new live bank connection. Refresh restores stored JSON; images are not stored.
