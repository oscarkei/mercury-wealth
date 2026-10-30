"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useState } from "react";
import { Landmark, Layers3, ChevronRight } from "lucide-react";
import { TouchSheet, ChoiceRow } from "./touch-sheet";
import {
  family,
  scopedHoldings,
  summarize,
  type FamilyHolding,
  type FamilyScope,
} from "../lib/family-portfolio";
import { Button } from "./ui/button";
export default function PortfolioScope({
  rows,
  scope,
  onChange,
  money,
  currency,
}: {
  rows: FamilyHolding[];
  scope: FamilyScope;
  onChange: (scope: FamilyScope) => void;
  money: (n: number, compact?: boolean) => string;
  currency: string;
}) {
 useAppPreferences();

  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(scope);
  const books = family.books.filter(
    (b) => draft.bank === "all" || b.bank === draft.bank,
  );
  const selected = scopedHoldings(rows, draft),
    bookName =
      family.books.find((b) => b.id === scope.book)?.name || "All books";
  return (
    <>
      <button
        className="scope-launch"
        aria-label={localize("Choose custodians and books")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(scope);
          setOpen(true);
        }}
      >
        <span className="scope-launch-icon">
          <Landmark size={21} />
        </span>
        <span>
          <small>{localize("VIEWING")}</small>
          <strong>
            {localize(scope.bank === "all" ? "All custodians" : scope.bank)}
          </strong>
          <em>
            {localize(bookName)} · {localize(scopedHoldings(rows, scope).length)}{localize("positions")}</em>
        </span>
        <ChevronRight size={22} />
      </button>
      <TouchSheet
        title={localize("Custodians & books")}
        description="Choose the accounts included in your view."
        open={open}
        onOpenChange={setOpen}
        footer={
          <>
            <div className="scope-preview" aria-live="polite">
              <span>{localize(selected.length)}{localize("positions")}</span>
              <strong>
                {localize(money(summarize(selected).value, true))}{localize(" ")}
                <small>{localize(currency)}</small>
              </strong>
            </div>
            <div className="touch-footer-actions">
              <Button
                variant="outline"
                onClick={() => setDraft({ bank: "all", book: "all" })}
              >{localize("Reset")}</Button>
              <Button
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >{localize("Show portfolio")}</Button>
            </div>
          </>
        }
      >
        <h3 className="touch-section-label">{localize("Custodian")}</h3>
        <div className="touch-choice-group">
          <ChoiceRow
            title={localize("All custodians")}
            detail="Combined family view"
            amount={money(summarize(rows).value, true)}
            selected={draft.bank === "all"}
            onClick={() => setDraft({ bank: "all", book: "all" })}
            icon={<Landmark size={20} />}
          />
          {localize([...new Set(rows.map((h) => h.bank))].map((bank) => (
            <ChoiceRow
              key={bank}
              title={localize(bank)}
              detail={rows.find((h) => h.bank === bank)?.account}
              amount={money(
                summarize(rows.filter((h) => h.bank === bank)).value,
                true,
              )}
              selected={draft.bank === bank}
              icon={<Landmark size={20} />}
              onClick={() =>
                setDraft({
                  bank,
                  book: family.books.some(
                    (b) => b.id === draft.book && b.bank === bank,
                  )
                    ? draft.book
                    : "all",
                })
              }
            />
          )))}
        </div>
        <h3 className="touch-section-label">{localize("Investment book")}</h3>
        <div className="touch-choice-group">
          <ChoiceRow
            title={localize("All books")}
            detail={
              draft.bank === "all"
                ? "Across both custodians"
                : "At " + draft.bank
            }
            selected={draft.book === "all"}
            onClick={() => setDraft({ ...draft, book: "all" })}
            icon={<Layers3 size={20} />}
          />
          {localize(books.map((book) => (
            <ChoiceRow
              key={book.id}
              title={localize(book.name)}
              detail={book.bank + " · " + book.mandate}
              amount={money(
                summarize(rows.filter((h) => h.bookId === book.id)).value,
                true,
              )}
              selected={draft.book === book.id}
              icon={<Layers3 size={20} />}
              onClick={() => setDraft({ ...draft, book: book.id })}
            />
          )))}
        </div>
      </TouchSheet>
    </>
  );
}
