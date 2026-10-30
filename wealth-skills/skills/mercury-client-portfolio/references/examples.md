# Client and portfolio examples

Use the independent fixtures in `evals/cases.json`; these examples are not assertions about the current Okonkwo dataset.

## Direct and fund exposure

User: "How much NVDA exposure do I have?"

Method: load scope/snapshot; calculate direct value; use verified fund constituents if available; keep note linkage separate. For fixture `base`, expected known equity exposure is USD 100,000 direct + USD 20,000 through TECHF = USD 120,000, or 12% of NAV. The USD 50,000 linked note is a separate linkage, not another USD 50,000 cash-equity exposure. Arithmetic must come from the calculation tool.

Response pattern: "Your measured NVDA equity exposure is {{exposure.known_weight}}. It comes from direct holdings and the fund's disclosed allocation. Your linked note adds a different, nonlinear risk; I would model that contract separately."

## Missing look-through

If constituents are unavailable: report direct exposure, show unresolved fund value, and explain that zero direct holdings does not establish zero underlying exposure. Do not imply that the missing tool has run.

## Changed benchmark

User: "Use MSCI World instead."

Preserve assets, scope and period. Replace the benchmark only, invalidate dependent comparisons, and calculate in the same currency/return convention. Do not alter the client's IPS or relabel this research choice as an assigned mandate benchmark.

## Topic return

After a product question, user: "Back to the three stocks—what about my portfolio?"

Restore the referenced three-stock topic, not just the most recent product. Apply its symbols to the selected scope; ask only if several older three-stock analyses are plausible.
