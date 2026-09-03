import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
} from 'date-fns';
import type { DayKey } from '../types';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export function toIsoDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** The plan's 7 actual calendar dates, starting at `weekStart` (any weekday). */
export function getPlanDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toIsoDateString(addDays(weekStart, i)));
}

/** Weekday label for an arbitrary ISO date — display only, not a storage key. */
export function getDayKeyForDate(isoDate: string): DayKey {
  const dow = parseISO(isoDate).getDay(); // 0=Sun..6=Sat
  return DAY_KEYS[(dow + 6) % 7]; // rotate so Monday is index 0, matching DAY_KEYS order
}

/** ISO year+week key, used to run the affinity decay pass at most once per real calendar week. */
export function getIsoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
}

export function getMonthKey(isoDateOrString: string | Date): string {
  const date = typeof isoDateOrString === 'string' ? parseISO(isoDateOrString) : isoDateOrString;
  return format(date, 'yyyy-MM');
}

/** Whole days between two ISO date strings (b - a). Used for the leftover lookback window. */
export function daysBetween(dateA: string, dateB: string): number {
  return differenceInCalendarDays(parseISO(dateB), parseISO(dateA));
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`;
}

export function formatDayLabel(isoDate: string): string {
  return format(parseISO(isoDate), 'EEE d MMM');
}

/** "dd/mm/yyyy - dd/mm/yyyy" range for a plan's week, given its ISO start date. */
export function formatWeekRangeDDMMYYYY(weekStartIso: string): string {
  const weekStart = parseISO(weekStartIso);
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`;
}
