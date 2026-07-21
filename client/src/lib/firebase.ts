import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, type Firestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAKPmqetUP_w8SGqr3ooLXAbASpFlRNWBY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "plataforma-enem-f3682.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "plataforma-enem-f3682",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1086290785401",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1086290785401:web:123ba3c7d224b6497710a8",
};

let app: FirebaseApp;
let secondaryApp: FirebaseApp;
let auth: Auth;
let secondaryAuth: Auth;
let db: Firestore;
let firebaseError: Error | null = null;

try {
  const existingApps = getApps();
  app = existingApps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);

  try {
    db = getFirestore(app);
  } catch {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    });
  }

  const existingSecondaryApp = existingApps.find((firebaseApp) => firebaseApp.name === "secondary");
  secondaryApp = existingSecondaryApp ?? initializeApp(firebaseConfig, "secondary");
  secondaryAuth = getAuth(secondaryApp);
} catch (error) {
  firebaseError = error as Error;
  console.error("Erro ao inicializar o Firebase:", error);
}

export async function createUserWithoutSignIn(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondaryAuth.signOut();
  return userCredential;
}

export { auth, db, firebaseError };
