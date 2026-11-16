/**
 * Averages over a set of days.
 *
 * Three genuinely different operations, chosen by each field's `agg`:
 *
 *   circularMean  time fields -> "h:mm AM/PM" via sin/cos and atan2. A plain mean
 *                 is wrong here: 23:50 and 00:10 average to 00:00, not 12:00.
 *   mean          arithmetic mean of the numbers, rounded to a whole unit.
 *   trueCount     a SUM: how many days were true. NOT an average, and the UI must
 *                 not label it as one.
 *
 * Unset values are excluded from the denominator, so `count` is how many days
 * actually contributed. The UI discloses that: an average over three days is not
 * comparable to one over seven.
 *
 * Reads are TOLERANT. The previous schema stored everything as a string, so a
 * number may arrive as `16` or `"16"`, and a boolean as `true` or `"Yes"`. Writes
 * are strict - see @iyf/data. Being lenient here means legacy or hand-edited
 * records degrade to a missing value rather than a crash.
 */

import { morningProgramSchema, fieldByKey } from './schema.js';
import { parseTimeToMinutes, minutesToDisplayTime } from './time.js';

/** Not recorded. Distinct from zero, which is a real reading. */
export const isUnset = (value) =>
	value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** A number, however it was stored. null when it is not one. */
export const asNumber = (value) => {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'string') {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

/** A boolean, however it was stored. null when it is neither. */
export const asBoolean = (value) => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const text = value.trim().toLowerCase();
		if (text === 'yes' || text === 'true') return true;
		if (text === 'no' || text === 'false') return false;
	}
	return null;
};

/** Parsed, contributing values for one field across a set of days. */
export const collectFieldValues = (days, key) => {
	const field = fieldByKey[key];
	if (!field) return [];
	const list = Array.isArray(days) ? days : Object.values(days || {});

	return list
		.map((day) => {
			if (!day || isUnset(day[key])) return null;
			if (field.type === 'time') return parseTimeToMinutes(day[key]);
			if (field.type === 'number') return asNumber(day[key]);
			const bool = asBoolean(day[key]);
			return bool === null ? null : bool ? 1 : 0;
		})
		.filter((value) => value !== null);
};

/** Circular mean in minutes since midnight, or null. */
export const circularMeanMinutes = (values) => {
	if (!values.length) return null;
	const radians = values.map((minutes) => (minutes / (24 * 60)) * 2 * Math.PI);
	const sumSin = radians.reduce((acc, rad) => acc + Math.sin(rad), 0);
	const sumCos = radians.reduce((acc, rad) => acc + Math.cos(rad), 0);
	const averageAngle = Math.atan2(sumSin, sumCos);

	let averageMinutes = Math.round((averageAngle / (2 * Math.PI)) * 24 * 60);
	if (averageMinutes < 0) averageMinutes += 24 * 60;
	return averageMinutes;
};

/**
 * The UNROUNDED aggregate plus its denominator.
 *
 * Deltas are computed from `raw` so two periods that both round to 13 still show
 * a real change; the number on screen always comes from calculateFieldAverage.
 */
export const fieldStats = (days, key) => {
	const field = fieldByKey[key];
	const values = collectFieldValues(days, key);
	if (!field || !values.length) return { agg: field?.agg ?? null, raw: null, count: 0 };

	if (field.agg === 'circularMean') {
		return { agg: field.agg, raw: circularMeanMinutes(values), count: values.length };
	}
	if (field.agg === 'mean') {
		const sum = values.reduce((acc, value) => acc + value, 0);
		return { agg: field.agg, raw: sum / values.length, count: values.length };
	}
	const trueDays = values.reduce((acc, value) => acc + value, 0);
	return { agg: field.agg, raw: trueDays, count: values.length };
};

/** The displayed value for one field over a set of days, or null. */
export const calculateFieldAverage = (days, key) => {
	const { agg, raw, count } = fieldStats(days, key);
	if (!count || raw === null) return null;
	if (agg === 'circularMean') return minutesToDisplayTime(raw);
	if (agg === 'mean') return Math.round(raw);
	return raw;
};

export const calculateAverages = (days) => {
	const averages = {};
	morningProgramSchema.forEach(({ key }) => {
		averages[key] = calculateFieldAverage(days, key);
	});
	return averages;
};

/**
 * True when every non-optional field has a value.
 *
 * `sixteenthRound` is optional, so leaving it blank still gives a complete day.
 * Requiring it meant anyone chanting below their vow - or simply not noting the
 * hour - could never finish a day no matter what else they logged, which silently
 * broke week dots, days-logged and streaks.
 */
export const isDayComplete = (day) =>
	!!day && !morningProgramSchema.some((field) => !field.optional && isUnset(day[field.key]));

/** True when the day exists and has at least one field set. */
export const isDayStarted = (day) =>
	!!day && morningProgramSchema.some((field) => !isUnset(day[field.key]));

/** How many fields carry a value, optional ones included. */
export const filledFieldCount = (day) =>
	day ? morningProgramSchema.filter((field) => !isUnset(day[field.key])).length : 0;

export const indexByDate = (days) => {
	const map = {};
	(days || []).forEach((day) => {
		if (day && day.date) map[day.date] = day;
	});
	return map;
};
