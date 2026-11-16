/**
 * The fields a devotee logs each day.
 *
 * Each field carries three separable ideas that the previous schema conflated
 * into one string:
 *
 *   key     the storage key. Stable, camelCase, never shown to anyone. Renaming
 *           one orphans data, so it is chosen once and left alone.
 *   label   what a devotee reads. Free to change at any time.
 *   type    what is actually stored: a number, a "HH:MM" time, or a boolean.
 *   legacyLabel
 *           the display string this field was stored under before the rename.
 *           Only the migration reads it. It is not always today's `label` -
 *           "Wake Up Time" became "Wake Up", "Day Rest Time" became "Day Rest" -
 *           which is why the old data cannot be matched on `label`.
 *
 * The old schema used the display label as the storage key - `"Mangala Arti"`,
 * `"16th Round"` - which made every wording change a data migration, and put
 * spaces in database keys. It bit almost immediately: `"16th Round"` is the wrong
 * name below sixteen rounds, so the label had to diverge from the key, and the
 * key started lying.
 *
 * Everything was also stored as a string: `"16"` rounds, `"Yes"`, `"22:30"`. That
 * cost numeric queries, cost sorting, and left three different ways to say
 * nothing - absent, `""`, `"0"` - which mean genuinely different things and were
 * enforced by nothing.
 *
 * Reads are tolerant of the old string forms so nothing crashes on legacy data.
 * Writes are strict.
 *
 * The rest of the metadata is presentation and analysis:
 *
 *   agg            how a period average is computed (see aggregate.js)
 *                    "mean"          arithmetic mean of the numbers, rounded
 *                    "circularMean"  24h circular mean -> "h:mm AM/PM"
 *                    "trueCount"     COUNT of true days (a SUM, not an average)
 *   unit           display unit. Grounded in the real data, not guessed:
 *                  japa is rounds, every other numeric field is minutes.
 *   goodDirection  which way is an improvement: "up" | "down" | "neutral".
 *                  Never assume up=good - more day rest is not progress, so it
 *                  is neutral and renders without a verdict.
 *   target         the vow, for the chart reference line and "days met" counts.
 *   optional       never required, never counted against completeness.
 *   labelFor       (record) => string, when the honest name depends on the data.
 */

export const FIELD_GROUPS = [
	{ key: 'japa', label: 'Japa' },
	{ key: 'attendance', label: 'Attendance' },
	{ key: 'hearing', label: 'Hearing' },
	{ key: 'reading', label: 'Reading' },
	{ key: 'service', label: 'Service' },
	{ key: 'rhythm', label: 'Rest & Rhythm' },
];

