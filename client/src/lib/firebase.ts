import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let secondaryApp: FirebaseApp;
let auth: Auth;
let secondaryAuth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let firebaseError: Error | null = null;

try {
  console.log("🔧 Verificando configuração do Firebase...");
  console.log("API Key presente:", !!firebaseConfig.apiKey);
  console.log("Project ID presente:", !!firebaseConfig.projectId);
  console.log("App ID presente:", !!firebaseConfig.appId);
  
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    const missing = [];
    if (!firebaseConfig.apiKey) missing.push("VITE_FIREBASE_API_KEY");
    if (!firebaseConfig.projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
    if (!firebaseConfig.appId) missing.push("VITE_FIREBASE_APP_ID");
    
    throw new Error(
      `❌ Credenciais do Firebase faltando: ${missing.join(", ")}.\n\n` +
      `Por favor, configure essas variáveis nos Secrets do Replit:\n` +
      `1. Acesse https://console.firebase.google.com/\n` +
      `2. Vá em Project Settings > Your apps\n` +
      `3. Copie as credenciais e adicione nos Secrets do Replit`
    );
  }

  console.log("✅ Inicializando Firebase...");
  console.log("📌 Project ID:", firebaseConfig.projectId);
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  secondaryApp = initializeApp(firebaseConfig, "secondary");
  secondaryAuth = getAuth(secondaryApp);
  console.log("✅ Firebase inicializado com sucesso!");
} catch (error) {
  firebaseError = error as Error;
  console.error("❌ Erro ao inicializar Firebase:", error);
  console.error("Mensagem:", (error as Error).message);
}

export async function createUserWithoutSignIn(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondaryAuth.signOut();
  return userCredential;
}

export { auth, db, storage, firebaseError };
