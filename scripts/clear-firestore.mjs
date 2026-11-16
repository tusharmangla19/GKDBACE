#!/usr/bin/env node
/**
 * Delete every sadhana record in the Firestore project.
 *
 *     node scripts/clear-firestore.mjs                 # dry run, counts only
 *     node scripts/clear-firestore.mjs --commit        # actually delete
 *     node scripts/clear-firestore.mjs --all           # every collection, not just days/
 *
 * THIS IS NOT REVERSIBLE. Firestore has no undo and no bin: a deleted document is
 * gone, and the whole point of `createdAt` - when a day was FIRST logged - cannot
 * be reconstructed from anything else. Dry run is the default for that reason,
 * and --commit asks once more before it does anything.
 *
 * Two credentials are in play, which is the part worth understanding before you
 * reach for this:
 *
 *   reading   goes through @iyf/data like everything else. `allow read: if true`,
 *             so the count below needs no login at all.
 *   deleting  CANNOT go through the client SDK. firestore.rules ends with
 *             `allow delete: if false`, which applies to every client equally, so
 *             a deleteDoc() here would fail permission-denied on every document.
 *             The Firebase CLI talks to the admin API and bypasses rules, so the
 *             delete is handed to `firebase firestore:delete`.
 *
 * That asymmetry is deliberate in the rules ("days get corrected, not removed"),
 * and this script is the intended way around it: an operator at a terminal with
 * an authenticated CLI, not the app.
 *
 * Requires `firebase login` first - an interactive browser flow.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../packages/data/index.js';

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);

const COMMIT = flag('commit');
const ALL = flag('all');

const projectId = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url))).projects
	.default;

/** A count, plus a few ids, so the dry run shows what it is about to destroy. */
async function survey() {
	const snapshot = await getDocs(query(collection(db, 'days'), limit(1000)));
	const byDevotee = {};
	snapshot.forEach((snap) => {
		const id = String(snap.data().devoteeId ?? '(no devoteeId)');
		byDevotee[id] = (byDevotee[id] || 0) + 1;
	});
	return { total: snapshot.size, byDevotee, capped: snapshot.size === 1000 };
}

function runCli(cliArgs) {
	const result = spawnSync('firebase', cliArgs, { stdio: 'inherit' });
	if (result.error) {
		console.error(`\nCould not run the Firebase CLI: ${result.error.message}`);
		console.error('Install it with  npm i -g firebase-tools');
		process.exit(1);
	}
	return result.status ?? 1;
}

console.log(`Project: ${projectId}`);
console.log(`Target:  ${ALL ? 'EVERY collection' : 'the days/ collection'}\n`);

const { total, byDevotee, capped } = await survey();

if (total === 0) {
	console.log('days/ is already empty — nothing to delete.');
	if (!ALL) process.exit(0);
} else {
	console.log(`days/ holds ${total}${capped ? '+ (counting stopped at 1000)' : ''} documents:`);
	Object.entries(byDevotee)
		.sort((a, b) => Number(a[0]) - Number(b[0]))
		.forEach(([id, n]) => console.log(`   devotee ${id.padEnd(4)} ${n}`));
	console.log();
}

if (!COMMIT) {
	console.log('DRY RUN — nothing was deleted.');
	console.log('Re-run with --commit to delete. This cannot be undone.');
	process.exit(0);
}

// The CLI prompts for confirmation itself and prints its own progress, so it is
// left to do that rather than being silenced behind a second prompt here.
console.log('Handing over to the Firebase CLI, which will ask you to confirm.\n');

const status = ALL
	? runCli(['firestore:delete', '--all-collections', '--project', projectId])
	: runCli(['firestore:delete', 'days', '--recursive', '--project', projectId]);

if (status !== 0) {
	console.error('\nDelete did not complete.');
	console.error('If it said you are not authenticated, run  firebase login  and try again.');
	process.exit(status);
}

console.log('\nDone. Re-run without --commit to confirm the collection is empty.');
process.exit(0);
