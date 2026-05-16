const admin = require('firebase-admin');

let firebaseApp = null;

function buildFirebaseCredential() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey =
    process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  try {
    return admin.credential.applicationDefault();
  } catch (error) {
    return null;
  }
}

function getFirebaseApp() {
  if (firebaseApp) {
    return firebaseApp;
  }
  if (admin.apps.length) {
    firebaseApp = admin.app();
    return firebaseApp;
  }

  const credential = buildFirebaseCredential();
  if (!credential) {
    throw new Error('Missing Firebase service account configuration.');
  }

  firebaseApp = admin.initializeApp({ credential });

  return firebaseApp;
}

function getFirestore() {
  return getFirebaseApp().firestore();
}

function getAuth() {
  return getFirebaseApp().auth();
}

async function verifyIdToken(idToken) {
  if (!idToken) {
    throw new Error('Missing Firebase ID token.');
  }
  const auth = getAuth();
  return auth.verifyIdToken(idToken);
}

module.exports = {
  getFirebaseApp,
  getFirestore,
  getAuth,
  verifyIdToken,
};
