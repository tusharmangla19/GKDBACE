/**
 * Everything the Week / Month views render, computed once from the records the
 * screen already fetched. Two rules run through this file:
 *
 *   1. A day in the future is not a missing day. Completion denominators use
 *      ELAPSED days only, never the nominal 7 (or 31).
 *   2. Averages disclose their denominator. `count` is how many days actually
 *      contributed, and a delta is only produced when the previous period has
 *      data of its own to compare against.
 */

import { morningProgramSchema } from './schema.js';
import {
	calculateFieldAverage,
	collectFieldValues,
	fieldStats,
	filledFieldCount,
	indexByDate,
	isUnset,
	isDayComplete,
	isDayStarted,
} from './aggregate.js';
import { buildPeriod, eachDay, isFutureDay, isToday } from './periods.js';
import {
	circularDeltaMinutes,
	formatMinutes,
	minutesToDisplayTime,
	parseDateKey,
	toDateKey,
} from './time.js';

export const DAY_STATE = {
	COMPLETE: 'complete',
	PARTIAL: 'partial',
	MISSING: 'missing',
	FUTURE: 'future',
};

export function dayState(date, record, now = new Date()) {
	if (isFutureDay(date, now)) return DAY_STATE.FUTURE;
	if (isDayComplete(record)) return DAY_STATE.COMPLETE;
	if (isDayStarted(record)) return DAY_STATE.PARTIAL;
	return DAY_STATE.MISSING;
}

/** Records whose date key falls inside [start, end]. */
function recordsInRange(byDate, start, end) {
	return eachDay(start, end)
		.map((day) => byDate[toDateKey(day)])
		.filter(Boolean);
}

function formatValue(field, raw) {
	if (raw === null || raw === undefined) return null;
	if (field.agg === 'circularMean') return minutesToDisplayTime(raw);
	if (field.agg === 'trueCount') return String(raw);
	const rounded = Math.round(raw);
	return field.unit === 'min' && rounded >= 60 ? formatMinutes(rounded) : String(rounded);
}

function unitLabel(field, value) {
	if (field.agg === 'circularMean') return '';
	if (field.agg === 'trueCount') return value === 1 ? 'day' : 'days';
	if (field.unit === 'min') return 'min';
	if (field.unit === 'rounds') return value === 1 ? 'round' : 'rounds';
	return field.unit || '';
}

/**
 * Signed change from the previous period, with a sentiment that respects the
 * field's own direction-of-good. `goodDirection: "neutral"` never renders red or
 * green - more Day Rest is not an improvement, and less is not either.
 *
 * @param periodComplete whether every day of the current period has happened.
 *
 * Yes/No fields aggregate to a COUNT, so comparing them across a part-elapsed
 * period against a whole one is meaningless: three days into the week, "Class"
 * legitimately reads 2 against last week's 7 and would show a fall of 5. Counts
 * only get a delta once the period is complete. Rate-based fields are unaffected
 * because a mean is already normalised by its own denominator.
 */
function buildDelta(field, current, previous, periodComplete) {
	if (!current.count || !previous.count || (field.agg === 'trueCount' && !periodComplete)) {
		return {
			comparable: false,
			sentiment: 'neutral',
			display: null,
			compact: null,
			prevCount: previous.count,
		};
	}

	let amount;
	// `display` is the spoken form used in accessibility labels; `compact` is the
	// table form - magnitude only, because the arrow carries the direction and the
	// row already states the unit. Times keep an "m" since their value is a clock
	// time, so a bare number there would be ambiguous.
	let display;
	let compact;

	if (field.agg === 'circularMean') {
		amount = circularDeltaMinutes(previous.raw, current.raw);
		const magnitude = Math.abs(Math.round(amount));
		display =
			magnitude === 0 ? 'same time' : `${magnitude} min ${amount < 0 ? 'earlier' : 'later'}`;
		compact = magnitude === 0 ? null : `${magnitude}m`;
	} else {
		// Round the DELTA, not the operands: 12.6 -> 13.4 is +1, not 0.
		amount = Math.round(current.raw - previous.raw);
		const magnitude = Math.abs(amount);
		if (magnitude === 0) display = 'no change';
		else {
			const noun = unitLabel(field, magnitude);
			display = `${amount > 0 ? '+' : '−'}${magnitude}${noun ? ` ${noun}` : ''}`;
		}
		compact = magnitude === 0 ? null : String(magnitude);
	}

	const direction = amount === 0 ? 'flat' : amount > 0 ? 'up' : 'down';
	let sentiment = 'neutral';
	if (field.goodDirection === 'up')
		sentiment = direction === 'up' ? 'good' : direction === 'down' ? 'bad' : 'neutral';
	if (field.goodDirection === 'down')
		sentiment = direction === 'down' ? 'good' : direction === 'up' ? 'bad' : 'neutral';

	return {
		comparable: true,
		amount,
		direction,
		sentiment,
		display,
		compact,
		prevCount: previous.count,
		prevDisplay: formatValue(field, previous.raw),
	};
}

/**
 * The current run of fully-logged days ending at the most recent elapsed day,
 * plus the best run seen in the data we hold. Computed over ALL records, not
 * just the visible period - a streak does not reset because you paged back.
 */
