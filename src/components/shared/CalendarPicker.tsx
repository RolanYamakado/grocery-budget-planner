import { useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

interface CalendarPickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
}

export function CalendarPicker({ value, onChange, minDate }: CalendarPickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(value ?? new Date()));
  const floor = minDate ? startOfDay(minDate) : null;

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = startOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: addMonths(gridEnd, 0) }).slice(0, 42);
  // eachDayOfInterval above only gets to the start of the last week; extend to 42 cells (6 full weeks).
  while (days.length < 42) {
    days.push(new Date(days[days.length - 1].getTime() + 86400000));
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
          className="h-8 w-8 rounded-full text-stone-500 hover:bg-stone-100"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-stone-800">{format(visibleMonth, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          className="h-8 w-8 rounded-full text-stone-500 hover:bg-stone-100"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-stone-400">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const disabled = floor ? isBefore(day, floor) : false;
          const inMonth = isSameMonth(day, visibleMonth);
          const selected = value && isSameDay(day, value);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(startOfDay(day))}
              className={`h-9 rounded-full text-sm transition ${
                selected
                  ? 'bg-terracotta font-semibold text-white'
                  : disabled
                    ? 'text-stone-300'
                    : inMonth
                      ? 'text-stone-700 hover:bg-terracotta/10'
                      : 'text-stone-300 hover:bg-terracotta/10'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
