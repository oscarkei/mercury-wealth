"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import WealthDecision from "./wealth-decision";
import heldFCN from "../lib/held-fcn-data.json";
import { useState } from "react";
import { ArrowUpRight, SlidersHorizontal, ArrowRight } from "lucide-react";
import { family, type FamilyHolding } from "../lib/family-portfolio";
import {
  products,
  evaluateProduct,
  scenarioPaths,
  type ProductId,
} from "../lib/structured-products";
export default function ProductCatalog({
  simulate,
  accumulate,
  terms,
  held,
  scope,
}: {
  held: FamilyHolding[];
  scope: import("../lib/family-portfolio").FamilyScope;
  simulate: (id: ProductId) => void;
  accumulate: () => void;
  terms: (id: ProductId) => void;
}) {
 useAppPreferences();

  const [selectedId,setSelectedId]=useState(held[0]?.id||"");
  const selected=held.find(h=>h.id===selectedId)||held[0];
  const [tab, setTab] = useState("held");
  const [expanded, setExpanded] = useState(false);
  const a = family.accumulator;
  return (
    <>
      <div className="studio-toolbar">
        <div className="segmented">
          <button aria-pressed={tab === "held"} onClick={() => setTab("held")}>{localize("Held ·")}{localize(held.length)}
          </button>
          <button
            aria-pressed={tab === "library"}
            onClick={() => setTab("library")}
          >{localize("Explore · 3")}</button>
        </div>
        <button className="simulator-launch" onClick={accumulate}>
          <SlidersHorizontal size={17} />{localize("Simulator")}<ArrowUpRight size={15} />
        </button>
      </div>
      {localize(tab==="held"&&<div className="wealth-input"><label>{localize("Held product")}<select aria-label={localize("Held product")} value={selected?.id||""} onChange={e=>setSelectedId(e.target.value)}>{localize(!held.length&&<option value="">{localize("No held structured product in this scope")}</option>)}{localize(held.map(h=><option key={h.id} value={h.id}>{localize(h.name)} · {localize(h.bank)} · {localize(h.book)}</option>))}</select></label><p>{localize("Choose a held product to review its terms and scenario.")}</p></div>)}
      <div className="studio-cards">
        {localize(tab === "held" ? (selected?.instrumentId===heldFCN.instrument.id?<WealthDecision kind="fcn" scope={scope}/>:selected?.instrumentId!=="inst_sn_aq_aapl"?<section className="card"><h2>{localize(selected?.name||"No held product")}</h2><p>{localize("Verified product terms are unavailable for this selection. A valuation, coupon or payoff cannot be inferred from the position name.")}</p></section>:
(
          <article className="studio-card accumulator-card">
            <div className="product-card-heading">
              <span className="badge">{localize("Accumulator · Held")}</span>
              <small>{localize("CCB · USD")}</small>
            </div>
            <h2>{localize("AAPL Accumulator")}</h2>
            <div className="product-underlyings">
              <span>{localize("AAPL")}</span>
              <small>{localize("16 Feb 2027 · Thematic Equity · UBS")}</small>
            </div>
            <div className="product-return">
              <div>
                <small>{localize("Purchase strike")}</small>
                <strong>
                  {localize(a.strikePct)}
                  <em>%</em>
                </strong>
              </div>
              <div>
                <small>{localize("Expected return")}</small>
                <b>{localize("Path-dependent")}</b>
                <span>{localize("No fixed coupon")}</span>
              </div>
            </div>
            <div
              className="barrier-gauge"
              aria-label={localize("Strike 88%, knock-out 105% of initial price")}
            >
              <div className="barrier-track" />
              <i style={{ left: "42.5%" }}>
                88%<small>{localize("Strike")}</small>
              </i>
              <i style={{ left: "72.5%" }}>
                100%<small>{localize("Initial")}</small>
              </i>
              <i style={{ left: "85%" }}>
                105%<small>{localize("KO")}</small>
              </i>
            </div>
            <div className="barrier-metrics">
              <div>
                <small>{localize("Knock-in")}</small>
                <strong>{localize("None")}</strong>
              </div>
              <div>
                <small>{localize("Knock-out")}</small>
                <strong>105%</strong>
              </div>
              <div>
                <small>{localize("Below strike")}</small>
                <strong>{localize("2× shares")}</strong>
              </div>
            </div>
            <div className="product-card-actions">
              <button
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
              >{localize("View terms")}<ArrowRight size={15} />
              </button>
              <button onClick={accumulate}>{localize("Simulate")}<SlidersHorizontal size={15} />
              </button>
            </div>
            {localize(expanded && (
              <div className="inline-terms">
                <div>
                  <span>{localize("Initial fixing")}</span>
                  <b>{localize("USD")}{localize(a.initialFixing.toFixed(2))}</b>
                </div>
                <div>
                  <span>{localize("Daily shares")}</span>
                  <b>
                    {localize(a.accumSharesPerDay)} /{localize(" ")}
                    {localize(a.accumSharesPerDay * a.accumGearing)}{localize("below strike")}</b>
                </div>
                <div>
                  <span>{localize("Settlement")}</span>
                  <b>{localize("Physical · monthly")}</b>
                </div>
                <div>
                  <span>{localize("Guaranteed periods")}</span>
                  <b>{localize(a.accumGuaranteedPeriods)}{localize("(source terms)")}</b>
                </div>
                <p>{localize("2× gearing increases purchase obligations below strike. Seed terms do not fully specify guarantee / KO precedence.")}</p>
              </div>
            ))}
          </article>
        )) : (
          products.map((p) => {
            const result = evaluateProduct(p.id, scenarioPaths.base);
            return (
              <article key={p.id} className="studio-card">
                <div className="product-card-heading">
                  <span className="badge">{localize("Example · Not held")}</span>
                  <small>{localize(p.issuer)}{localize("· USD")}</small>
                </div>
                <h2>{localize(p.name)}</h2>
                <div className="product-underlyings">
                  {localize(p.underlyings.map((u) => (
                    <span key={u}>{localize(u)}</span>
                  )))}
                </div>
                <div className="product-return">
                  <div>
                    <small>{localize("Coupon p.a.")}</small>
                    <strong>
                      {localize(p.annualCoupon)}
                      <em>%</em>
                    </strong>
                  </div>
                  <div>
                    <small>{localize("Base-case net return")}</small>
                    <b>
                      +{localize(((result.net / result.principal) * 100).toFixed(1))}%
                    </b>
                    <span>{localize("6-month scenario")}</span>
                  </div>
                </div>
                <div className="barrier-metrics">
                  <div>
                    <small>
                      {localize(p.id === "phoenix" ? "Final barrier" : "Strike")}
                    </small>
                    <strong>{localize(p.protectionBarrier)}%</strong>
                  </div>
                  <div>
                    <small>{localize("Knock-in")}</small>
                    <strong>{localize(p.id === "phoenix" ? "60% final" : "None")}</strong>
                  </div>
                  <div>
                    <small>{localize("KO / autocall")}</small>
                    <strong>
                      {localize(p.autocallLevel ? p.autocallLevel + "%" : "None")}
                    </strong>
                  </div>
                </div>
                <div className="product-card-actions">
                  <button onClick={() => terms(p.id)}>{localize("View terms")}<ArrowRight size={15} />
                  </button>
                  <button onClick={() => simulate(p.id)}>{localize("Simulate")}<SlidersHorizontal size={15} />
                  </button>
                </div>
                <small className="product-card-note">{localize("Illustrative outcome, not an expected-return forecast.")}</small>
              </article>
            );
          })
        ))}
      </div>
      <p className="chart-caption">{localize("Demo terms · Capital at risk · Levels shown as % of initial price.")}</p>
    </>
  );
}