export function computeStreaks(records, now = new Date()) {
	const byDate = indexByDate(records);

	// Walk back from today for the current streak.
	let current = 0;
	let cursor = new Date(now);
	// Today does not break a streak if it simply has not been logged yet.
	if (!isDayComplete(byDate[toDateKey(cursor)])) {
		cursor.setDate(cursor.getDate() - 1);
	}
	while (isDayComplete(byDate[toDateKey(cursor)])) {
		current += 1;
		cursor.setDate(cursor.getDate() - 1);
	}

	// Best streak across the span we actually hold data for. The keys ARE that
	// span now: `date` is a real YYYY-MM-DD, so the earliest record is an honest
	// start and ISO keys sort lexicographically. This used to read a `timestamp`
	// field that nothing writes any more, which silently truncated every best
	// streak to the last year.
	let best = 0;
	const keys = Object.keys(byDate).filter((key) => parseDateKey(key) !== null);
	if (keys.length) {
		const first = parseDateKey(keys.reduce((earliest, key) => (key < earliest ? key : earliest)));
		let run = 0;
		eachDay(first, now).forEach((day) => {
			if (isDayComplete(byDate[toDateKey(day)])) {
				run += 1;
				if (run > best) best = run;
			} else if (!isFutureDay(day, now)) {
				run = 0;
			}
		});
	}

	return { current, best: Math.max(best, current) };
}

/**
 * @param records   every day this devotee has logged
 * @param anchor    any date inside the period being viewed
 * @param unit      "week" | "month"
 */
export function buildPeriodStats(records, anchor, unit, now = new Date()) {
	const period = buildPeriod(anchor, unit, now);
	const byDate = indexByDate(records);

	const days = period.days.map((date) => {
		const key = toDateKey(date);
		const record = byDate[key] || null;
		return {
			date,
			key,
			record,
			state: dayState(date, record, now),
			filled: filledFieldCount(record),
			total: morningProgramSchema.length,
			isToday: isToday(date, now),
		};
	});

	const elapsed = days.filter((d) => d.state !== DAY_STATE.FUTURE);
	const logged = elapsed.filter((d) => d.state === DAY_STATE.COMPLETE);
	const partial = elapsed.filter((d) => d.state === DAY_STATE.PARTIAL);
	const openDays = elapsed.filter(
		(d) => d.state === DAY_STATE.MISSING || d.state === DAY_STATE.PARTIAL
	);

	const completion = {
		logged: logged.length,
		partial: partial.length,
		elapsed: elapsed.length,
		total: days.length,
		future: days.length - elapsed.length,
		open: openDays.length,
		// Percent of days that have HAPPENED, not of the nominal period length.
		percent: elapsed.length ? Math.round((logged.length / elapsed.length) * 100) : null,
	};

	// A count is only comparable against the previous period once this one has
	// run its full length; see buildDelta.
	const periodComplete = completion.future === 0;

	const currentRecords = recordsInRange(byDate, period.start, period.end);
	const previousRecords = recordsInRange(byDate, period.prevStart, period.prevEnd);

	const metrics = morningProgramSchema.map((field) => {
		const current = fieldStats(currentRecords, field.key);
		const previous = fieldStats(previousRecords, field.key);
		return {
			field,
			key: field.key,
			label: field.label,
			agg: field.agg,
			raw: current.raw,
			// The one headline number. Every surface that shows this field shows
			// this, so a card and a table can never round it differently.
			value: calculateFieldAverage(currentRecords, field.key),
			display: formatValue(field, current.raw),
			unit: unitLabel(field, current.raw),
			count: current.count,
			// The denominator the UI must disclose: how many days could have
			// contributed, versus how many actually did.
			elapsed: completion.elapsed,
			delta: buildDelta(field, current, previous, periodComplete),
		};
	});

	// Consistency: how many days the vow was actually met.
	const targets = morningProgramSchema
		.filter((f) => f.target != null)
		.map((field) => {
			const values = collectFieldValues(currentRecords, field.key);
			return {
				field,
				target: field.target,
				hit: values.filter((v) => v >= field.target).length,
				of: values.length,
				elapsed: completion.elapsed,
			};
		});

	const trueCounts = morningProgramSchema
		.filter((f) => f.agg === 'trueCount')
		.map((field) => {
			const values = collectFieldValues(currentRecords, field.key);
			return {
				field,
				yes: values.reduce((acc, v) => acc + v, 0),
				of: values.length,
				elapsed: completion.elapsed,
			};
		});

	return {
		period,
		days,
		completion,
		metrics,
		metricByKey: metrics.reduce((acc, m) => {
			acc[m.key] = m;
			return acc;
		}, {}),
		targets,
		trueCounts,
		streaks: computeStreaks(records, now),
		openDays,
		hasAnyData: currentRecords.length > 0,
	};
}

/**
 * Per-day series for one field. `value` is null for days with no reading, so the
 * chart can leave a gap instead of interpolating data that does not exist.
 */
export function buildTrend(days, fieldKey) {
	const field = morningProgramSchema.find((f) => f.key === fieldKey);
	if (!field) return { field: null, points: [] };

	const points = days.map((day) => {
		const raw = day.record ? day.record[fieldKey] : null;
		let value = null;
		if (!isUnset(raw)) {
			const parsed = collectFieldValues([day.record], fieldKey);
			value = parsed.length ? parsed[0] : null;
		}
		return {
			date: day.date,
			state: day.state,
			isToday: day.isToday,
			value,
			display:
				value === null
					? null
					: field.agg === 'circularMean'
						? minutesToDisplayTime(value)
						: String(value),
		};
	});

	const values = points.map((p) => p.value).filter((v) => v !== null);
	return {
		field,
		points,
		min: values.length ? Math.min(...values) : null,
		max: values.length ? Math.max(...values) : null,
		target: field.target,
	};
}

/** Fields worth charting - the numeric ones plus the Yes/No fields as 0/1. */
export const TRENDABLE_FIELDS = morningProgramSchema.filter(
	(f) => f.agg === 'mean' || f.agg === 'trueCount'
);
