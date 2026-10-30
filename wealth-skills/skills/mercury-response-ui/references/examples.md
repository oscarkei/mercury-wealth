# Response and UI examples

## Exposure answer

Primary intent: exposure summary; data ref: verified exposure result.

"Your measured NVDA equity exposure is {{exposure.known_weight}}. The fund allocation increases it beyond the direct position. Your linked note should be assessed separately because its payoff is nonlinear."

Keep constituent-date and coverage details expandable unless they materially limit the result. Offer a supported shock scenario, rather than promising an unavailable pricing model.

## Why answer

Keep the comparison chart already displayed. Add a concise dated-events interpretation using references; do not create a second chart just to fill space. Distinguish reported developments from their possible stock-price transmission.

## Scenario answer

"Under your {{scenario.shock}} underlying assumption at {{scenario.horizon}}, the modeled maturity redemption is {{scenario.redemption}}. That result follows the contract's final-observation condition; it is not a current sale quote."

The numerical/date tokens above are server-bound references, not permission to fabricate a binding. Include a payoff panel only if the runtime advertises one with a compatible result schema.

## Partial failure

If prices succeeded and financial facts failed: show the valid price comparison and the specific missing company evidence. Do not claim the company explanation completed. Store the valid result so a retry can resume at the failed stage.
