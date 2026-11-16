#!/usr/bin/env node
/**
 * Move the old records into the new `days` collection.
 *
 *     node scripts/migrate-to-day-keys.mjs              # dry run, writes nothing
 *     node scripts/migrate-to-day-keys.mjs --commit     # actually write
 *     node scripts/migrate-to-day-keys.mjs --devotee=7  # one devotee
 *     node scripts/migrate-to-day-keys.mjs --from=2022 --to=2026
 *
 * Without this, every historical day is simply invisible: the apps read `days`,
 * the history lives in `morningProgram/{devoteeId}/dailyData`, and nothing joins
 * the two. Sixteen devotees would open the app to an empty year.
 *
 * Two things change per document, and only one of them is hard:
 *
 *   keys and types  "Mangala Arti": "Yes" becomes mangalaArti: true. Mechanical.
 *                   `saveDay` already coerces every value through the schema, so
 *                   this script renames the keys and hands the day over rather
 *                   than reimplementing the conversion and letting it drift.
 *
 *   the date        "Tue, Jan 6" has no year. This is the whole difficulty, and
 *                   it is the reason the format was changed.
 *
 * THE YEAR IS RECOVERED, NOT GUESSED. A weekday plus a day and a month is only
 * consistent with one year in any short window - "Tue, Jan 6" is 2026 and not
 * 2023, 2024 or 2025, because Jan 6 fell on a Friday, Saturday and Monday in
 * those years. Every document is checked against every year in the window and
 * must match EXACTLY ONE. A document that matches none (the weekday contradicts
 * the date) or several (the window is too wide) is reported and left alone. It is
 * never assigned a year on a hunch, because a wrong year files a day under
 * someone's future and cannot be told apart from a real entry afterwards.
 *
 * Safe to re-run. Days that already exist in `days` are skipped, not overwritten,
 * so a partial run can simply be run again.
 *
 * BEFORE YOU RUN IT: the deployed rules have no `match` for the old collection,
 * so the client SDK is refused a read of it and this script stops with
 * permission-denied. The old data is not gone, it is unreadable. Grant a
 * temporary read - nothing here ever writes to the old path - by adding this
 * inside `match /databases/{database}/documents` in firestore.rules:
 *
 *     match /morningProgram/{devoteeId}/dailyData/{docId} {
 *       allow read: if true;
 *     }
 *
 * then `firebase deploy --only firestore:rules`, run the migration, DELETE the
 * block and deploy again. Regenerating with `npm run rules` removes it, since the
 * generator does not know about it. The alternative is the Admin SDK with a
 * service account, which bypasses rules entirely and needs a key on disk.
 */
import { pathToFileURL } from 'node:url';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, saveDay, dayId } from '../packages/data/index.js';
import { devoteesData, morningProgramSchema, toDateKey } from '../packages/domain/index.js';

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const value = (name, fallback) => {
	const hit = args.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};

const COMMIT = flag('commit');
const THIS_YEAR = new Date().getFullYear();
const FROM = Number(value('from', THIS_YEAR - 3));
const TO = Number(value('to', THIS_YEAR));
const ONLY = value('devotee', null);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Tue, Jan 6" -> { key: "2026-01-06" }, or a reason it could not be resolved.
 * Returns every candidate year so an ambiguous date can say what it was torn
 * between rather than just failing.
 */
export function resolveDate(text, from = FROM, to = TO) {
	const match = /^([A-Za-z]{3}),\s*([A-Za-z]{3})\s+(\d{1,2})$/.exec(String(text ?? '').trim());
	if (!match) return { key: null, reason: 'unparseable', candidates: [] };

	const [, weekday, month, dayText] = match;
	const monthIndex = MONTHS.indexOf(month);
	const dayOfMonth = Number(dayText);
	if (monthIndex === -1) return { key: null, reason: 'unknown month', candidates: [] };

	const candidates = [];
	for (let year = from; year <= to; year += 1) {
		const date = new Date(year, monthIndex, dayOfMonth);
		// Rolls over for Feb 30 and the like, which is how an impossible date is caught.
		if (date.getMonth() !== monthIndex || date.getDate() !== dayOfMonth) continue;
		if (WEEKDAYS[date.getDay()] === weekday) candidates.push(toDateKey(date));
	}

	if (candidates.length === 1) return { key: candidates[0], reason: null, candidates };
	return {
		key: null,
		reason: candidates.length === 0 ? 'no year in the window has this weekday' : 'ambiguous',
		candidates,
	};
}

