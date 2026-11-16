/**
 * Storage. The only package in the workspace that imports `firebase`.
 *
 * Apps ask for days and save days. They do not know the collection is called
 * `days`, that a document id encodes the devotee and the date, or that a save
 * runs in a transaction to keep `createdAt` honest.
 */
export { firebaseConfig } from './config.js';
export { db } from './client.js';
export * from './repository.js';
