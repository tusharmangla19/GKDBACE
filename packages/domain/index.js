/**
 * The sadhana domain. Pure by rule: no framework, no network, no database.
 *
 * If this package ever imports `firebase`, the layering has broken. Where a day
 * is stored is @iyf/data's business; what a day IS lives here, and every screen
 * agrees on it because there is only one of it.
 *
 *   schema      the twelve fields, their units, and how each one aggregates
 *   aggregate   averages over a set of days (circular mean, mean, yes-count)
 *   time        the year-less date key and 12h/24h conversion
 *   periods     weeks and months, and which of their days have elapsed
 *   periodStats day states, completion, streaks, deltas, trends
 *   devotees    the roster; ids are Firestore document ids
 *   spQuotes    the daily verse
 */
export * from './schema.js';
export * from './time.js';
export * from './aggregate.js';
export * from './periods.js';
export * from './periodStats.js';
export * from './devotees.js';
export * from './spQuotes.js';
