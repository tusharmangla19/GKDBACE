/**
 * The Firestore project this app talks to.
 *
 * Config only; `client.js` is what initialises the app with it. Kept separate so
 * a different entry point (a script, an emulator run) can build its own handle
 * without a second copy of the values. They were once pasted into five files,
 * and a rotated key would have been found in four of them.
 *
 * Not a secret: a Firebase web config is public by design, and access is meant to
 * be controlled by security rules - see firestore.rules.
 */
export const firebaseConfig = {
	apiKey: 'AIzaSyBBx54nlMhqoEvw4dt5fqfIRB4WDHf4MHY',
	authDomain: 'iyf-sadhana.firebaseapp.com',
	projectId: 'iyf-sadhana',
	storageBucket: 'iyf-sadhana.firebasestorage.app',
	messagingSenderId: '819660354644',
	appId: '1:819660354644:web:d656f01a906fc6937269c1',
};
