/**
 * The public shape of @iyf/domain.
 *
 * The implementation stays plain ESM so `node scripts/*.mjs` can import it
 * directly. This file is what the
 * app compiles against, and it is the reason `tsc --noEmit` can catch a renamed
 * field or a metric read that no longer exists.
 */

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** Storage keys. Renaming one orphans historical data - see schema.js. */
export type FieldKey =
	| 'sleepTime'
	| 'wakeUpTime'
	| 'mangalaArti'
	| 'japa'
	| 'sixteenthRound'
	| 'attendedClass'
	| 'spLecture'
	| 'otherLecture'
	| 'spBooks'
	| 'otherBooks'
	| 'seva'
	| 'study'
	| 'dayRest';

export type FieldGroupKey = 'japa' | 'attendance' | 'hearing' | 'reading' | 'service' | 'rest';

/** What is actually stored for a field. */
export type FieldType = 'number' | 'time' | 'boolean';

/** Which control a devotee uses to enter it. */
export type FieldInput = 'stepper' | 'time' | 'toggle';

/** How a period average is computed. `trueCount` is a SUM, not an average. */
export type Aggregation = 'mean' | 'circularMean' | 'trueCount';

/** Which way is an improvement. `neutral` renders without a verdict. */
export type GoodDirection = 'up' | 'down' | 'neutral';

export interface FieldGroup {
	key: FieldGroupKey;
	label: string;
}

