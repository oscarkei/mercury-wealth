# Vercel direct chat — no Laya

This deployment deliberately uses DeepSeek Flash for analysis, tools and validated `render_ui`. It is not an automatic fallback. No Laya worker, PyTorch installation or model weights are part of the production runtime. The Laya source remains in Git history and the separate dated archive.

## Deployment

The repository root `Dockerfile.vercel` builds the Next mobile app and the existing Python financial toolkit into one Vercel container. `vercel.json` selects `container`. The gateway listens on `PORT` (default 8080); Next runs privately on 3100. No request is sent to the operator's localhost. Only `/api/session` and `/api/cloud-chat` are exposed by the gateway; other local data/admin API routes are not proxied.

Set **DEEPSEEK_API_KEY** in Vercel Production (and Preview only if live preview testing is desired), then redeploy. Use the existing key. It must not be a NEXT_PUBLIC variable or build argument. No additional analysis host or paid Vercel upgrade is required by this design. Actual provider quota and platform usage limits still apply.

Optional: `MERCURY_SESSION_SECRET` (32+ random characters) decouples visitor/continuation signing from provider key rotation. Without it, separate purpose keys are derived from the server-only provider key. Rotating either secret invalidates saved continuation tokens. `MERCURY_PUBLIC_ORIGIN` defaults to the production mercury-wealth-mu.vercel.app origin; trusted Vercel preview URLs are taken only from Vercel runtime variables.

## Request lifecycle

1. Same-origin POST creates/refreshes an eight-hour signed HttpOnly Secure visitor cookie.
2. The question and optional encrypted continuation token are validated; family scope is always server-selected.
3. DeepSeek chooses research depth and tools. Public demo holdings use the same committed snapshot as the website, not the local Supabase database. Public market data is retrieved as tools request it.
4. Results/units/dates and UI references are validated. Progress and results stream through the active HTTP request; there is no detached job or polling queue.
5. Completion returns the rendered JSON and an AES-GCM sealed continuation. The browser saves up to 12 completed turns / 2 MB / seven days. No images are stored. Tokens expire after eight hours and bind owner, conversation, run and scope. Raw edited browser JSON is never accepted as research evidence.
6. Refresh can restore available browser results. Another browser/device cannot access that history. Clearing browser data removes it. Expired or evicted context returns a clear request to start a new conversation. A new conversation clears the old conversation's saved cloud turns.

There is no durable cloud SQLite. Existing local SQLite and credentials are untouched. This is an explicitly bounded public demo, not private multi-client wealth storage. It does not claim persistent cross-device history, Supabase synchronization or advisor message delivery.

## Resource limits

- 270-second request deadline, below the previously observed 300-second Hobby function limit.
- One active analysis per container; extra requests receive 429 rather than queueing indefinitely.
- Twenty starts per signed visitor per hour **in that container**, with a bounded in-memory visitor map. This is not a globally durable spend cap: autoscaling, restart or new sessions reset/bypass instance-local accounting. Configure provider spending controls and Vercel access/firewall rules if sharing beyond a controlled demo. No paid plan or new protection setting is automatically purchased/enabled.
- 280 KB request, 2 MB inflated continuation; bounded context. Excessive context is not silently trusted or reconstructed.
- Cancellation propagates to fetches; Python calculation timeout is bounded. No automatic billed retry after a lost HTTP request.
- Financial libraries retained: OpenBB/Cboe, Riskfolio-Lib, bt, QuantStats, FinanceToolkit. They load on demand; installing them does not mean every question calls them.
- Optional EIA/BEA/provider data keys remain optional; absent sources must report a gap rather than invent data.

## Verification

Run `npm test`, `npm run analysis:test`, `npm run typecheck`, `npm run build`. Dedicated tests cover native UI calls, holdings/proposal results, rejected references, sealed context tampering/ownership/scope/expiry, continuation across server instances, missing key, origin checks and cancellation/concurrency.

Scripted-provider tests verify plumbing, not DeepSeek quality or quota. A live deployment must separately test a market question, actual demo holdings, a relevant follow-up and a topic switch. Record total time, tool trace, UI references and any provider gaps. Build success or `configured:true` alone is not live-chat success.

The older `services/analysis/cloud-server.mjs` is the optional long-running host design documented in cloud-analysis.md. It is not the Vercel entry point.
