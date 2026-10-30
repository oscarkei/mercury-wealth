"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useEffect, useState } from "react";
import PortfolioScope from "./portfolio-scope";
import PortfolioOverview from "./portfolio-overview";
import HomeSummary from "./home-summary";
import { TouchSheet, ChoiceRow } from "./touch-sheet";
import { Button } from "./ui/button";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Wallet,
  Landmark,
  Layers3,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  family,
  assetNames,
  assetColors,
  scopedHoldings,
  summarize,
  allocationFor,
  type FamilyHolding,
  type FamilyScope,
} from "../lib/family-portfolio";
type Props = {
  view: "overview" | "portfolio";
  rows: FamilyHolding[];
  currency: string;
  money: (v: number, compact?: boolean) => string;
  scope: FamilyScope;
  setScope: (s: FamilyScope) => void;
  initialFilter: string;
  openHolding: (id: string) => void;
  openPortfolio: () => void;
  openProducts: () => void;
  onDiscuss: (context:string,question:string)=>void;
};
export default function FamilyWorkspace({
  view,
  rows,
  currency,
  money,
  scope,
  setScope,
  initialFilter,
  openHolding,
  openPortfolio,
  openProducts,
  onDiscuss,
}: Props) {
 useAppPreferences();

  const [portfolioTab, setPortfolioTab] = useState("overview");
  const [filter, setFilter] = useState(initialFilter),
    [search, setSearch] = useState(""),
    [owner, setOwner] = useState("all"),
    [sort, setSort] = useState("value"),
    [visibleCount, setVisibleCount] = useState(5),
    [filtersOpen, setFiltersOpen] = useState(false),
    [breakdown, setBreakdown] = useState<"asset" | "custodian" | "book">(
      "asset",
    );
  const [draftFilters, setDraftFilters] = useState({
    filter: "all",
    owner: "all",
    sort: "value",
  });
  const [inspectedAsset, setInspectedAsset] = useState<string | null>(null),
    [inspectedBook, setInspectedBook] = useState<string | null>(null);
  useEffect(() => setFilter(initialFilter), [initialFilter]);
  useEffect(() => {
    setOwner("all");
    setInspectedAsset(null);
    setInspectedBook(null);
  }, [scope.bank, scope.book]);
  useEffect(() => setInspectedAsset(null), [breakdown]);
  useEffect(
    () => setVisibleCount(5),
    [filter, search, owner, sort, scope.bank, scope.book],
  );
  const scoped = scopedHoldings(rows, scope),
    totals = summarize(scoped),
    all = summarize(rows),
    mix = allocationFor(scoped, breakdown);
  const books = family.books.filter(
    (b) => scope.bank === "all" || b.bank === scope.bank,
  );
  const filtered = scoped
    .filter(
      (h) =>
        (filter === "all" || filter === h.category) &&
        (owner === "all" || h.owners.includes(owner)) &&
        [h.name, h.fullName, h.owner, h.bank, h.book, h.account, h.sleeve]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "gain"
          ? b.value - b.cost - (a.value - a.cost)
          : sort === "value-asc"
            ? a.value - b.value
            : b.value - a.value,
    );
  const visible = filtered.slice(0, visibleCount);
  const inspected = mix.find((a) => a.id === inspectedAsset) || mix[0];
  const draftCount = scoped.filter(
    (h) =>
      (draftFilters.filter === "all" || h.category === draftFilters.filter) &&
      (draftFilters.owner === "all" || h.owners.includes(draftFilters.owner)) &&
      [h.name, h.fullName, h.owner, h.bank, h.book, h.account, h.sleeve]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  ).length;
  const barData = family.books
    .filter((b) => scope.book === "all" || b.id === scope.book)
    .filter((b) => scope.bank === "all" || b.bank === scope.bank)
    .map((b) => ({
      id: b.id,
      name: b.name.replace("Corporate ", "Corp. "),
      ...summarize(scoped.filter((h) => h.bookId === b.id)),
    }));
  const reset = () => {
    setFilter("all");
    setOwner("all");
    setSearch("");
    setScope({ bank: "all", book: "all" });
  };
  const activeCount =
    Number(filter !== "all") +
    Number(owner !== "all") +
    Number(scope.bank !== "all") +
    Number(scope.book !== "all");
  return (
    <div className="family-workspace">
      {view === 'portfolio' && <PortfolioScope rows={rows} scope={scope} onChange={setScope} money={money} currency={currency}/>}
      {localize(view === "portfolio" && (
        <div className="segmented portfolio-tabs" aria-label={localize("Portfolio view")}>
          {localize(["overview", "holdings", "custodians"].map((tab) => (
            <button
              key={tab}
              aria-pressed={portfolioTab === tab}
              onClick={() => setPortfolioTab(tab)}
            >
              {localize(tab === "holdings"
                ? "Holdings"
                : tab === "overview"
                  ? "Overview"
                  : "Accounts & Books")}
            </button>
          )))}
        </div>
      ))}
      {localize(view === "overview" && <HomeSummary rows={rows} scope={scope} setScope={setScope} currency={currency} money={money} onPortfolio={()=>{setFilter("all");setSearch("");setOwner("all");setPortfolioTab("overview");openPortfolio();}} onReview={(category,query="")=>{setFilter(category);setSearch(query);setOwner("all");setPortfolioTab("holdings");openPortfolio();}} onProducts={openProducts} onDiscuss={onDiscuss}/>)}
      {view==='portfolio'&&portfolioTab==='overview'&&<PortfolioOverview rows={scoped} scope={scope} money={money} currency={currency} onHoldings={category=>{setFilter(category||'all');setPortfolioTab('holdings');}}/>}
      {localize((view === "portfolio" && portfolioTab === "custodians") && (
        <section className="card family-books">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{localize("ONE FAMILY. CONNECTED.")}</div>
              <h2>{localize("Custodians & books")}</h2>
            </div>
            <span className="subcount">2 / 3</span>
          </div>
          <div className="custodian-grid">
            {localize([...new Set(rows.map((h) => h.bank))].map((bank) => {
              const items = rows.filter((h) => h.bank === bank),
                sum = summarize(items);
              return (
                <div
                  key={bank}
                  className={
                    "custodian-card " + (scope.bank === bank ? "active" : "")
                  }
                >
                  <button
                    className="custodian-heading"
                    onClick={() =>
                      setScope({
                        bank: scope.bank === bank ? "all" : bank,
                        book: "all",
                      })
                    }
                    aria-pressed={scope.bank === bank}
                  >
                    <span className="bank-monogram">
                      {localize(bank === "UBS" ? "UB" : "JB")}
                    </span>
                    <span>
                      <strong>{localize(bank)}</strong>
                      <small>{localize(items[0].account)}</small>
                    </span>
                    <b>{localize(money(sum.value, true))}</b>
                  </button>
                  <div className="custodian-weight">
                    <i style={{ width: (sum.value / all.value) * 100 + "%" }} />
                  </div>
                  {localize(family.books
                    .filter((b) => b.bank === bank)
                    .map((b) => (
                      <button
                        className="book-row"
                        key={b.id}
                        aria-pressed={scope.book === b.id}
                        onClick={() =>
                          setScope({
                            bank,
                            book: scope.book === b.id ? "all" : b.id,
                          })
                        }
                      >
                        <span>
                          <strong>{localize(b.name)}</strong>
                          <small>
                            {localize(b.mandate)} ·{localize(" ")}
                            {localize(rows.filter((h) => h.bookId === b.id).length)}{localize(" ")}{localize("positions")}</small>
                        </span>
                        <span>
                          {localize(money(
                            summarize(rows.filter((h) => h.bookId === b.id))
                              .value,
                            true,
                          ))}
                          <ArrowUpRight size={13} />
                        </span>
                      </button>
                    )))}
                </div>
              );
            }))}
          </div>
        </section>
      ))}
      {localize((view === "portfolio" && portfolioTab === "allocation") && (
        <div className="family-charts">
          <section className="card family-allocation">
            <div className="section-heading">
              <h2>{localize("Allocation breakdown")}</h2>
            </div>
            <div className="segmented" aria-label={localize("Allocation grouping")}>
              {localize((["asset", "custodian", "book"] as const).map((g) => (
                <button
                  key={g}
                  aria-pressed={breakdown === g}
                  onClick={() => setBreakdown(g)}
                >
                  {localize(g === "asset"
                    ? "Asset class"
                    : g === "custodian"
                      ? "Custodian"
                      : "Book")}
                </button>
              )))}
            </div>
            <div
              className="family-pie"
              role="img"
              aria-label={localize(mix
                .map((a) => `${a.name} ${a.percent.toFixed(1)}%`)
                .join(", "))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={0}
                    outerRadius="94%"
                    stroke="#fafbf7"
                    strokeWidth={4}
                    isAnimationActive={false}
                    onClick={(_, i) => setInspectedAsset(mix[i].id)}
                  >
                    {localize(mix.map((a) => (
                      <Cell key={a.id} fill={a.color} />
                    )))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {localize(inspected && (
              <div className="allocation-inspection" aria-live="polite">
                <div>
                  <small>
                    {localize(inspected.name)} · {localize(inspected.percent.toFixed(1))}%
                  </small>
                  <strong>
                    {localize(money(inspected.value))} <em>{localize(currency)}</em>
                  </strong>
                </div>
                <button
                  onClick={() => {
                    if (breakdown === "asset") setFilter(inspected.id);
                    else if (breakdown === "custodian")
                      setScope({ bank: inspected.id, book: "all" });
                    else setScope({ ...scope, book: inspected.id });
                    setPortfolioTab("holdings");
                    openPortfolio();
                  }}
                >{localize("View holdings")}<ArrowUpRight size={17} />
                </button>
              </div>
            ))}
            <div className="family-legend">
              {localize(mix.map((a) => (
                <button
                  key={a.id}
                  aria-pressed={inspected?.id === a.id}
                  onClick={() => setInspectedAsset(a.id)}
                >
                  <i style={{ background: a.color }} />
                  <span>{localize(a.name)}</span>
                  <b>{localize(a.percent.toFixed(1))}%</b>
                  <small>{localize(money(a.value, true))}</small>
                </button>
              )))}
            </div>
          </section>
          <section className="card family-value-chart">
            <div className="section-heading">
              <div>
                <div className="eyebrow">{localize("ACCUMULATED HOLDINGS")}</div>
                <h2>{localize("Cost & market value")}</h2>
              </div>
              <span className="badge">{localize(currency)}</span>
            </div>
            <div className="value-chart-key">
              <span>
                <i />{localize("Book cost")}</span>
              <span>
                <i />{localize("Market value")}</span>
            </div>
            <div
              className="family-bars"
              role="img"
              aria-label={localize(`Book cost ${money(totals.cost)}; market value ${money(totals.value)}`)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ left: 0, right: 4, bottom: 0, top: 12 }}
                >
                  <CartesianGrid vertical={false} stroke="#e9ece5" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#6c796f" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    width={48}
                    tickFormatter={(v) => money(v, true)}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    onClick={(_entry, index) =>
                      setInspectedBook(barData[index]?.id || null)
                    }
                    dataKey="cost"
                    fill="#d4c7a4"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    onClick={(_entry, index) =>
                      setInspectedBook(barData[index]?.id || null)
                    }
                    dataKey="value"
                    fill="#245748"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div
              className="book-chart-choices"
              aria-label={localize("Inspect book values")}
            >
              {localize(barData.map((b) => (
                <button
                  key={b.id}
                  aria-pressed={(inspectedBook || barData[0]?.id) === b.id}
                  onClick={() => setInspectedBook(b.id)}
                >
                  {localize(b.name)}
                </button>
              )))}
            </div>
            {localize(barData
              .filter((b) => b.id === (inspectedBook || barData[0]?.id))
              .map((b) => (
                <div className="value-summary" aria-live="polite" key={b.id}>
                  <div>
                    <small>{localize("Book cost ·")}{localize(currency)}</small>
                    <strong>{localize(money(b.cost))}</strong>
                  </div>
                  <div>
                    <small>{localize("Market value ·")}{localize(currency)}</small>
                    <strong>{localize(money(b.value))}</strong>
                  </div>
                </div>
              )))}
            <p className="chart-caption">{localize("Cost of current positions, not lifetime deposits. Historical NAV is not available.")}</p>
          </section>
        </div>
      ))}
      {localize((view === "portfolio" && portfolioTab === "holdings") && (
          <section className="card compact-holdings">
            <div className="section-heading">
              <div>
                <h2>{localize("Your holdings")}{localize(" ")}
                  <span className="subcount">{localize(filtered.length)}</span>
                </h2>
                <small>
                  {localize(money(summarize(filtered).value))} · {localize(currency)}{localize("equivalent")}</small>
              </div>
              <button
                className="filter-toggle"
                aria-expanded={filtersOpen}
                onClick={() => {
                  setDraftFilters({ filter, owner, sort });
                  setFiltersOpen(true);
                }}
              >
                <SlidersHorizontal size={16} />{localize("Filters")}{localize(activeCount > 0 && <b>{localize(activeCount)}</b>)}
              </button>
            </div>
            <div className="compact-search">
              <Search size={17} />
              <input
                aria-label={localize("Search holdings")}
                placeholder={localize("Search asset, book or custodian")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {localize(search && (
                <button aria-label={localize("Clear search")} onClick={() => setSearch("")}>
                  <X size={15} />
                </button>
              ))}
            </div>
            {localize(activeCount > 0 && (
              <div className="active-filters">
                <span>{localize(filtered.length)}{localize("matching positions")}</span>
                <button onClick={reset}>{localize("Clear all")}<X size={12} />
                </button>
              </div>
            ))}
            <div className="compact-holding-list">
              {localize(visible.map((h) => (
                <button
                  className="compact-holding"
                  key={h.id}
                  onClick={() => openHolding(h.id)}
                >
                  <i
                    style={{
                      background: `color-mix(in srgb, ${assetColors[h.category]} 12%, transparent)`,
                      color: assetColors[h.category],
                    }}
                  >
                    {localize(h.category === "equity"
                      ? "EQ"
                      : h.category === "bond"
                        ? "FI"
                        : h.category === "cash"
                          ? "CA"
                          : h.category === "note"
                            ? "SP"
                            : "AL")}
                  </i>
                  <span>
                    <strong>{localize(h.name)}</strong>
                    <small>
                      {localize(h.bank)} · {localize(h.book)}
                    </small>
                  </span>
                  <span>
                    <strong>{localize(money(h.value, true))}</strong><small className={h.value>=h.cost?'positive':'negative'}>{h.value>=h.cost?'+':''}{money(h.value-h.cost,true)} · {localize('Unrealised P&L')}</small>
                    <small>
                      {localize(((h.value / (totals.value || 1)) * 100).toFixed(1))}% ·{localize(" ")}
                      {localize(h.currency)}
                    </small>
                  </span>
                </button>
              )))}
            </div>
            {localize(!filtered.length && (
              <div className="empty">
                <Search />
                <h3>{localize("No matching holdings")}</h3>
                <button className="secondary" onClick={reset}>{localize("Clear filters")}</button>
              </div>
            ))}
            <div className="holdings-load-more">
              <span aria-live="polite">{localize("Showing")}{localize(visible.length)}{localize("of")}{localize(filtered.length)}{localize("positions")}</span>
              {localize(visible.length < filtered.length && (
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((n) => n + 5)}
                >{localize("Show")}{localize(Math.min(5, filtered.length - visible.length))}{localize("more holdings")}</Button>
              ))}
              {localize(visible.length === filtered.length && filtered.length > 0 && (
                <span className="list-complete">{localize("All matching holdings shown")}</span>
              ))}
            </div>
          </section>
      ))}
      <TouchSheet
        title={localize("Filter holdings")}
        description="Narrow your list. Your account selection stays the same."
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        footer={
          <div className="touch-footer-actions">
            <Button
              variant="outline"
              onClick={() =>
                setDraftFilters({ filter: "all", owner: "all", sort: "value" })
              }
            >{localize("Reset")}</Button>
            <Button
              onClick={() => {
                setFilter(draftFilters.filter);
                setOwner(draftFilters.owner);
                setSort(draftFilters.sort);
                setFiltersOpen(false);
              }}
            >{localize("Show")}{localize(draftCount)}{localize("holdings")}</Button>
          </div>
        }
      >
        <h3 className="touch-section-label">{localize("Asset class")}</h3>
        <div className="touch-filter-grid">
          {localize(["all", ...Object.keys(assetNames)].map((f) => (
            <Button
              key={f}
              variant="outline"
              aria-pressed={draftFilters.filter === f}
              onClick={() => setDraftFilters({ ...draftFilters, filter: f })}
            >
              {localize(f === "all" ? "All assets" : assetNames[f])}
            </Button>
          )))}
        </div>
        <h3 className="touch-section-label">{localize("Owner")}</h3>
        <div className="touch-choice-group">
          {localize(["all", ...new Set(scoped.flatMap((h) => h.owners))].map((o) => (
            <ChoiceRow
              key={o}
              title={localize(o === "all" ? "All owners" : o)}
              selected={draftFilters.owner === o}
              onClick={() => setDraftFilters({ ...draftFilters, owner: o })}
            />
          )))}
        </div>
        <h3 className="touch-section-label">{localize("Sort by")}</h3>
        <div className="touch-choice-group">
          {localize([
            ["value", "Largest value"],
            ["value-asc", "Smallest value"],
            ["name", "Name A–Z"],
            ["gain", "Unrealised gain"],
          ].map(([value, label]) => (
            <ChoiceRow
              key={value}
              title={localize(label)}
              selected={draftFilters.sort === value}
              onClick={() => setDraftFilters({ ...draftFilters, sort: value })}
            />
          )))}
        </div>
      </TouchSheet>
    </div>
  );
}