export interface SadhanaField {
	key: FieldKey;
	/** The display string this field was stored under before the rename. */
	legacyLabel: string;
	label: string;
	type: FieldType;
	input: FieldInput;
	agg: Aggregation;
	unit: string;
	goodDirection: GoodDirection;
	/** The vow, for chart reference lines and "days met" counts. */
	target: number | null;
	group: FieldGroupKey;
	icon: string;
	/** Stepper increment, numeric fields only. */
	step?: number;
	/** Upper bound a write is clamped to, numeric fields only. */
	max?: number;
	/** Never required, never counted against completeness. */
	optional?: boolean;
	/** The honest name when it depends on the day's own data. */
	labelFor?: (record: Partial<DayFields> | null | undefined) => string;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/**
 * One stored value. Reads are tolerant of the pre-migration string forms
 * (`"16"`, `"Yes"`, `"22:30"`), which is why this is not just the field's own
 * type. Writes are strict - @iyf/data coerces before persisting.
 */
export type DayValue = number | string | boolean | null;

export type DayFields = { [K in FieldKey]?: DayValue };

/** A day as it comes back from storage. `date` is the `YYYY-MM-DD` key. */
export interface DayRecord extends DayFields {
	id?: string;
	devoteeId?: string;
	date: string;
	createdAt?: unknown;
	updatedAt?: unknown;
}

/** A day being edited on screen, before it has been saved. */
export type DayDraft = { [K in FieldKey]: DayValue };

export interface Devotee {
	id: number;
	name: string;
}

export interface Quote {
	number: number;
	quote: string;
	reference: string;
}

// ---------------------------------------------------------------------------
// schema.js
// ---------------------------------------------------------------------------

export const FIELD_GROUPS: readonly FieldGroup[];
export const morningProgramSchema: readonly SadhanaField[];
export const fieldByKey: Record<FieldKey, SadhanaField>;
/** Fields carrying a numeric target we can count "days met" against. */
export const TARGET_FIELDS: readonly SadhanaField[];
/** Boolean fields, whose "average" is a count of true days. */
export const BOOLEAN_FIELDS: readonly SadhanaField[];
/** Fields that need an explicit answer before a day is finished. */
export const ENTRY_REQUIRED_FIELDS: readonly SadhanaField[];
/** Row order for the averages table. */
export const AVERAGES_ORDER: readonly FieldKey[];
export const averagesFields: readonly SadhanaField[];
export function fieldLabel(
	field: SadhanaField,
	record?: Partial<DayFields> | null
): string;
/** A blank day: numbers at zero, times and booleans genuinely unset. */
export function emptyDay(): DayDraft;

// ---------------------------------------------------------------------------
// time.js
// ---------------------------------------------------------------------------

/** The storage key for a day: "2026-08-26". */
export function toDateKey(date: Date): string;
export function parseDateKey(key: unknown): Date | null;
/** Inclusive first and last key of a month, for a range query. */
export function monthKeyRange(date: Date): { start: string; end: string };
export function keyRange(from: Date, to: Date): { start: string; end: string };
/** Minutes since midnight from "22:30", "10:30 PM" or "4:15 am". */
export function parseTimeToMinutes(raw: unknown): number | null;
/** 24-hour "HH:MM" - the stored form for every time field. */
export function minutesToWireTime(totalMinutes: number): string;
/** "h:mm AM/PM", display only. */
export function minutesToDisplayTime(totalMinutes: number): string;
/** Signed shortest distance on a 24h circle, in [-720, 720]. */
export function circularDeltaMinutes(fromMinutes: number, toMinutes: number): number;
/** "1h 25m", "45m". */
export function formatMinutes(totalMinutes: number): string;

// ---------------------------------------------------------------------------
// aggregate.js
// ---------------------------------------------------------------------------

/** Not recorded. Distinct from zero, which is a real reading. */
export function isUnset(value: unknown): boolean;
export function asNumber(value: unknown): number | null;
export function asBoolean(value: unknown): boolean | null;
export function collectFieldValues(
	days: readonly (DayRecord | null)[] | Record<string, DayRecord>,
	key: FieldKey
): number[];
export function circularMeanMinutes(values: readonly number[]): number | null;
/** The unrounded aggregate plus its denominator. */
export function fieldStats(
	days: readonly (DayRecord | null)[] | Record<string, DayRecord>,
	key: FieldKey
): { agg: Aggregation | null; raw: number | null; count: number };
/** The displayed value for one field, or null. Times format, counts stay numbers. */
export function calculateFieldAverage(
	days: readonly (DayRecord | null)[] | Record<string, DayRecord>,
	key: FieldKey
): string | number | null;
export function calculateAverages(
	days: readonly (DayRecord | null)[] | Record<string, DayRecord>
): Record<FieldKey, string | number | null>;
/** True when every non-optional field has a value. */
export function isDayComplete(day: Partial<DayFields> | null | undefined): boolean;
/** True when the day exists and has at least one field set. */
export function isDayStarted(day: Partial<DayFields> | null | undefined): boolean;
export function filledFieldCount(day: Partial<DayFields> | null | undefined): number;
export function indexByDate(days: readonly DayRecord[] | null | undefined): Record<string, DayRecord>;

// ---------------------------------------------------------------------------
// periods.js
// ---------------------------------------------------------------------------

export type PeriodUnit = 'week' | 'month';

export interface Period {
	unit: PeriodUnit;
	anchor: Date;
	start: Date;
	end: Date;
	days: Date[];
	/** Days that have actually happened. A future day cannot be "missing". */
	elapsedDays: Date[];
	prevStart: Date;
	prevEnd: Date;
	isCurrent: boolean;
}

/** Monday. */
export const WEEK_STARTS_ON: number;
export function eachDay(start: Date, end: Date): Date[];
export function isFutureDay(date: Date, now?: Date): boolean;
export function isToday(date: Date, now?: Date): boolean;
export function buildPeriod(anchor: Date, unit: PeriodUnit, now?: Date): Period;
export function shiftPeriod(period: Period, direction: number): Date;
/** "Aug 24 – 30, 2026", or "Aug 31 – Sep 6, 2026" across a month boundary. */
export function formatPeriodLabel(period: Period): string;

// ---------------------------------------------------------------------------
// periodStats.js
// ---------------------------------------------------------------------------

export type DayStateValue = 'complete' | 'partial' | 'missing' | 'future';

export const DAY_STATE: {
	readonly COMPLETE: 'complete';
	readonly PARTIAL: 'partial';
	readonly MISSING: 'missing';
	readonly FUTURE: 'future';
};

export interface PeriodDay {
	date: Date;
	/** `YYYY-MM-DD`. */
	key: string;
	record: DayRecord | null;
	state: DayStateValue;
	/** How many fields carry a value, optional ones included. */
	filled: number;
	total: number;
	isToday: boolean;
}

export interface Completion {
	logged: number;
	partial: number;
	/** Days that have happened. Every denominator on screen uses this. */
	elapsed: number;
	total: number;
	future: number;
	/** Elapsed days that are missing or part-done. */
	open: number;
	percent: number | null;
}

export type DeltaSentiment = 'good' | 'bad' | 'neutral';
export type DeltaDirection = 'up' | 'down' | 'flat';

/**
 * Change against the previous period. `comparable: false` means there is nothing
 * honest to compare - no data either side, or a count mid-period.
 */
export interface Delta {
	comparable: boolean;
	sentiment: DeltaSentiment;
	/** Spoken form, for accessibility labels. */
	display: string | null;
	/** Table form: magnitude only, the arrow carries direction. */
	compact: string | null;
	prevCount: number;
	amount?: number;
	direction?: DeltaDirection;
	prevDisplay?: string | null;
}

export interface Metric {
	field: SadhanaField;
	key: FieldKey;
	label: string;
	agg: Aggregation;
	raw: number | null;
	value: string | number | null;
	display: string | null;
	unit: string;
	/** How many days actually contributed. */
	count: number;
	/** How many could have. The UI must disclose both. */
	elapsed: number;
	delta: Delta;
}

export interface TargetStat {
	field: SadhanaField;
	target: number;
	hit: number;
	of: number;
	elapsed: number;
}

export interface TrueCountStat {
	field: SadhanaField;
	yes: number;
	of: number;
	elapsed: number;
}

export interface Streaks {
	current: number;
	best: number;
}

export interface PeriodStats {
	period: Period;
	days: PeriodDay[];
	completion: Completion;
	metrics: Metric[];
	metricByKey: Record<FieldKey, Metric>;
	targets: TargetStat[];
	trueCounts: TrueCountStat[];
	streaks: Streaks;
	openDays: PeriodDay[];
	hasAnyData: boolean;
}

export interface TrendPoint {
	date: Date;
	state: DayStateValue;
	isToday: boolean;
	/** null where nothing was recorded, so a chart can leave a gap. */
	value: number | null;
	display: string | null;
}

export interface Trend {
	field: SadhanaField | null;
	points: TrendPoint[];
	min?: number | null;
	max?: number | null;
	target?: number | null;
}

export function dayState(date: Date, record: DayRecord | null, now?: Date): DayStateValue;
export function computeStreaks(records: readonly DayRecord[], now?: Date): Streaks;
export function buildPeriodStats(
	records: readonly DayRecord[],
	anchor: Date,
	unit: PeriodUnit,
	now?: Date
): PeriodStats;
export function buildTrend(days: readonly PeriodDay[], fieldKey: FieldKey): Trend;
/** Fields worth charting - the numeric ones plus the Yes/No fields as 0/1. */
export const TRENDABLE_FIELDS: readonly SadhanaField[];

// ---------------------------------------------------------------------------
// devotees.js / spQuotes.js
// ---------------------------------------------------------------------------

export const devoteesData: readonly Devotee[];
export const spQuotes: readonly Quote[];
/** One quote per day, the same for everyone, changing at midnight. */
export function quoteOfTheDay(date?: Date): Quote;
