"use client";

import { useId, useMemo, useState } from "react";

export type SearchOption = {
  value: string;
  label: string;
  searchText?: string;
};

export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedOption = options.find((option) => option.value === value);
  const matchingOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return options
      .filter((option) =>
        `${option.label} ${option.searchText ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 50);
  }, [options, query]);

  function selectOption(option: SearchOption) {
    onChange(option.value);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative">
      <span className="mb-2 block">{label}</span>
      <input
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && matchingOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={isOpen ? query : selectedOption?.label ?? ""}
        onFocus={() => {
          setQuery("");
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) => Math.min(index + 1, matchingOptions.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && isOpen) {
            event.preventDefault();
            if (matchingOptions[activeIndex]) {
              selectOption(matchingOptions[activeIndex]);
            }
          } else if (event.key === "Escape") {
            setIsOpen(false);
            setQuery("");
          }
        }}
        onBlur={() => setIsOpen(false)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
      />
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matchingOptions.length > 0 ? (
            matchingOptions.map((option, index) => (
              <li
                id={`${listId}-${index}`}
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex ? "bg-cyan-50 text-cyan-900" : "text-slate-700"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </li>
            ))
          ) : (
            <li role="status" className="px-3 py-2 text-sm text-slate-500">
              No matches found.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
