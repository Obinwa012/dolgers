import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let firebaseAdmin;

if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_ADMIN_CREDENTIALS
    );

    firebaseAdmin = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin Initialization Error", error);
  }
} else {
  firebaseAdmin = getApps()[0];
}

const auth = getAuth(firebaseAdmin);
const db = getFirestore(firebaseAdmin);

export { auth, db };