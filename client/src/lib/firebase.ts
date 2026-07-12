import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, type Firestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAKPmqetUP_w8SGqr3ooLXAbASpFlRNWBY",
  authDomain: "plataforma-enem-f3682.firebaseapp.com",
  projectId: "plataforma-enem-f3682",
  storageBucket: "plataforma-enem-f3682.firebasestorage.app",
  messagingSenderId: "1086290785401",
  appId: "1:1086290785401:web:123ba3c7d224b6497710a8",
};

let app: FirebaseApp;
let secondaryApp: FirebaseApp;
let auth: Auth;
let secondaryAuth: Auth;
let db: Firestore;
let storage: FirebaseStorage | null = null;
let storageAvailable = false;
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

  try {
    storage = getStorage(app);
    storageAvailable = true;
  } catch (storageError) {
    console.warn("Firebase Storage indisponível. Os uploads permanecerão desativados.", storageError);
    storage = null;
    storageAvailable = false;
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

export function isStorageAvailable(): boolean {
  return storageAvailable && storage !== null;
}

export { auth, db, storage, storageAvailable, firebaseError };
