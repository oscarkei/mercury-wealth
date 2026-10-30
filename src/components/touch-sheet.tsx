"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";

let pendingSheetBack: Promise<void> | null = null;

/** Thumb-sized choices in the viewport, including transformed phone previews. */
export function TouchSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
 useAppPreferences();

  const id = useId(),
    closeRef = useRef<HTMLButtonElement>(null),
    origin = useRef<HTMLElement | null>(null),
    change = useRef(onOpenChange);
  change.current = onOpenChange;
  useEffect(() => {
    if (!open) return;
    const token = id + Date.now();
    let cancelled = false,
      started = false;
    const back = () => {
      if (history.state?.mercurySheet !== token) change.current(false);
    };
    const activate = () => {
      if (cancelled) return;
      history.pushState(
        { ...history.state, mercurySheet: token },
        "",
        location.href,
      );
      window.addEventListener("popstate", back);
      started = true;
    };
    if (pendingSheetBack) void pendingSheetBack.then(activate);
    else activate();
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", back);
      if (started && history.state?.mercurySheet === token) {
        pendingSheetBack = new Promise<void>((resolve) => {
          window.addEventListener(
            "popstate",
            () => {
              pendingSheetBack = null;
              resolve();
            },
            { once: true },
          );
        });
        history.back();
      }
    };
  }, [open, id]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="touch-sheet"
        showCloseButton={false}
        aria-labelledby={id + "-title"}
        aria-describedby={id + "-description"}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => {
            if (origin.current?.isConnected)
              origin.current.focus({ preventScroll: true });
          });
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          origin.current = document.activeElement as HTMLElement;
          closeRef.current?.focus({ preventScroll: true });
        }}
      >
        <header className="touch-sheet-header">
          <div>
            <SheetTitle id={id + "-title"}>{localize(title)}</SheetTitle>
            <SheetDescription id={id + "-description"}>
              {localize(description)}
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            className="touch-close"
            ref={closeRef}
            aria-label={localize("Close " + title)}
            onClick={() => onOpenChange(false)}
          >
            <X size={22} />
          </Button>
        </header>
        <div className="touch-sheet-body">{localize(children)}</div>
        {localize(footer && <footer className="touch-sheet-footer">{localize(footer)}</footer>)}
      </SheetContent>
    </Sheet>
  );
}
export function ChoiceRow({
  selected,
  onClick,
  title,
  detail,
  amount,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail?: string;
  amount?: string;
  icon?: ReactNode;
}) {
 useAppPreferences();

  return (
    <button
      type="button"
      className="touch-choice"
      aria-pressed={selected}
      onClick={onClick}
    >
      {localize(icon && <span className="touch-choice-icon">{localize(icon)}</span>)}
      <span className="touch-choice-copy">
        <strong>{localize(title)}</strong>
        {localize(detail && <small>{localize(detail)}</small>)}
      </span>
      {localize(amount && <b>{localize(amount)}</b>)}
      <span className="touch-radio" aria-hidden="true">
        {localize(selected && <Check size={15} />)}
      </span>
    </button>
  );
}
export function TouchPicker({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: { value: string; label: string; detail?: string }[];
  onChange: (value: string) => void;
}) {
 useAppPreferences();

  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="touch-picker"
        aria-label={localize(title)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          <small>{localize(title)}</small>
          <strong>{localize(options.find((o) => o.value === value)?.label)}</strong>
        </span>
        <ChevronRight size={20} />
      </button>
      <TouchSheet
        title={localize(title)}
        description="Tap an option to select it."
        open={open}
        onOpenChange={setOpen}
      >
        <div className="touch-choice-group">
          {localize(options.map((o) => (
            <ChoiceRow
              key={o.value}
              title={localize(o.label)}
              detail={o.detail}
              selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          )))}
        </div>
      </TouchSheet>
    </>
  );
}