export const morningProgramSchema = [
	{
		key: 'sleepTime',
		legacyLabel: 'Sleep',
		label: 'Sleep',
		type: 'time',
		input: 'time',
		agg: 'circularMean',
		unit: 'time',
		goodDirection: 'down',
		target: null,
		group: 'rhythm',
		icon: 'moon',
	},
	{
		key: 'wakeUpTime',
		legacyLabel: 'Wake Up Time',
		label: 'Wake Up',
		type: 'time',
		input: 'time',
		agg: 'circularMean',
		unit: 'time',
		goodDirection: 'down',
		target: null,
		group: 'rhythm',
		icon: 'sunrise',
	},
	{
		key: 'mangalaArti',
		legacyLabel: 'Mangala Arti',
		label: 'Mangala Arti',
		type: 'boolean',
		input: 'toggle',
		agg: 'trueCount',
		unit: 'days',
		goodDirection: 'up',
		target: null,
		group: 'attendance',
		icon: 'temple',
	},
	{
		key: 'japa',
		legacyLabel: 'Japa',
		label: 'Japa',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'rounds',
		step: 1,
		max: 108,
		goodDirection: 'up',
		target: 16,
		group: 'japa',
		icon: 'beads',
	},
	{
		key: 'sixteenthRound',
		legacyLabel: '16th Round',
		label: '16th Round',
		type: 'time',
		input: 'time',
		/*
		 * Always enterable, never required.
		 *
		 * An earlier version gated this on japa >= 16, reasoning that the 16th
		 * round has no completion time if you never reached it. Real data argued
		 * otherwise: days below sixteen rounds did record a time, because a devotee
		 * who chants twelve still finishes at some hour. And the vow is not
		 * universally sixteen - an aspiring devotee on four rounds would have lost
		 * the field entirely.
		 */
		optional: true,
		labelFor: (record) => ((record?.japa ?? 0) >= 16 ? '16th Round' : 'Japa finished'),
		agg: 'circularMean',
		unit: 'time',
		goodDirection: 'down',
		target: null,
		group: 'japa',
		icon: 'clock',
	},
	{
		key: 'attendedClass',
		legacyLabel: 'Class',
		label: 'Class',
		type: 'boolean',
		input: 'toggle',
		agg: 'trueCount',
		unit: 'days',
		goodDirection: 'up',
		target: null,
		group: 'attendance',
		icon: 'lectern',
	},
	{
		key: 'spLecture',
		legacyLabel: 'SP Lecture',
		label: 'SP Lecture',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 5,
		max: 600,
		goodDirection: 'up',
		target: null,
		group: 'hearing',
		icon: 'headphones',
	},
	{
		key: 'otherLecture',
		legacyLabel: 'Other Lecture',
		label: 'Other Lecture',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 5,
		max: 600,
		goodDirection: 'up',
		target: null,
		group: 'hearing',
		icon: 'speaker',
	},
	{
		key: 'spBooks',
		legacyLabel: 'SP Books',
		label: 'SP Books',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 5,
		max: 600,
		goodDirection: 'up',
		target: null,
		group: 'reading',
		icon: 'book',
	},
	{
		key: 'otherBooks',
		legacyLabel: 'Other Books',
		label: 'Other Books',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 5,
		max: 600,
		goodDirection: 'up',
		target: null,
		group: 'reading',
		icon: 'bookOpen',
	},
	{
		key: 'seva',
		legacyLabel: 'Seva',
		label: 'Seva',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 15,
		max: 1440,
		goodDirection: 'up',
		target: null,
		group: 'service',
		icon: 'flag',
	},
	{
		key: 'study',
		legacyLabel: 'Study',
		label: 'Study',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 15,
		max: 1440,
		goodDirection: 'up',
		target: null,
		group: 'service',
		icon: 'lectern',
	},
	{
		key: 'dayRest',
		legacyLabel: 'Day Rest Time',
		label: 'Day Rest',
		type: 'number',
		input: 'stepper',
		agg: 'mean',
		unit: 'min',
		step: 15,
		max: 1440,
		// More daytime rest is not an improvement, and less is not automatically
		// better either. Show the change without a verdict.
		goodDirection: 'neutral',
		target: null,
		group: 'rhythm',
		icon: 'hammock',
	},
];

export const fieldByKey = morningProgramSchema.reduce((acc, f) => {
	acc[f.key] = f;
	return acc;
}, {});

/** Fields carrying a numeric target we can count "days met" against. */
export const TARGET_FIELDS = morningProgramSchema.filter((f) => f.target != null);

/** Boolean fields, whose "average" is a count of true days. */
export const BOOLEAN_FIELDS = morningProgramSchema.filter((f) => f.type === 'boolean');

/**
 * Fields that need an explicit answer before a day is finished.
 *
 * The numeric fields are NOT here. They start at 0, and 0 is a real reading - no
 * seva today, nothing read today - so they are never outstanding. Times and
 * booleans have no defensible default: there is no neutral wake-up time, and a
 * pre-set "no" would be a claim the devotee never made.
 *
 * This is what makes the progress indicator honest in both directions. Counting
 * fields that merely hold a value claimed "7 of 12" on an untouched day; counting
 * only fields the devotee had tapped claimed "11 of 12" when they had legitimately
 * left a zero.
 *
 * `optional` fields are excluded too - see sixteenthRound.
 */
export const ENTRY_REQUIRED_FIELDS = morningProgramSchema.filter(
	(f) => f.type !== 'number' && !f.optional
);

/** The honest name for a field given the day's own data. */
export const fieldLabel = (field, record) =>
	typeof field.labelFor === 'function' ? field.labelFor(record || {}) : field.label;

/**
 * Row order for the averages table. Explicit rather than derived, because the
 * reading order is a design decision: japa first, then what was attended, then
 * the clock times that frame the morning, then hearing, reading, service, rest.
 */
export const AVERAGES_ORDER = [
	'japa',
	'sixteenthRound',
	'mangalaArti',
	'attendedClass',
	'wakeUpTime',
	'sleepTime',
	'spLecture',
	'otherLecture',
	'spBooks',
	'otherBooks',
	'seva',
	'study',
	'dayRest',
];

export const averagesFields = AVERAGES_ORDER.map((key) => fieldByKey[key]);

/** A blank day: numbers at zero, times and booleans genuinely unset. */
export const emptyDay = () => {
	const day = {};
	morningProgramSchema.forEach((field) => {
		day[field.key] = field.type === 'number' ? 0 : null;
	});
	return day;
};
