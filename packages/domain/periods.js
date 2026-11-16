/**
 * Weeks, months, and which of their days have actually happened.
 *
 * The date-key format lives in time.js; this file is the calendar model built on
 * top of it. Every read and write goes through `toDateKey`, so there is one
 * definition of what identifies a day.
 */

import {
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	addDays,
	subWeeks,
	addWeeks,
	subMonths,
	addMonths,
	isSameDay,
	isAfter,
	startOfDay,
	format,
} from 'date-fns';
import { toDateKey } from './time.js';

export const WEEK_STARTS_ON = 1; // Monday

/** Every day in [start, end] inclusive. */
export function eachDay(start, end) {
	const days = [];
	let cursor = startOfDay(start);
	const last = startOfDay(end);
	while (!isAfter(cursor, last)) {
		days.push(cursor);
		cursor = addDays(cursor, 1);
	}
	return days;
}

export function isFutureDay(date, now = new Date()) {
	return isAfter(startOfDay(date), startOfDay(now));
}

export function isToday(date, now = new Date()) {
	return isSameDay(date, now);
}

/**
 * The range currently in view. `unit` is "week" | "month".
 * `prevStart`/`prevEnd` is the equivalent preceding range, used for deltas.
 */
export function buildPeriod(anchor, unit, now = new Date()) {
	const isWeek = unit === 'week';
	const start = isWeek
		? startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON })
		: startOfMonth(anchor);
	const end = isWeek ? endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }) : endOfMonth(anchor);

	const prevAnchor = isWeek ? subWeeks(anchor, 1) : subMonths(anchor, 1);
	const prevStart = isWeek
		? startOfWeek(prevAnchor, { weekStartsOn: WEEK_STARTS_ON })
		: startOfMonth(prevAnchor);
	const prevEnd = isWeek
		? endOfWeek(prevAnchor, { weekStartsOn: WEEK_STARTS_ON })
		: endOfMonth(prevAnchor);

	const days = eachDay(start, end);
	// Days that have actually happened. A day in the future cannot be "missing".
	const elapsedDays = days.filter((d) => !isFutureDay(d, now));

	return {
		unit,
		anchor,
		start,
		end,
		days,
		elapsedDays,
		prevStart,
		prevEnd,
		isCurrent: !isFutureDay(start, now) && !isFutureDay(now, end),
	};
}

export function shiftPeriod(period, direction) {
	const step = direction > 0 ? 1 : -1;
	return period.unit === 'week' ? addWeeks(period.anchor, step) : addMonths(period.anchor, step);
}

/** "Aug 24 – 30, 2026", or "Aug 31 – Sep 6, 2026" when the week straddles a month. */
export function formatPeriodLabel(period) {
	if (period.unit === 'month') return format(period.start, 'MMMM yyyy');

	const sameMonth = period.start.getMonth() === period.end.getMonth();
	const sameYear = period.start.getFullYear() === period.end.getFullYear();

	if (sameMonth && sameYear) {
		return `${format(period.start, 'MMM d')} – ${format(period.end, 'd, yyyy')}`;
	}
	if (sameYear) {
		return `${format(period.start, 'MMM d')} – ${format(period.end, 'MMM d, yyyy')}`;
	}
	return `${format(period.start, 'MMM d, yyyy')} – ${format(period.end, 'MMM d, yyyy')}`;
}
