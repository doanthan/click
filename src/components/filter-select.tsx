"use client";

import { useEffect, useId, useRef, useState } from "react";

export type FilterSelectOption = {
  value: string;
  label: string;
};

// Brand-styled replacement for a native <select>. The native control renders
// its open menu with OS chrome (the dark list that clashes with the champagne
// palette), so we own the popover entirely: trigger + panel both use brand
// tokens, with click-outside, Escape, and arrow-key navigation wired up.
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLabel =
    selectedIndex >= 0 ? options[selectedIndex].label : placeholder ?? "Select…";

  // Close on outside click so the popover behaves like a real menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // When opening, focus the currently-selected row so keyboard nav starts there.
  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 text-left text-sm font-bold text-[color:var(--ink)] outline-none transition-colors hover:border-[color:var(--rose)] focus-visible:border-[color:var(--rose)] focus-visible:ring-2 focus-visible:ring-[color:var(--rose)]/30 data-[open=true]:border-[color:var(--rose)]"
        data-open={open}
      >
        <span className="truncate normal-case tracking-normal">{selectedLabel}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`h-4 w-4 shrink-0 text-[color:var(--mauve)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M5.5 7.5 10 12l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--cream)] p-1.5 shadow-xl shadow-[color:var(--ink)]/10 [scrollbar-width:thin]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(index)}
                  onPointerMove={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-[color:var(--rose)] text-[color:var(--on-deep)]"
                      : isSelected
                        ? "bg-[color:var(--peach)] text-[color:var(--ink)]"
                        : "text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden
                      className="h-4 w-4 shrink-0"
                    >
                      <path
                        d="m5 10.5 3.5 3.5L15 6.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
