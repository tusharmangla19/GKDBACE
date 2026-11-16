import {
	collection,
	doc,
	getDocs,
	query,
	runTransaction,
	where,
	serverTimestamp,
} from 'firebase/firestore';
import {
	morningProgramSchema,
	asBoolean,
	asNumber,
	isUnset,
	monthKeyRange,
	parseTimeToMinutes,
	minutesToWireTime,
} from '@iyf/domain';
import { db } from './client.js';

/**
 * Every read and write of a devotee's sadhana.
 *
 * ONE FLAT COLLECTION, with the identity of a day in its document id:
 *
 *     days/{devoteeId}_{YYYY-MM-DD}
 *
 * Four consequences, each fixing something the old shape got wrong.
 *
 * 1. The database enforces one day per devotee. The old shape used auto-generated
 *    ids with the date as a mere field, so duplicates were legal and the upsert
 *    had to read before writing - a race two devices could both lose.
 *
 * 2. A save is one transaction against one known document id. The old upsert had
 *    to query the collection to find the day first, then write.
 *
 * 3. The roster screen is one query instead of sixteen. The old shape put each
 *    devotee in their own subcollection, so nothing could span them; drawing
 *    sixteen rows meant sixteen requests returning every record ever written.
 *
 * 4. Dates sort and filter, because the key carries its year.
 *
 * Writes are strict: values are coerced to the schema's declared type, and only
 * schema fields are persisted, so a caller cannot put UI state on a record.
 */

const DAYS = 'days';

const dayId = (devoteeId, dateKey) => `${devoteeId}_${dateKey}`;

/** Coerce one value to the type its field declares. null means not recorded. */
function toStored(field, value) {
	if (isUnset(value)) return null;
	if (field.type === 'number') {
		const n = asNumber(value);
		if (n === null) return null;
		const clamped = Math.min(Math.max(Math.round(n), 0), field.max ?? Number.MAX_SAFE_INTEGER);
		return clamped;
	}
	if (field.type === 'boolean') return asBoolean(value);
	// time: normalise to "HH:MM" whatever the caller had on screen
	const minutes = parseTimeToMinutes(value);
	return minutes === null ? null : minutesToWireTime(minutes);
}

const fromSnapshot = (snap) => ({ id: snap.id, ...snap.data() });

/** Every day this devotee has logged, oldest key first. */
export async function listDays(devoteeId) {
	const snapshot = await getDocs(
		query(collection(db, DAYS), where('devoteeId', '==', String(devoteeId)))
	);
	const days = [];
	snapshot.forEach((snap) => days.push(fromSnapshot(snap)));
	return days.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Every devotee's days for the month containing `date` — in ONE query.
 *
 * This is what the flat collection buys. The roster screen used to issue sixteen
 * requests and pull every record in the database to render sixteen numbers;
 * now it is a single range scan over one month.
 */
export async function listMonth(date) {
	const { start, end } = monthKeyRange(date);
	const snapshot = await getDocs(
		query(collection(db, DAYS), where('date', '>=', start), where('date', '<=', end))
	);
	const byDevotee = {};
	snapshot.forEach((snap) => {
		const day = fromSnapshot(snap);
		const id = String(day.devoteeId);
		(byDevotee[id] = byDevotee[id] || []).push(day);
	});
	Object.values(byDevotee).forEach((days) =>
		days.sort((a, b) => String(a.date).localeCompare(String(b.date)))
	);
	return byDevotee;
}

/** One devotee's days for a month. Needs the composite index in firestore.indexes.json. */
export async function listDevoteeMonth(devoteeId, date) {
	const { start, end } = monthKeyRange(date);
	const snapshot = await getDocs(
		query(
			collection(db, DAYS),
			where('devoteeId', '==', String(devoteeId)),
			where('date', '>=', start),
			where('date', '<=', end)
		)
	);
	const days = [];
	snapshot.forEach((snap) => days.push(fromSnapshot(snap)));
	return days.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Insert or update one day.
 *
 * Runs in a transaction, which buys two things a plain write cannot:
 *
 *   - `createdAt` is set only on insert, so it records when the day was FIRST
 *     logged rather than when it was last touched. On a leaderboard the whole
 *     group can see, the difference between logging at dawn and backfilling three
 *     weeks later is information, and the old records could not tell them apart.
 *   - two devices saving the same day cannot interleave.
 *
 * It costs one single-document read - against the old shape's read of the entire
 * collection before every write.
 */
export async function saveDay(devoteeId, day) {
	const dateKey = day.date;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
		throw new Error(`saveDay: date must be YYYY-MM-DD, got ${JSON.stringify(dateKey)}`);
	}

	const fields = { devoteeId: String(devoteeId), date: dateKey };
	morningProgramSchema.forEach((field) => {
		fields[field.key] = toStored(field, day[field.key]);
	});

	const ref = doc(db, DAYS, dayId(devoteeId, dateKey));
	await runTransaction(db, async (tx) => {
		const existing = await tx.get(ref);
		tx.set(
			ref,
			existing.exists()
				? { ...fields, updatedAt: serverTimestamp() }
				: { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
			{ merge: true }
		);
	});

	return { id: ref.id, ...fields };
}

export { dayId };
