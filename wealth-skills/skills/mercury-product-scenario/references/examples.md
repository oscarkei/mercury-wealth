# Product and scenario examples

## "My note falls 40%"

If the question's subject remains unresolved, ask: "Do you mean the note's market price falls 40%, or its underlying falls 40%?" Do not ask if prior turns already establish an underlying shock. Then resolve the selected note and its actual terms.

If only a maturity engine is available, calculate supported maturity outcomes and say that a current sale value is not computed. Do not present maturity proceeds as today's mark.

## Final-only barrier

For fixture `note_final`, initial price 100, strike 100, final-only barrier 60 and principal USD 50,000, a terminal underlying level of 60 redeems principal under the fixture's `at_or_above` rule. A terminal level of 50 redeems USD 25,000 under its stated below-barrier formula. These are synthetic test terms, not a market-standard product. The fixture's coupon is zero; do not invent coupon income.

## A path-dependent request

An autocallable with an earlier observed call event has terminated according to that contract. Do not evaluate it as still outstanding at maturity. Require actual observation/path inputs when the model needs them.

## Portfolio shock

"Technology equities down 20%" must specify which holdings are covered and how sector exposures are obtained. Use fund constituents if available without double counting. Price a linked note separately or report its valuation as unsupported. Show the covered calculation and unresolved positions together.