/** Old display-label keys to schema keys. Values are left for `saveDay` to coerce. */
export function toDay(record) {
	const day = {};
	morningProgramSchema.forEach((field) => {
		if (field.legacyLabel in record) day[field.key] = record[field.legacyLabel];
	});
	return day;
}

/** How much a record actually holds, for choosing between two that collide. */
const filled = (day) => Object.values(day).filter((v) => v !== null && v !== '').length;

/* The migration itself. Guarded so the two pure helpers above can be imported
 * and tested without a database. */
async function main() {
	const totals = { read: 0, written: 0, skipped: 0, collisions: 0, unresolved: 0 };
	const problems = [];

	const roster = ONLY ? devoteesData.filter((d) => String(d.id) === String(ONLY)) : devoteesData;
	if (!roster.length) {
		console.error(`No devotee with id ${ONLY} in the roster.`);
		process.exit(1);
	}

	console.log(
		`${COMMIT ? 'MIGRATING' : 'DRY RUN (nothing will be written)'} - ` +
			`${roster.length} devotee(s), resolving years in ${FROM}-${TO}\n`
	);

	for (const devotee of roster) {
		const devoteeId = String(devotee.id);
		let snapshot;
		try {
			snapshot = await getDocs(collection(db, 'morningProgram', devoteeId, 'dailyData'));
		} catch (error) {
			if (error?.code !== 'permission-denied') throw error;
			console.error(
				`\nThe deployed rules refuse a read of morningProgram/${devoteeId}/dailyData.\n` +
					'The old data is unreadable, not lost. See the header of this file for the\n' +
					'temporary read rule to deploy, migrate under, and then remove.\n'
			);
			process.exit(1);
		}
		if (snapshot.empty) {
			console.log(`  ${devoteeId.padStart(2)} ${devotee.name.padEnd(24)} nothing to migrate`);
			continue;
		}

		// Resolve first, write second: a collision is only visible once every document
		// in the subcollection has a date, and the better of the two should win.
		const resolved = new Map();
		let unresolved = 0;

		snapshot.forEach((snap) => {
			totals.read += 1;
			const record = snap.data();
			const { key, reason, candidates } = resolveDate(record.date);
			if (!key) {
				unresolved += 1;
				totals.unresolved += 1;
				problems.push(
					`  ${devoteeId}/${snap.id}  date ${JSON.stringify(record.date)} - ${reason}` +
						(candidates.length ? ` (${candidates.join(' or ')})` : '')
				);
				return;
			}

			const day = toDay(record);
			const existing = resolved.get(key);
			if (existing) {
				totals.collisions += 1;
				problems.push(
					`  ${devoteeId}/${snap.id}  ${key} also written by ${existing.docId} - ` +
						`keeping the fuller of the two (${Math.max(filled(day), filled(existing.day))} fields)`
				);
				if (filled(day) <= filled(existing.day)) return;
			}
			resolved.set(key, { day, docId: snap.id });
		});

		let written = 0;
		let skipped = 0;
		for (const [key, { day }] of resolved) {
			// Re-runnable: never overwrite a day that is already in the new collection,
			// which may well be newer than what the old record holds.
			const target = await getDoc(doc(db, 'days', dayId(devoteeId, key)));
			if (target.exists()) {
				skipped += 1;
				continue;
			}
			if (COMMIT) await saveDay(devoteeId, { ...day, date: key });
			written += 1;
		}

		totals.written += written;
		totals.skipped += skipped;
		console.log(
			`  ${devoteeId.padStart(2)} ${devotee.name.padEnd(24)} ` +
				`${String(snapshot.size).padStart(4)} old  ->  ${String(written).padStart(4)} ${
					COMMIT ? 'written' : 'to write'
				}` +
				(skipped ? `, ${skipped} already there` : '') +
				(unresolved ? `, ${unresolved} UNRESOLVED` : '')
		);
	}

	console.log(
		`\n${totals.read} old documents read, ${totals.written} ${COMMIT ? 'written' : 'would be written'}, ` +
			`${totals.skipped} already present, ${totals.collisions} collisions, ${totals.unresolved} unresolved.`
	);

	if (problems.length) {
		console.log(`\nNeeds a decision (${problems.length}):`);
		problems.forEach((p) => console.log(p));
		console.log(
			'\nUnresolved days are LEFT IN PLACE, never guessed. Widen or narrow the window\n' +
				'with --from / --to, or fix the date on the old document, then run again.'
		);
	}

	if (!COMMIT && totals.written) {
		console.log('\nNothing was written. Re-run with --commit to apply.');
	}
}

// argv[1] is absent when this file is imported by a test rather than run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
	process.exit(0);
}
