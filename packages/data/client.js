import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config.js';

/**
 * One Firestore handle for the process. The app and the repo scripts go through
 * this, so there is a single place to add persistence settings, emulator support
 * or auth later.
 */
export const db = getFirestore(initializeApp(firebaseConfig));
