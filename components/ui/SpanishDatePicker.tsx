"use client";

import { useEffect, useRef, useState } from "react";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const WEEKDAY_LABELS = [
  "Lu",
  "Ma",
  "Mi",
  "Ju",
  "Vi",
  "Sá",
  "Do",
];

type SpanishDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  minYear?: number;
  maxYear?: number;
  theme?: "light" | "dark";
};

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map((part) => Number(part));

  return { year, month: month - 1, day };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default function SpanishDatePicker({
  value,
  onChange,
  required,
  className,
  minYear,
  maxYear,
  theme = "light",
}: SpanishDatePickerProps) {
  const isDark = theme === "dark";
  const today = new Date();
  const parsed = parseIsoDate(value);

  const [isOpen, setIsOpen] = useState(false);

  const [viewYear, setViewYear] = useState(
    parsed?.year ?? today.getFullYear(),
  );

  const [viewMonth, setViewMonth] = useState(
    parsed?.month ?? today.getMonth(),
  );

  const containerRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    const parsedValue = parseIsoDate(value);

    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }

    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
  }, [isOpen]);

  const yearRangeEnd = maxYear ?? today.getFullYear();
  const yearRangeStart = minYear ?? yearRangeEnd - 100;

  const years: number[] = [];

  for (let year = yearRangeEnd; year >= yearRangeStart; year -= 1) {
    years.push(year);
  }

  const daysInMonth = new Date(
    viewYear,
    viewMonth + 1,
    0,
  ).getDate();

  const firstWeekday =
    (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const leadingBlanks = Array.from(
    { length: firstWeekday },
    (_, index) => index,
  );

  const days = Array.from(
    { length: daysInMonth },
    (_, index) => index + 1,
  );

  const displayValue = parsed
    ? `${pad(parsed.day)}/${pad(parsed.month + 1)}/${parsed.year}`
    : "";

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  }

  function selectDay(day: number) {
    onChange(toIsoDate(viewYear, viewMonth, day));
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        readOnly
        required={required}
        value={displayValue}
        onClick={() =>
          isOpen ? setIsOpen(false) : openPicker()
        }
        placeholder="DD/MM/AAAA"
        className={
          className ??
          (isDark
            ? "w-full cursor-pointer rounded-xl border border-white/10 bg-[#08080a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-400"
            : "w-full cursor-pointer rounded-xl border border-[#dfcbd2] bg-[#fffdfb] px-4 py-4 outline-none transition focus:border-[#c65f7c]")
        }
      />

      {isOpen && (
        <div
          className={`absolute z-30 mt-2 w-[300px] rounded-xl border p-4 shadow-xl ${
            isDark
              ? "border-white/10 bg-[#1a1a1f]"
              : "border-[#dfcbd2] bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className={`rounded-lg border px-2 py-1 text-sm font-bold transition ${
                isDark
                  ? "border-white/15 text-white hover:bg-white/10"
                  : "border-[#dfcbd2] text-[#4b2438] hover:bg-[#f7f1ec]"
              }`}
              aria-label="Mes anterior"
            >
              ‹
            </button>

            <div className="flex flex-1 gap-2">
              <select
                value={viewMonth}
                onChange={(event) =>
                  setViewMonth(Number(event.target.value))
                }
                className={`flex-1 rounded-lg border px-2 py-1 text-sm outline-none ${
                  isDark
                    ? "border-white/15 bg-[#1a1a1f] text-white"
                    : "border-[#dfcbd2] bg-white text-[#4b2438]"
                }`}
              >
                {MONTH_NAMES.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(event) =>
                  setViewYear(Number(event.target.value))
                }
                className={`rounded-lg border px-2 py-1 text-sm outline-none ${
                  isDark
                    ? "border-white/15 bg-[#1a1a1f] text-white"
                    : "border-[#dfcbd2] bg-white text-[#4b2438]"
                }`}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className={`rounded-lg border px-2 py-1 text-sm font-bold transition ${
                isDark
                  ? "border-white/15 text-white hover:bg-white/10"
                  : "border-[#dfcbd2] text-[#4b2438] hover:bg-[#f7f1ec]"
              }`}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div
            className={`mt-3 grid grid-cols-7 gap-1 text-center text-xs font-bold ${
              isDark ? "text-pink-300" : "text-[#8f425a]"
            }`}
          >
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {leadingBlanks.map((blank) => (
              <span key={`blank-${blank}`} />
            ))}

            {days.map((day) => {
              const isSelected =
                parsed?.year === viewYear &&
                parsed?.month === viewMonth &&
                parsed?.day === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`rounded-lg py-1.5 text-sm transition ${
                    isSelected
                      ? "bg-[#c65f7c] font-bold text-white"
                      : isDark
                        ? "text-white/80 hover:bg-white/10"
                        : "text-[#4b2438] hover:bg-[#f7f1ec]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
