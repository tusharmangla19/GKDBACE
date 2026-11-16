/**
 * The public shape of @iyf/data. See index.d.ts in @iyf/domain for why the
 * declarations are hand-written and how they are kept honest.
 *
 * Note what is NOT here: the collection name, the document-id format, and the
 * upsert rule. Those are this package's business, and the layering check fails
 * the build if an app learns them.
 */

import type { Firestore } from 'firebase/firestore';
import type { DayDraft, DayRecord } from '@iyf/domain';

export interface FirebaseConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
}

export const firebaseConfig: FirebaseConfig;

/** One Firestore handle for the process. */
export const db: Firestore;

/** Every day this devotee has logged, oldest key first. */
export function listDays(devoteeId: string | number): Promise<DayRecord[]>;

/** Every devotee's days for the month containing `date`, in ONE query. */
export function listMonth(date: Date): Promise<Record<string, DayRecord[]>>;

/** One devotee's days for a month. Needs the composite index. */
export function listDevoteeMonth(devoteeId: string | number, date: Date): Promise<DayRecord[]>;

/**
 * Insert or update one day. `day.date` must be a `YYYY-MM-DD` key; anything else
 * throws rather than writing a record nothing can query.
 */
export function saveDay(
	devoteeId: string | number,
	day: Partial<DayDraft> & { date: string }
): Promise<DayRecord>;

/** `{devoteeId}_{YYYY-MM-DD}` - the document id. Exported for the migration. */
export function dayId(devoteeId: string | number, dateKey: string): string;
