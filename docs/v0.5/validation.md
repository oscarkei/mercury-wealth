# v0.5 validation — 2026-11-02

Production was not deployed or modified. Tests use the labelled public fictional portfolio snapshot, the existing DeepSeek Flash key in a bounded local test session, and the same financial adapters as the cloud branch. No Laya.

| Conversation | Turn | Question | Seconds | Result |
|---|---:|---|---:|---|
| 1 | 1 | 美國能源市場而家點睇 | 21.4 | completed |
| 1 | 2 | 對我持倉有咩影響 | 12.0 | completed |
| 1 | 3 | 將目前持有嘅直接美股價格下跌 10%，其他資產不變，試算會輸幾多。 | 11.1 | completed |
| 1 | 4 | 同一批股票，改為下跌 15%，其他假設不變。 | 9.4 | completed |
| 2 | 1 | 睇下我持倉概覽 | 15.3 | completed |
| 2 | 2 | 幫我 rebalancing | 5.4 | completed |
| 2 | 3 | 現金提高至 10%，MSFT 保持不變，其餘現有持倉按原有比例調整。 | 11.4 | completed |
| 2 | 4 | 現金改為 15%，其他條件不變。 | 10.2 | completed |

All eight rerun turns completed with no failed evidence/calculation tool calls. This is a functional run, not a statistical latency benchmark or an independent financial research endorsement.

- Energy retrieved separate observed oil and natural-gas series, EIA outlook/storage and public source evidence.
- Portfolio impact used the actual scoped snapshot; indirect fund/structured exposures remained unquantified.
- Shock change -10% → -15% retained identical holding IDs; independently checked loss ratio = 1.5.
- Rebalance without targets asked a clarification and made zero evidence/calculation calls in the rerun.
- Cash 10% → 15% retained all three MSFT positions unchanged. Total value reconciles; all other unlocked non-cash positions scale proportionally.
- Initial failures were preserved in local artifacts: a plan-retry lockout, unsupported custom calculation suggestions, and a preview worker startup race. Corrected and regression tested.

Automated validation: 203 app tests; 95 analysis/service tests; TypeScript check and production build passed.

Limitations: qualitative causal statements and unsupported derived prose still require editorial review. The numeric/result validator does not establish causal truth. Presentation may take an extra DeepSeek call; measured totals include it. No assertion that this is faster than Laya or the production baseline.

Mobile acceptance is recorded separately after exercising the signed CTA input and reload.

Mobile live acceptance: the actual 390 × 844 phone page submitted a cash target of 10% with MSFT locked. Expanding the result CTA showed a prefilled numeric field. Changing it to 15% and submitting produced the new scoped calculation, retained all MSFT locks and returned a public-demo source link. This is a real browser/API round trip, not a static mock. An obsolete tool description initially discouraged locked-position calculation in an English reply; the description and renderer method text were corrected. The resulting live Traditional Chinese reply explicitly corrected the earlier capability statement.

An additional deployment-mode bug was found in local preview: static build-time environment detection could route the web client to the local-only API. The mobile page now reads its public/mock mode at request time. The public-demo calculation provenance is inherited from its input snapshot instead of mislabelling it as local Supabase.

Post-expiry reload exposed a local-history hydration dependency on an active API session. Saved public-demo JSON now restores without a network/model connection; the browser-history test explicitly makes fetch fail.

Known content failure: in the mobile cash-target reply, the model claimed MSFT total-portfolio weight rises despite unchanged MSFT value and unchanged portfolio total. That claim is false (its share of the remaining equity sleeve may rise). The deterministic allocation rows are correct; prose semantic validation is not yet complete. Treat this alpha as review-only, not financially accepted for production.
