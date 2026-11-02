# Mercury v0.5 conversation alpha

This branch is an isolated, reviewable successor to the current public mobile app. It is not a production deployment.

## Baseline and version control

- Production baseline: `9a6cc436235adcef6b5e3c0342ec952ed0619bef`.
- Development branch: `next/v0.5-conversation`.
- Version: `0.5.0-alpha.1`.
- Local baseline tag: `v0.4-vercel-stable-20261102`. The public baseline commit is the authoritative rollback reference; the tag has not been uploaded because shell Git authentication is unavailable.
- `main` remains unchanged. No force push, database migration, or production configuration mutation.
- `vercel.json` disables automatic Git deployments on this branch from its first commit. **Do not re-enable this setting during development.**
- After user acceptance, select ONE manual Preview deployment. Later, review and merge through a PR, decide explicitly whether to restore automatic deployments on main, and perform ONE production deployment.
- Keep the currently retained production and rollback images. No new container images were requested for this implementation.
- Code rollback and conversation data rollback are different. Reverting the code must not overwrite credentials, SQLite, Supabase or production browser conversation records. Test conversations are not merged into production conversations.

## Runtime responsibilities

1. DeepSeek Flash interprets the actual financial question and chooses research depth, evidence and financial tools.
2. `select_research_depth` may update structured task memory using verbatim user quotes. Unedited confirmed conditions persist. A new topic or changed authorized scope resets the active task.
3. Existing scoped tools fetch evidence and compute values. Task guards reject changed confirmed cash/shock conditions, out-of-scope references and evidence calls on a presentation-only request.
4. The existing evidence validator checks the completed analysis. It is shown before optional presentation selection completes.
5. A separate lightweight DeepSeek call selects existing visual candidate IDs and original explanation paragraphs. It cannot introduce chart data, change the financial conclusion or call evidence tools.
6. The renderer displays the selected components and at most two supported next steps. The full original answer remains expandable.

There is no Laya runtime, no GPU requirement introduced by this branch, and no replacement-model fallback. This changes the orchestration and presentation stages, not the financial libraries or data providers.

## Follow-up interaction

- General buttons ask a self-contained, relevant explanatory/research question.
- Scenario results can offer a prefilled percentage shock input.
- Held-rebalance results can offer a prefilled cash target input.
- These inputs are validated against the signed previous result and numeric range on the server. They ask Mercury to continue with preserved conditions; they do not execute trades.
- A missing mandatory parameter produces one concise clarification, without an optional CTA inventory.
- No general document-saving, adviser-messaging, trading or app-command framework is added.

Cash-only rebalancing preserves explicitly locked positions and proportionally scales the remaining unlocked non-cash holdings. Infeasible targets are rejected. Other explicit category targets use within-category proportional allocation. These remain snapshot arithmetic, not optimization, execution, historical returns or suitability advice.

## Storage and isolation

The browser stores JSON, not images: 12 completed turns, seven days, 2 MB. The new key is `mercury-v05-cloud-turns-v1`. Owner/conversation/scope-bound continuation tokens retain confirmed conditions and compact completed-calculation references. No production schema changes. The Vercel holdings source is still the labelled public fictional snapshot; this does not connect live private Supabase data.

An isolated managed worktree is used. Ports 3012 (gateway) and 3013 (web) are reserved for the new local preview. Existing 3001 and 3009 directories and data are not changed.

## Local preview

With Node 24 and dependencies installed:

```sh
npm test
npm run analysis:test
npm run typecheck
MERCURY_PUBLIC_MOCK=1 npm run build
node scripts/start-v05-preview.mjs
```

Open `http://127.0.0.1:3012/connect`, enter the existing DeepSeek key yourself, and open `/phone?size=actual#chat`. The key is held in memory only and the preview exits after 20 minutes. The loopback-only gateway rejects other Host/Origin values. It never loads a production environment file. Research subprocesses receive the key over IPC, not through arguments or files, and exit after their request. Set `MERCURY_FINANCE_PYTHON` to the existing supported finance Python environment when testing Python-backed tools. The public deployment continues to use its existing container runtime.

## Acceptance / remaining boundaries

Automated coverage includes multi-turn task retention, changing one field, new-topic/scope reset, invented quote rejection, display-only no-fetch behavior, percentage validation, lock preservation, infeasible targets, value conservation, post-analysis evidence-bound UI and bounded CTA input.

Live acceptance must inspect content and actual tool calls, not just HTTP connectivity. The initial run found a planning-retry failure and unsupported optional calculation wording; these were corrected. Consult the validation record for rerun outcomes. Probabilistic model wording remains a review concern; passing an input/result validator does not prove every qualitative causal statement.

Before merging, the user should review the mobile result hierarchy, whether the extra UI-selection call is worth its latency, and the preserved portfolio/snapshot limitations. A merge is not authorized by this implementation task.
