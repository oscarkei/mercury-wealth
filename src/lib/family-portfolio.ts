import data from "./okonkwo-data.json" with { type: "json" };
export type FamilyHolding = (typeof data.holdings)[number];
export type FamilyScope = { bank: string; book: string };
export const family = data;
export const assetNames: Record<string, string> = {
  equity: "Equities",
  bond: "Fixed income",
  cash: "Cash",
  note: "Structured products",
  alternative: "Alternatives",
};
export const assetColors: Record<string, string> = {
  equity: "var(--asset-equity)",
  bond: "var(--asset-bond)",
  cash: "var(--asset-cash)",
  note: "var(--asset-note)",
  alternative: "var(--asset-other)",
};
export function scopedHoldings(rows: FamilyHolding[], scope: FamilyScope) {
  return rows.filter(
    (h) =>
      (scope.bank === "all" || h.bank === scope.bank) &&
      (scope.book === "all" || h.bookId === scope.book),
  );
}
export function summarize(rows: FamilyHolding[]) {
  return {
    value: rows.reduce((s, h) => s + h.value, 0),
    cost: rows.reduce((s, h) => s + h.cost, 0),
  };
}
export function allocationFor(
  rows: FamilyHolding[],
  group: "asset" | "custodian" | "book" = "asset",
) {
  const total = summarize(rows).value;
  const groups = new Map<
    string,
    { id: string; name: string; value: number; color: string }
  >();
  rows.forEach((h) => {
    const id =
      group === "asset"
        ? h.category
        : group === "custodian"
          ? h.bank
          : h.bookId;
    const item = groups.get(id) || {
      id,
      name:
        group === "asset"
          ? assetNames[id]
          : group === "custodian"
            ? h.bank
            : h.book,
      value: 0,
      color: assetColors[id] || Object.values(assetColors)[groups.size % 5],
    };
    item.value += h.value;
    groups.set(id, item);
  });
  return [...groups.values()]
    .sort((a, b) => b.value - a.value)
    .map((r) => ({ ...r, percent: total ? (r.value / total) * 100 : 0 }));
}
