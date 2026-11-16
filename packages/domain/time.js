/**
 * Dates and times. No dependencies - this file is loaded as source by the check
 * scripts, so keep it import-free.
 *
 * THE DATE KEY IS `YYYY-MM-DD`.
 *
 * It used to be `"Wed, Aug 26"` - a display string with no year - and that single
 * choice caused most of the defects in this codebase:
 *
 *   - no query could express "this month", so every screen fetched every record
 *     a devotee had ever written
 *   - it could not be sorted; string-ordering "Fri, Apr 3" is meaningless
 *   - the same weekday-and-date recurs every 6 to 11 years, so a save could
 *     silently overwrite a different year
 *   - the web home page averaged every August from every year together
 *
 * An ISO date sorts lexicographically, filters by range, and identifies exactly
 * one day. It is also stable across locales, which the old format was not: it was
 * produced by `toLocaleDateString('en-US', …)` and would have changed shape on a
 * device set to another locale.
 */

/** The storage key for a day: "2026-08-26". */
export function toDateKey(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * A date key back to a Date, at local midnight.
 *
 * Newly possible. With no year in the key there was nothing to parse, which is
 * why the old code had to carry a separate `timestamp` field to have any anchor
 * at all.
 */
export function parseDateKey(key) {
	if (typeof key !== 'string') return null;
	const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const [, year, month, day] = match;
	const date = new Date(Number(year), Number(month) - 1, Number(day));
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Inclusive first and last key of a month, for a range query. */
export function monthKeyRange(date) {
	const year = date.getFullYear();
	const month = date.getMonth();
	const last = new Date(year, month + 1, 0).getDate();
	const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
	return { start: `${prefix}-01`, end: `${prefix}-${String(last).padStart(2, '0')}` };
}

/** Inclusive first and last key spanning two Dates, for a range query. */
export function keyRange(from, to) {
	return { start: toDateKey(from), end: toDateKey(to) };
}

/** Minutes since midnight from "22:30", "10:30 PM" or "4:15 am". null if unparseable. */
export function parseTimeToMinutes(raw) {
	if (raw === undefined || raw === null) return null;
	const text = String(raw).trim().toLowerCase();
	if (!text) return null;
	const match = text.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
	if (!match) return null;

	let hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	const period = match[3] ? match[3].toUpperCase() : null;

	if (period) {
		if (period === 'AM' && hours === 12) hours = 0;
		else if (period === 'PM' && hours < 12) hours += 12;
	}
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

/** 24-hour "HH:MM" - the stored form for every time field. */
export function minutesToWireTime(totalMinutes) {
	const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
	const h = Math.floor(m / 60);
	return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "h:mm AM/PM" for display only. Never stored. */
export function minutesToDisplayTime(totalMinutes) {
	const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
	let h = Math.floor(m / 60);
	const mins = m % 60;
	const period = h >= 12 ? 'PM' : 'AM';
	h = h % 12 || 12;
	return `${h}:${mins < 10 ? '0' : ''}${mins} ${period}`;
}

/**
 * Signed shortest distance from one time to another on a 24h circle, in
 * [-720, 720]. 11:55 PM to 12:05 AM is +10, not +1450. Plain subtraction reports
 * nonsense across midnight.
 */
export function circularDeltaMinutes(fromMinutes, toMinutes) {
	let diff = (toMinutes - fromMinutes) % 1440;
	if (diff > 720) diff -= 1440;
	if (diff < -720) diff += 1440;
	return diff;
}

/** "1h 25m", "45m" - for minute values that run long, like seva. */
export function formatMinutes(totalMinutes) {
	const m = Math.round(totalMinutes);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	const rest = m % 60;
	return rest ? `${h}h ${rest}m` : `${h}h`;
}
